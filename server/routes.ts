import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { InsertBitcoinOrder, BitcoinOrder, Exchange } from "@shared/schema";
import { calculateProfitLoss } from "@shared/schema";
import { binanceService as binancePriceService } from "./binance";
import {
  binanceService,
  krakenService,
  coinbaseService,
  okxService,
  bybitService,
  bitfinexService,
  geminiService,
  bitstampService,
  htxService,
  kucoinService,
  type ExchangeService,
  type OrderBookEntry
} from "./exchanges";

// Circuit breaker for handling exchange failures
interface CircuitBreakerState {
  failureCount: number;
  lastSuccess: number;
  isOpen: boolean;
}

// Exchange configuration for polling
interface ExchangeConfig {
  id: Exclude<Exchange, 'all'>;
  service: ExchangeService;
  baseIntervalMs: number;
  jitterMs: number;
}

// Real whale order tracker from multiple exchanges with circuit breaker pattern
class OrderGenerator {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private wss: WebSocketServer | null = null;
  private currentBtcPrice: number = 93000;
  private activeOrderIds: Set<string> = new Set();
  // Track when each order was last seen on exchange (prevents false deletions from API hiccups)
  private orderLastSeen: Map<string, number> = new Map(); // orderId -> timestamp
  // MEMORY LEAK FIX: Per-exchange cache of active orders to avoid full-table scans
  private activeOrdersByExchange: Map<string, Map<string, BitcoinOrder>> = new Map(); // exchange -> (orderId -> order)
  
  // Exchange polling configuration - staggered intervals to avoid rate limits
  private readonly exchangeConfigs: ExchangeConfig[] = [
    { id: 'binance', service: binanceService, baseIntervalMs: 10000, jitterMs: 3000 },
    { id: 'bybit', service: bybitService, baseIntervalMs: 12000, jitterMs: 3000 },
    { id: 'kraken', service: krakenService, baseIntervalMs: 14000, jitterMs: 3000 },
    { id: 'bitfinex', service: bitfinexService, baseIntervalMs: 16000, jitterMs: 3000 },
    { id: 'coinbase', service: coinbaseService, baseIntervalMs: 18000, jitterMs: 3000 },
    { id: 'okx', service: okxService, baseIntervalMs: 20000, jitterMs: 3000 },
    { id: 'gemini', service: geminiService, baseIntervalMs: 22000, jitterMs: 3000 },
    { id: 'bitstamp', service: bitstampService, baseIntervalMs: 24000, jitterMs: 3000 },
    { id: 'kucoin', service: kucoinService, baseIntervalMs: 26000, jitterMs: 3000 },
    { id: 'htx', service: htxService, baseIntervalMs: 28000, jitterMs: 3000 },
  ];

  async start(wss: WebSocketServer) {
    this.wss = wss;
    
    // Initialize circuit breakers for all exchanges
    for (const config of this.exchangeConfigs) {
      this.circuitBreakers.set(config.id, {
        failureCount: 0,
        lastSuccess: Date.now(),
        isOpen: false,
      });
    }
    
    // Initialize activeOrderIds cache with existing active orders
    await this.initializeActiveOrdersCache();
    
    // Fetch initial Bitcoin price
    this.updateBitcoinPrice();

    // Start polling for each exchange with staggered intervals
    for (const config of this.exchangeConfigs) {
      const interval = setInterval(() => {
        this.fetchWhaleOrders(config.id);
      }, config.baseIntervalMs + Math.random() * config.jitterMs);
      
      this.intervals.set(config.id, interval);
    }

    // Update Bitcoin price every 5 seconds
    setInterval(() => {
      this.updateBitcoinPrice();
    }, 5000);

    // Clean old orders every hour and sync cache (keep for 7 days)
    setInterval(async () => {
      const deletedIds = await storage.clearOldOrders(168); // 7 days
      deletedIds.forEach(id => {
        this.activeOrderIds.delete(id);
        // MEMORY LEAK FIX: Clear orderLastSeen entries for deleted orders
        this.orderLastSeen.delete(id);
      });
      
      // MEMORY LEAK FIX: Clean up stale orderLastSeen entries that don't correspond to active orders
      const staleEntries: string[] = [];
      for (const orderId of Array.from(this.orderLastSeen.keys())) {
        if (!this.activeOrderIds.has(orderId)) {
          staleEntries.push(orderId);
        }
      }
      staleEntries.forEach(id => this.orderLastSeen.delete(id));
      
      if (staleEntries.length > 0) {
        console.log(`[MemoryCleanup] Removed ${staleEntries.length} stale orderLastSeen entries`);
      }
    }, 60 * 60 * 1000);

    // Check for filled orders every 10 seconds
    setInterval(() => {
      this.checkFilledOrders();
    }, 10000);

    console.log(`[OrderGenerator] Started polling ${this.exchangeConfigs.length} exchanges`);
  }
  
  // Circuit breaker: check if exchange should be polled
  private canPollExchange(exchangeId: string): boolean {
    const breaker = this.circuitBreakers.get(exchangeId);
    if (!breaker) return true;
    
    // If circuit is open and it's been more than 2 minutes, try again
    if (breaker.isOpen) {
      const twoMinutes = 2 * 60 * 1000;
      if (Date.now() - breaker.lastSuccess > twoMinutes) {
        console.log(`[CircuitBreaker] Attempting to close circuit for ${exchangeId}`);
        breaker.isOpen = false;
        breaker.failureCount = 0;
        return true;
      }
      return false;
    }
    
    return true;
  }
  
  // Record exchange poll success
  private recordSuccess(exchangeId: string) {
    const breaker = this.circuitBreakers.get(exchangeId);
    if (breaker) {
      breaker.failureCount = 0;
      breaker.lastSuccess = Date.now();
      breaker.isOpen = false;
    }
  }
  
  // Record exchange poll failure
  private recordFailure(exchangeId: string) {
    const breaker = this.circuitBreakers.get(exchangeId);
    if (breaker) {
      breaker.failureCount++;
      
      // Open circuit after 3 consecutive failures
      if (breaker.failureCount >= 3) {
        breaker.isOpen = true;
        console.error(`[CircuitBreaker] Opened circuit for ${exchangeId} after ${breaker.failureCount} failures. Will retry in 2 minutes.`);
      }
    }
  }

  private async initializeActiveOrdersCache() {
    try {
      const allOrders = await storage.getOrders();
      const activeOrders = allOrders.filter(o => o.status === 'active');
      this.activeOrderIds = new Set(activeOrders.map(o => o.id));
      
      // MEMORY LEAK FIX: Initialize per-exchange cache
      for (const config of this.exchangeConfigs) {
        this.activeOrdersByExchange.set(config.id, new Map());
      }
      
      // Populate per-exchange cache
      for (const order of activeOrders) {
        const exchangeCache = this.activeOrdersByExchange.get(order.exchange);
        if (exchangeCache) {
          exchangeCache.set(order.id, order);
        }
      }
      
      console.log(`[OrderGenerator] Initialized with ${this.activeOrderIds.size} active orders`);
    } catch (error) {
      console.error('Failed to initialize active orders cache:', error);
      // Initialize empty cache on error
      for (const config of this.exchangeConfigs) {
        this.activeOrdersByExchange.set(config.id, new Map());
      }
    }
  }

  private async checkFilledOrders() {
    try {
      // Snapshot active IDs to avoid issues with concurrent modifications
      const activeIdsSnapshot = Array.from(this.activeOrderIds);
      
      // Fetch all orders in parallel
      const orderPromises = activeIdsSnapshot.map(id => storage.getOrder(id));
      const orders = await Promise.all(orderPromises);
      
      // Build map of ID -> order for easy lookup
      const orderMap = new Map<string, BitcoinOrder>();
      activeIdsSnapshot.forEach((id, index) => {
        const order = orders[index];
        if (order && order.status === 'active') {
          orderMap.set(id, order);
        } else {
          // Order doesn't exist or is no longer active - remove from cache
          this.activeOrderIds.delete(id);
        }
      });

      // Check each active order for fill conditions
      for (const [orderId, order] of Array.from(orderMap.entries())) {
        let isFilled = false;

        // For long orders (buy orders): filled if current price dropped to or below the limit price
        // For short orders (sell orders): filled if current price rose to or above the limit price
        if (order.type === 'long' && this.currentBtcPrice <= order.price) {
          isFilled = true;
        } else if (order.type === 'short' && this.currentBtcPrice >= order.price) {
          isFilled = true;
        }

        if (isFilled) {
          // Mark order as filled - use the returned updated order
          const updatedOrder = await storage.updateOrderStatus(order.id, 'filled', this.currentBtcPrice);

          // Remove from active orders cache
          this.activeOrderIds.delete(order.id);
          
          // MEMORY LEAK FIX: Clear orderLastSeen entry for filled orders
          this.orderLastSeen.delete(order.id);
          
          // MEMORY LEAK FIX: Remove from per-exchange cache
          const exchangeCache = this.activeOrdersByExchange.get(order.exchange);
          if (exchangeCache) {
            exchangeCache.delete(order.id);
          }

          // Broadcast the updated order (with fillPrice and filledAt) to WebSocket clients
          // Also trigger cache invalidation
          if (this.wss && updatedOrder) {
            const message = JSON.stringify({
              type: 'order_filled',
              order: updatedOrder,
            });

            this.wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(message);
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to check filled orders:', error);
    }
  }

  stop() {
    // Clear all exchange polling intervals
    for (const [exchangeId, interval] of Array.from(this.intervals.entries())) {
      clearInterval(interval);
      console.log(`[OrderGenerator] Stopped polling ${exchangeId}`);
    }
    this.intervals.clear();
  }


  private async updateBitcoinPrice() {
    try {
      const newPrice = await binancePriceService.getCurrentPrice();
      // Only update if we got a valid price
      if (typeof newPrice === 'number' && newPrice > 0 && !isNaN(newPrice)) {
        this.currentBtcPrice = newPrice;
      }
    } catch (error) {
      console.error('Failed to update Bitcoin price:', error);
      // Keep using last known valid price
    }
  }

  private async fetchWhaleOrders(exchangeId: Exclude<Exchange, 'all'>) {
    // Check circuit breaker
    if (!this.canPollExchange(exchangeId)) {
      return;
    }
    
    try {
      // Find exchange config
      const config = this.exchangeConfigs.find(c => c.id === exchangeId);
      if (!config) {
        console.error(`[OrderGenerator] No config found for ${exchangeId}`);
        return;
      }
      
      // Validate currentBtcPrice
      const validReferencePrice = (typeof this.currentBtcPrice === 'number' && 
                                   this.currentBtcPrice > 0 && 
                                   !isNaN(this.currentBtcPrice)) 
                                   ? this.currentBtcPrice 
                                   : 90000;
      
      // Fetch whale orders from exchange
      const whaleOrders = await config.service.getWhaleOrders(450000, validReferencePrice);
      
      // Record success
      this.recordSuccess(exchangeId);
      
      // MEMORY LEAK FIX: Use per-exchange cache instead of loading all 2,361 orders
      const exchangeCache = this.activeOrdersByExchange.get(exchangeId);
      if (!exchangeCache) {
        console.error(`[OrderGenerator] No cache found for ${exchangeId}`);
        return;
      }
      
      const existingOrdersForExchange = Array.from(exchangeCache.values());
      
      for (const whaleOrder of whaleOrders) {
        const type = whaleOrder.type === 'bid' ? 'long' : 'short';
        const roundedSize = Math.round(whaleOrder.quantity * 100) / 100;
        const roundedPrice = Math.round(whaleOrder.price * 100) / 100;
        const market = whaleOrder.market || 'spot'; // Normalize market value (default to spot)
        
        // Check for duplicates in this exchange's active orders only
        const isDuplicate = existingOrdersForExchange.some(existing => {
          const matches = existing.type === type &&
                 existing.market === market && // Use normalized market value
                 Math.abs(existing.price - roundedPrice) < 0.01 &&
                 Math.abs(existing.size - roundedSize) < 0.01;
          
          // Log when we detect and skip a duplicate
          if (matches) {
            console.log(`[DuplicateSkipped] ${exchangeId} ${type} ${market} ${roundedSize} BTC @ $${roundedPrice}`);
          }
          
          return matches;
        });
        
        if (isDuplicate) continue;
        
        const order: InsertBitcoinOrder = {
          type,
          size: roundedSize,
          price: roundedPrice,
          exchange: exchangeId,
          timestamp: new Date().toISOString(),
          status: 'active',
          market, // Use normalized market value
        };
        
        try {
          const createdOrder = await storage.createOrder(order);
          this.activeOrderIds.add(createdOrder.id);
          
          // MEMORY LEAK FIX: Add to per-exchange cache
          exchangeCache.set(createdOrder.id, createdOrder);
          
          // Broadcast to WebSocket clients
          if (this.wss) {
            const message = JSON.stringify({
              type: 'new_order',
              order: createdOrder,
            });
            
            this.wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(message);
              }
            });
          }
        } catch (error: any) {
          // Database-level unique constraint prevents race condition duplicates
          if (error?.code === '23505') {
            console.log(`[DuplicateBlocked] ${exchangeId} ${type} ${market} ${roundedSize} BTC @ $${roundedPrice} - DB constraint`);
          } else {
            throw error; // Re-throw if it's not a duplicate error
          }
        }
      }
      
      // VERIFY EXISTING ORDERS: Mark orders as "deleted" if they're no longer on the exchange books
      // Grace period: 60 seconds (prevents false deletions from temporary API hiccups)
      const GRACE_PERIOD_MS = 60 * 1000;
      const now = Date.now();
      
      // MEMORY LEAK FIX: Use per-exchange cache instead of loading all orders
      // Cache already includes newly created orders from the loop above
      const activeOrdersForExchange = Array.from(exchangeCache.values());
      
      for (const existingOrder of activeOrdersForExchange) {
        // Check if this order still exists in the current whale orders from exchange
        const stillExists = whaleOrders.some(whaleOrder => {
          const type = whaleOrder.type === 'bid' ? 'long' : 'short';
          const roundedSize = Math.round(whaleOrder.quantity * 100) / 100;
          const roundedPrice = Math.round(whaleOrder.price * 100) / 100;
          const market = whaleOrder.market || 'spot';
          
          return existingOrder.type === type &&
                 existingOrder.market === market &&
                 Math.abs(existingOrder.price - roundedPrice) < 0.01 &&
                 Math.abs(existingOrder.size - roundedSize) < 0.01;
        });
        
        if (stillExists) {
          // Order still exists - update last seen timestamp
          this.orderLastSeen.set(existingOrder.id, now);
        } else {
          // Order not found in current poll - check grace period before deleting
          const lastSeen = this.orderLastSeen.get(existingOrder.id);
          
          if (!lastSeen) {
            // First time missing - record current time as "last seen"
            this.orderLastSeen.set(existingOrder.id, now);
          } else if (now - lastSeen > GRACE_PERIOD_MS) {
            // Missing for more than grace period - mark as deleted
            await storage.updateOrderStatus(existingOrder.id, 'deleted');
            this.activeOrderIds.delete(existingOrder.id);
            this.orderLastSeen.delete(existingOrder.id);
            
            // MEMORY LEAK FIX: Remove from per-exchange cache
            exchangeCache.delete(existingOrder.id);
            
            console.log(`[OrderDeleted] ${exchangeId} ${existingOrder.type} ${existingOrder.market} ${existingOrder.size} BTC @ $${existingOrder.price}`);
          }
          // If within grace period, do nothing - wait for next poll
        }
      }
    } catch (error) {
      console.error(`Failed to fetch whale orders from ${exchangeId}:`, error);
      this.recordFailure(exchangeId);
    }
  }
}

const orderGenerator = new OrderGenerator();

// Simple in-memory cache for dashboard data (8s TTL)
interface DashboardCache {
  data: {
    baseOrders: BitcoinOrder[];
  };
  timestamp: number;
  filterKey: string;
}

const dashboardCache = new Map<string, DashboardCache>();
const CACHE_TTL = 8000; // 8 seconds

function getDashboardCacheKey(filters: {
  minSize: number;
  orderType: string;
  exchange: string;
  timeRange: string;
  status: string;
}): string {
  return JSON.stringify(filters);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Consolidated dashboard API endpoint (replaces multiple /api/orders calls)
  app.get("/api/dashboard", async (req, res) => {
    try {
      // Parse filters (same as /api/orders)
      let minSize = 0;
      let orderType: 'long' | 'short' | 'all' = 'all';
      let exchange: 'binance' | 'kraken' | 'coinbase' | 'okx' | 'all' = 'all';
      let timeRange: '1h' | '4h' | '24h' | '7d' = '24h';
      let status: 'active' | 'filled' | 'all' = 'all';
      
      if (req.query.minSize) {
        const parsed = parseFloat(req.query.minSize as string);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({ error: 'Invalid minSize parameter' });
        }
        minSize = parsed;
      }
      
      if (req.query.orderType) {
        const type = req.query.orderType as string;
        if (!['long', 'short', 'all'].includes(type)) {
          return res.status(400).json({ error: 'Invalid orderType parameter' });
        }
        orderType = type as 'long' | 'short' | 'all';
      }
      
      if (req.query.exchange) {
        const exch = req.query.exchange as string;
        if (!['binance', 'kraken', 'coinbase', 'okx', 'all'].includes(exch)) {
          return res.status(400).json({ error: 'Invalid exchange parameter' });
        }
        exchange = exch as 'binance' | 'kraken' | 'coinbase' | 'okx' | 'all';
      }
      
      if (req.query.timeRange) {
        const range = req.query.timeRange as string;
        if (!['1h', '4h', '24h', '7d'].includes(range)) {
          return res.status(400).json({ error: 'Invalid timeRange parameter' });
        }
        timeRange = range as '1h' | '4h' | '24h' | '7d';
      }

      if (req.query.status) {
        const st = req.query.status as string;
        if (!['active', 'filled', 'all'].includes(st)) {
          return res.status(400).json({ error: 'Invalid status parameter' });
        }
        status = st as 'active' | 'filled' | 'all';
      }
      
      // Cache key based only on exchange + timeRange (the base dataset filters)
      // This allows sharing cached data across different minSize/orderType/status filters
      const baseCacheKey = JSON.stringify({ exchange, timeRange });
      const cached = dashboardCache.get(baseCacheKey);
      
      let allOrders: BitcoinOrder[];
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        // Use cached base dataset
        allOrders = cached.data.baseOrders;
      } else {
        // Fetch base dataset from DB (only exchange + timeRange filters)
        allOrders = await storage.getFilteredOrders({
          minSize: 0,
          orderType: 'all',
          exchange,
          timeRange,
          status: 'all',
        });
        
        // Cache the base dataset
        dashboardCache.set(baseCacheKey, {
          data: { baseOrders: allOrders },
          timestamp: Date.now(),
          filterKey: baseCacheKey,
        });
        
        // Clean old cache entries (keep last 10)
        if (dashboardCache.size > 10) {
          const entries = Array.from(dashboardCache.entries());
          entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
          for (let i = 0; i < entries.length - 10; i++) {
            dashboardCache.delete(entries[i][0]);
          }
        }
      }
      
      // Derive filtered views from cached dataset (in-memory filtering is fast)
      const filteredOrders = allOrders.filter(order => {
        if (minSize > 0 && order.size < minSize) return false;
        if (orderType !== 'all' && order.type !== orderType) return false;
        if (status !== 'all' && order.status !== status) return false;
        return true;
      });
      
      // Calculate price snapshot from most recent order in base dataset
      const sortedOrders = [...allOrders].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      const priceSnapshot = sortedOrders[0]?.price || 93000;
      
      // Get major whales (100+ BTC, both active and filled) from base dataset
      // Component will split them into active/filled sections on frontend
      const majorWhales = allOrders
        .filter(order => order.size >= 100)
        .sort((a, b) => b.size - a.size);
      
      // Get all active orders for Price Clusters (unaffected by user filters)
      // This ensures accurate support/resistance zones
      const allActiveOrders = allOrders.filter(order => order.status === 'active');
      
      const result = {
        filteredOrders,
        priceSnapshot,
        majorWhales,
        allActiveOrders,
      };
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // API endpoint to fetch all orders with optional filtering
  app.get("/api/orders", async (req, res) => {
    try {
      // Validate and parse query parameters
      let minSize = 0;
      let orderType: 'long' | 'short' | 'all' = 'all';
      let exchange: 'binance' | 'kraken' | 'coinbase' | 'okx' | 'all' = 'all';
      let timeRange: '1h' | '4h' | '24h' | '7d' = '24h';
      let status: 'active' | 'filled' | 'all' = 'all';
      let minPrice: number | undefined = undefined;
      let maxPrice: number | undefined = undefined;
      
      if (req.query.minSize) {
        const parsed = parseFloat(req.query.minSize as string);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({ error: 'Invalid minSize parameter' });
        }
        minSize = parsed;
      }
      
      if (req.query.orderType) {
        const type = req.query.orderType as string;
        if (!['long', 'short', 'all'].includes(type)) {
          return res.status(400).json({ error: 'Invalid orderType parameter (must be long, short, or all)' });
        }
        orderType = type as 'long' | 'short' | 'all';
      }
      
      if (req.query.exchange) {
        const exch = req.query.exchange as string;
        if (!['binance', 'kraken', 'coinbase', 'okx', 'all'].includes(exch)) {
          return res.status(400).json({ error: 'Invalid exchange parameter' });
        }
        exchange = exch as 'binance' | 'kraken' | 'coinbase' | 'okx' | 'all';
      }
      
      if (req.query.timeRange) {
        const range = req.query.timeRange as string;
        if (!['1h', '4h', '24h', '7d'].includes(range)) {
          return res.status(400).json({ error: 'Invalid timeRange parameter (must be 1h, 4h, 24h, or 7d)' });
        }
        timeRange = range as '1h' | '4h' | '24h' | '7d';
      }

      if (req.query.status) {
        const st = req.query.status as string;
        if (!['active', 'filled', 'all'].includes(st)) {
          return res.status(400).json({ error: 'Invalid status parameter (must be active, filled, or all)' });
        }
        status = st as 'active' | 'filled' | 'all';
      }
      
      if (req.query.minPrice) {
        const parsed = parseFloat(req.query.minPrice as string);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({ error: 'Invalid minPrice parameter' });
        }
        minPrice = parsed;
      }
      
      if (req.query.maxPrice) {
        const parsed = parseFloat(req.query.maxPrice as string);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({ error: 'Invalid maxPrice parameter' });
        }
        maxPrice = parsed;
      }
      
      // Validate price range
      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
        return res.status(400).json({ error: 'minPrice cannot be greater than maxPrice' });
      }
      
      // Get filtered orders from storage
      const orders = await storage.getFilteredOrders({
        minSize,
        orderType,
        exchange,
        timeRange,
        status,
        minPrice,
        maxPrice,
      });
      
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  // API endpoint for filled order flow analysis
  app.get("/api/filled-order-analysis", async (req, res) => {
    try {
      // Get time range for analysis (default 30m for most relevant signals)
      let timeRange: 'all' | '30m' | '1h' | '4h' | '24h' | '7d' = '30m';
      if (req.query.timeRange) {
        const tr = req.query.timeRange as string;
        if (!['30m', '1h', '4h', '24h', '7d', 'all'].includes(tr)) {
          return res.status(400).json({ error: 'Invalid timeRange parameter' });
        }
        timeRange = tr as typeof timeRange;
      }

      // Get minimum size filter (default 5 BTC to match whale threshold)
      let minSize = 5;
      if (req.query.minSize) {
        const parsed = parseFloat(req.query.minSize as string);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({ error: 'Invalid minSize parameter' });
        }
        minSize = parsed;
      }

      // Get exchange filter (default all)
      let exchange: Exchange = 'all';
      if (req.query.exchange) {
        const ex = req.query.exchange as string;
        if (!['binance', 'kraken', 'coinbase', 'okx', 'bybit', 'bitfinex', 'gemini', 'bitstamp', 'htx', 'kucoin', 'all'].includes(ex)) {
          return res.status(400).json({ error: 'Invalid exchange parameter' });
        }
        exchange = ex as Exchange;
      }

      // Fetch only filled orders
      const filledOrders = await storage.getFilteredOrders({
        minSize,
        orderType: 'all',
        exchange,
        timeRange,
        status: 'filled',
      });

      // Calculate volume-weighted metrics with TIME-DECAY weighting
      // Recent executions matter more for predicting current market direction
      let totalLongVolume = 0;
      let totalShortVolume = 0;
      let longOrderCount = 0;
      let shortOrderCount = 0;

      // Track execution price levels for heatmap
      const priceLevels: Record<string, { price: number; longVolume: number; shortVolume: number; count: number }> = {};

      const now = Date.now();
      
      filledOrders.forEach(order => {
        // Calculate time-decay weight: recent fills have higher impact on VOLUME
        // Using exponential decay: weight = e^(-λ * age_in_hours)
        // λ = 2.0 means: 5min old = 85% weight, 10min = 71%, 30min = 37%, 1hr = 14%, 2hr = 2%
        const filledTime = order.filledAt ? new Date(order.filledAt).getTime() : new Date(order.timestamp).getTime();
        const ageInHours = (now - filledTime) / (1000 * 60 * 60);
        const decayRate = 2.0;
        const timeWeight = Math.exp(-decayRate * ageInHours);
        
        // Apply time-weight to VOLUME only (not order counts - those remain integers)
        const weightedVolume = order.size * timeWeight;
        
        if (order.type === 'long') {
          totalLongVolume += weightedVolume;
          longOrderCount++; // Keep as integer count
        } else {
          totalShortVolume += weightedVolume;
          shortOrderCount++; // Keep as integer count
        }

        // Group by $1000 price buckets for execution levels
        const fillPrice = order.fillPrice || order.price;
        const priceLevel = Math.floor(fillPrice / 1000) * 1000;
        const levelKey = priceLevel.toString();

        if (!priceLevels[levelKey]) {
          priceLevels[levelKey] = {
            price: priceLevel,
            longVolume: 0,
            shortVolume: 0,
            count: 0,
          };
        }

        if (order.type === 'long') {
          priceLevels[levelKey].longVolume += weightedVolume;
        } else {
          priceLevels[levelKey].shortVolume += weightedVolume;
        }
        priceLevels[levelKey].count++; // Keep as integer count
      });

      const totalVolume = totalLongVolume + totalShortVolume;

      // Calculate volume-weighted percentages
      const longPercentage = totalVolume > 0 ? (totalLongVolume / totalVolume) * 100 : 50;
      const shortPercentage = totalVolume > 0 ? (totalShortVolume / totalVolume) * 100 : 50;

      // Determine signal strength and direction
      let signal: 'strong_accumulation' | 'accumulation' | 'neutral' | 'distribution' | 'strong_distribution';
      let signalStrength: number;

      const difference = Math.abs(longPercentage - shortPercentage);

      if (longPercentage > shortPercentage) {
        // More longs filling = whales buying dips = bullish
        if (difference >= 40) {
          signal = 'strong_accumulation';
          signalStrength = 100;
        } else if (difference >= 20) {
          signal = 'accumulation';
          signalStrength = 70;
        } else {
          signal = 'neutral';
          signalStrength = 50;
        }
      } else {
        // More shorts filling = whales selling rallies = bearish
        if (difference >= 40) {
          signal = 'strong_distribution';
          signalStrength = 100;
        } else if (difference >= 20) {
          signal = 'distribution';
          signalStrength = 70;
        } else {
          signal = 'neutral';
          signalStrength = 50;
        }
      }

      // Convert price levels to sorted array
      const executionLevels = Object.values(priceLevels)
        .sort((a, b) => b.price - a.price) // Sort by price descending
        .map(level => ({
          price: level.price,
          longVolume: level.longVolume,
          shortVolume: level.shortVolume,
          totalVolume: level.longVolume + level.shortVolume,
          orderCount: level.count,
          dominantType: level.longVolume > level.shortVolume ? 'long' : level.shortVolume > level.longVolume ? 'short' : 'mixed',
        }));

      // Response with comprehensive analysis
      res.json({
        timeRange,
        totalOrders: filledOrders.length,
        totalVolume,
        longVolume: totalLongVolume,
        shortVolume: totalShortVolume,
        longPercentage,
        shortPercentage,
        longOrderCount,
        shortOrderCount,
        signal,
        signalStrength,
        executionLevels,
        recentOrders: filledOrders.slice(0, 10), // Most recent 10 filled orders
      });
    } catch (error) {
      console.error('Error analyzing filled orders:', error);
      res.status(500).json({ error: 'Failed to analyze filled orders' });
    }
  });

  // API endpoint for intelligent entry point recommendations
  app.get("/api/entry-points", async (req, res) => {
    try {
      // Get exchange filter (default all)
      let exchange: Exchange = 'all';
      if (req.query.exchange) {
        const ex = req.query.exchange as string;
        if (!['binance', 'kraken', 'coinbase', 'okx', 'bybit', 'bitfinex', 'gemini', 'bitstamp', 'htx', 'kucoin', 'all'].includes(ex)) {
          return res.status(400).json({ error: 'Invalid exchange parameter' });
        }
        exchange = ex as Exchange;
      }

      // Fetch filled order flow analysis (last 30m for most relevant signals)
      // Focus on BIG whale orders only (50+ BTC)
      const filledOrders = await storage.getFilteredOrders({
        minSize: 50,
        orderType: 'all',
        exchange,
        timeRange: '30m',
        status: 'filled',
      });

      // Calculate time-weighted filled order flow
      let totalLongVolume = 0;
      let totalShortVolume = 0;
      const now = Date.now();
      
      filledOrders.forEach(order => {
        const filledTime = order.filledAt ? new Date(order.filledAt).getTime() : new Date(order.timestamp).getTime();
        const ageInHours = (now - filledTime) / (1000 * 60 * 60);
        const timeWeight = Math.exp(-2.0 * ageInHours);
        const weightedVolume = order.size * timeWeight;
        
        if (order.type === 'long') {
          totalLongVolume += weightedVolume;
        } else {
          totalShortVolume += weightedVolume;
        }
      });

      // Guard against divide-by-zero and NaN
      const totalFilledVolume = totalLongVolume + totalShortVolume;
      const longPercentage = totalFilledVolume > 0 ? (totalLongVolume / totalFilledVolume) * 100 : 50;
      const flowDifference = isNaN(longPercentage) ? 0 : longPercentage - 50;

      // Fetch active orders for support/resistance analysis
      // Focus on BIG whale orders only (50+ BTC) - these are the real whales
      const activeOrders = await storage.getFilteredOrders({
        minSize: 50,
        orderType: 'all',
        exchange,
        timeRange: '24h',
        status: 'active',
      });

      // Find price clusters (support/resistance zones) - group within $5000 buckets using 50+ BTC orders only
      const priceClusters: Record<string, { price: number; longVolume: number; shortVolume: number; orderCount: number }> = {};
      
      activeOrders.forEach(order => {
        const priceLevel = Math.floor(order.price / 5000) * 5000;
        const levelKey = priceLevel.toString();

        if (!priceClusters[levelKey]) {
          priceClusters[levelKey] = {
            price: priceLevel,
            longVolume: 0,
            shortVolume: 0,
            orderCount: 0,
          };
        }

        if (order.type === 'long') {
          priceClusters[levelKey].longVolume += order.size;
        } else {
          priceClusters[levelKey].shortVolume += order.size;
        }
        priceClusters[levelKey].orderCount++;
      });

      // Filter for significant clusters (2+ 50+ BTC orders OR 100+ BTC total)
      const significantClusters = Object.values(priceClusters)
        .filter(cluster => cluster.orderCount >= 2 || (cluster.longVolume + cluster.shortVolume) >= 100)
        .sort((a, b) => b.price - a.price);

      // Calculate order book imbalance using BIG orders only (50+ BTC)
      let totalLongLiquidity = 0;
      let totalShortLiquidity = 0;

      activeOrders.forEach(order => {
        if (order.type === 'long') {
          totalLongLiquidity += order.size;
        } else {
          totalShortLiquidity += order.size;
        }
      });

      // Calculate order book imbalance with proper guards
      const totalLiquidity = totalLongLiquidity + totalShortLiquidity;
      let imbalance = 0;
      if (totalLiquidity > 0) {
        imbalance = ((totalLongLiquidity - totalShortLiquidity) / totalLiquidity) * 100;
        // Guard against NaN
        if (isNaN(imbalance)) imbalance = 0;
      }

      // Get current BTC price from most recent order
      const allOrders = await storage.getFilteredOrders({
        minSize: 0,
        orderType: 'all',
        exchange,
        timeRange: '24h',
        status: 'all',
      });
      const currentPrice = allOrders.length > 0 
        ? allOrders.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].price
        : 92000;

      // Calculate order persistence (how long big orders have been open)
      // Reuse 'now' variable from filled order flow calculation
      let totalOrderAge = 0; // Sum of order ages in hours
      activeOrders.forEach(order => {
        const orderAgeMs = now - new Date(order.timestamp).getTime();
        const orderAgeHours = Math.max(0, orderAgeMs / (1000 * 60 * 60));
        totalOrderAge += orderAgeHours;
      });
      // Average age of big whale orders (in hours). Longer = more established positions
      const avgOrderAgeHours = activeOrders.length > 0 ? totalOrderAge / activeOrders.length : 0;
      // Orders older than 6 hours are more credible (not just noise)
      const persistenceFactor = Math.min(1.2, 0.8 + (Math.log10(1 + avgOrderAgeHours) * 0.1));

      // ENTRY POINT ALGORITHM
      // Combine signals to generate recommendations
      let recommendation: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
      let confidence: number;
      let entryPrice: number;
      let stopLoss: number;
      let takeProfit: number;
      let reasoning: string[];

      const signals = {
        flow: flowDifference, // Positive = bullish, Negative = bearish
        imbalance: imbalance, // Positive = buy pressure, Negative = sell pressure
        clusterCount: significantClusters.length,
      };

      // Find nearest support/resistance
      const clustersAbove = significantClusters.filter(c => c.price > currentPrice);
      const clustersBelow = significantClusters.filter(c => c.price < currentPrice);
      
      const nearestResistance = clustersAbove.length > 0 ? clustersAbove[clustersAbove.length - 1] : null;
      const nearestSupport = clustersBelow.length > 0 ? clustersBelow[0] : null;

      // VOLUME-WEIGHTED composite signal score (-100 to +100)
      // "Not every trade is equal" - weight by BTC volume
      // Use log scale to avoid extreme values: log10(1 + volume)
      // Example: 10 BTC = 1.04x, 100 BTC = 2.0x, 1000 BTC = 3.0x
      // Use TOTAL whale activity (both active and filled) for multiplier
      const totalWhaleVolume = totalFilledVolume + totalLongLiquidity + totalShortLiquidity;
      const volumeMultiplier = totalWhaleVolume > 0 
        ? Math.log10(1 + totalWhaleVolume) / 2 // Divide by 2 to keep multiplier reasonable (0.5x to 1.5x typical range)
        : 0.5;
      
      // Flow weight: 50%, Imbalance weight: 50%, scaled by volume
      const flowScore = isNaN(signals.flow) ? 0 : signals.flow;
      const imbalanceScore = isNaN(signals.imbalance) ? 0 : signals.imbalance;
      
      // Apply volume weighting to amplify/reduce signal strength
      const rawComposite = (flowScore * 0.5) + (imbalanceScore * 0.5);
      const volumeWeightedScore = rawComposite * Math.min(1.5, Math.max(0.5, volumeMultiplier));
      
      // Clamp to -100 to +100 range to prevent volume weighting from creating extreme values
      const compositeScore = Math.max(-100, Math.min(100, volumeWeightedScore));
      
      // Guard against NaN composite score
      if (isNaN(compositeScore)) {
        return res.json({
          recommendation: 'neutral',
          confidence: 30,
          currentPrice,
          entryPrice: currentPrice,
          reasoning: ['Insufficient big whale activity (50+ BTC)', 'Wait for large whale orders'],
          signals: {
            filledOrderFlow: { score: 0, signal: 'neutral' },
            orderBookImbalance: { score: 0, signal: 'balanced' },
          },
          support: nearestSupport ? nearestSupport.price : null,
          resistance: nearestResistance ? nearestResistance.price : null,
        });
      }

      reasoning = [];

      if (compositeScore >= 30) {
        // BULLISH SIGNAL - Calculate confidence for this direction
        let baseConfidence = Math.min(95, 50 + Math.abs(compositeScore));
        if (isNaN(baseConfidence)) baseConfidence = 50;
        if (totalFilledVolume < 50) baseConfidence *= 0.85; // Reduce confidence if low whale volume
        if (activeOrders.length < 3) baseConfidence *= 0.9; // Reduce confidence if few big orders
        baseConfidence *= persistenceFactor; // Boost for orders that have been stable/open longer
        confidence = Math.floor(baseConfidence);

        // Determine recommendation based on final confidence level
        // Strong buy requires 80%+ confidence, regular buy requires 50%+
        if (confidence >= 80) {
          recommendation = 'strong_buy';
          // Entry: Use nearest support for strong buy
          entryPrice = nearestSupport 
            ? nearestSupport.price 
            : Math.floor((currentPrice * 0.95) / 5000) * 5000;
          
          if (flowScore > 20) reasoning.push(`Big whales accumulating (+${flowScore.toFixed(1)}% buying)`);
          if (imbalanceScore > 15) reasoning.push(`Strong buy pressure from 50+ BTC orders (${totalLongLiquidity.toFixed(0)} BTC)`);
          if (nearestSupport) reasoning.push(`Major whale bid level at $${nearestSupport.price.toLocaleString()}`);
          
        } else if (confidence >= 50) {
          recommendation = 'buy';
          // Entry: Use nearest support for buy
          entryPrice = nearestSupport 
            ? nearestSupport.price 
            : Math.floor((currentPrice * 0.95) / 5000) * 5000;
          
          if (flowScore > 20) reasoning.push(`Big whales accumulating (+${flowScore.toFixed(1)}% buying)`);
          if (imbalanceScore > 15) reasoning.push(`Strong buy pressure from 50+ BTC orders (${totalLongLiquidity.toFixed(0)} BTC)`);
          if (nearestSupport) reasoning.push(`Major whale bid level at $${nearestSupport.price.toLocaleString()}`);
          
        } else {
          // Low confidence - downgrade to neutral with mid-range entry
          recommendation = 'neutral';
          confidence = Math.max(30, confidence);
          
          // Neutral entry: mid-range between support and resistance, or current price
          if (nearestSupport && nearestResistance) {
            entryPrice = Math.round(((nearestSupport.price + nearestResistance.price) / 2) / 5000) * 5000;
          } else {
            entryPrice = Math.round(currentPrice / 5000) * 5000;
          }
          
          reasoning.push('Weak bullish signal - insufficient confidence for buy recommendation');
          if (totalFilledVolume < 50) reasoning.push('Low whale activity (50+ BTC) - wait for bigger orders');
          if (activeOrders.length < 3) reasoning.push('Insufficient large orders for reliable levels');
        }
        
      } else if (compositeScore <= -30) {
        // BEARISH SIGNAL - Calculate confidence for this direction
        let baseConfidence = Math.min(95, 50 + Math.abs(compositeScore));
        if (isNaN(baseConfidence)) baseConfidence = 50;
        if (totalFilledVolume < 50) baseConfidence *= 0.85;
        if (activeOrders.length < 3) baseConfidence *= 0.9;
        baseConfidence *= persistenceFactor;
        confidence = Math.floor(baseConfidence);

        // Determine recommendation based on final confidence level
        // Strong sell requires 80%+ confidence, regular sell requires 50%+
        if (confidence >= 80) {
          recommendation = 'strong_sell';
          // Entry: Use nearest resistance for strong sell
          entryPrice = nearestResistance 
            ? nearestResistance.price 
            : Math.floor((currentPrice * 1.05) / 5000) * 5000;
          
          if (flowScore < -20) reasoning.push(`Big whales distributing (${Math.abs(flowScore).toFixed(1)}% selling)`);
          if (imbalanceScore < -15) reasoning.push(`Strong sell pressure from 50+ BTC orders (${totalShortLiquidity.toFixed(0)} BTC)`);
          if (nearestResistance) reasoning.push(`Major whale ask level at $${nearestResistance.price.toLocaleString()}`);
          
        } else if (confidence >= 50) {
          recommendation = 'sell';
          // Entry: Use nearest resistance for sell
          entryPrice = nearestResistance 
            ? nearestResistance.price 
            : Math.floor((currentPrice * 1.05) / 5000) * 5000;
          
          if (flowScore < -20) reasoning.push(`Big whales distributing (${Math.abs(flowScore).toFixed(1)}% selling)`);
          if (imbalanceScore < -15) reasoning.push(`Strong sell pressure from 50+ BTC orders (${totalShortLiquidity.toFixed(0)} BTC)`);
          if (nearestResistance) reasoning.push(`Major whale ask level at $${nearestResistance.price.toLocaleString()}`);
          
        } else {
          // Low confidence - downgrade to neutral with mid-range entry
          recommendation = 'neutral';
          confidence = Math.max(30, confidence);
          
          // Neutral entry: mid-range between support and resistance, or current price
          if (nearestSupport && nearestResistance) {
            entryPrice = Math.round(((nearestSupport.price + nearestResistance.price) / 2) / 5000) * 5000;
          } else {
            entryPrice = Math.round(currentPrice / 5000) * 5000;
          }
          
          reasoning.push('Weak bearish signal - insufficient confidence for sell recommendation');
          if (totalFilledVolume < 50) reasoning.push('Low whale activity (50+ BTC) - wait for bigger orders');
          if (activeOrders.length < 3) reasoning.push('Insufficient large orders for reliable levels');
        }
        
      } else {
        // NEUTRAL - NO CLEAR SIGNAL from the start
        recommendation = 'neutral';
        confidence = Math.max(30, Math.min(60, Math.floor(50 - Math.abs(compositeScore))));
        
        // Use weighted average of nearest support and resistance as entry point
        if (nearestSupport && nearestResistance) {
          entryPrice = Math.round(((nearestSupport.price + nearestResistance.price) / 2) / 5000) * 5000;
        } else if (nearestSupport) {
          entryPrice = nearestSupport.price;
        } else if (nearestResistance) {
          entryPrice = nearestResistance.price;
        } else {
          entryPrice = Math.round(currentPrice / 5000) * 5000;
        }
        
        reasoning.push('Mixed signals from big whale orders');
        if (totalFilledVolume < 50) reasoning.push('Low whale activity (50+ BTC) - wait for bigger orders');
        if (activeOrders.length < 3) reasoning.push('Insufficient large orders for reliable levels');
      }

      // Response with simplified recommendations based on big whale orders (50+ BTC)
      res.json({
        recommendation,
        confidence: isNaN(confidence) ? 50 : confidence,
        currentPrice,
        entryPrice,
        reasoning,
        signals: {
          filledOrderFlow: {
            score: flowScore,
            signal: flowScore > 20 ? 'bullish' : flowScore < -20 ? 'bearish' : 'neutral',
          },
          orderBookImbalance: {
            score: imbalanceScore,
            signal: imbalanceScore > 15 ? 'buy_pressure' : imbalanceScore < -15 ? 'sell_pressure' : 'balanced',
          },
        },
        support: nearestSupport ? nearestSupport.price : null,
        resistance: nearestResistance ? nearestResistance.price : null,
      });
    } catch (error) {
      console.error('Error generating entry points:', error);
      res.status(500).json({ error: 'Failed to generate entry point recommendations' });
    }
  });

  // API endpoint for whale movements
  app.get("/api/whale-movements", async (req, res) => {
    try {
      const hoursAgo = req.query.hours ? parseInt(req.query.hours as string) : 24;
      const movements = await storage.getWhaleMovements(hoursAgo);
      res.json(movements);
    } catch (error) {
      console.error('Error fetching whale movements:', error);
      res.status(500).json({ error: 'Failed to fetch whale movements' });
    }
  });

  // API endpoint for long/short ratios
  app.get("/api/long-short-ratios", async (req, res) => {
    try {
      const period = req.query.period as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const ratios = await storage.getLongShortRatios(period, limit);
      res.json(ratios);
    } catch (error) {
      console.error('Error fetching long/short ratios:', error);
      res.status(500).json({ error: 'Failed to fetch long/short ratios' });
    }
  });

  // API endpoint for latest long/short ratio
  app.get("/api/long-short-ratio/latest", async (req, res) => {
    try {
      const isTopTrader = req.query.topTrader === 'true';
      const ratio = await storage.getLatestLongShortRatio(isTopTrader);
      if (!ratio) {
        return res.status(404).json({ error: 'No ratio data available' });
      }
      res.json(ratio);
    } catch (error) {
      console.error('Error fetching latest long/short ratio:', error);
      res.status(500).json({ error: 'Failed to fetch latest long/short ratio' });
    }
  });

  // API endpoint for whale correlations
  app.get("/api/whale-correlations", async (req, res) => {
    try {
      const hoursAgo = req.query.hours ? parseInt(req.query.hours as string) : 24;
      const correlations = await storage.getWhaleCorrelations(hoursAgo);
      res.json(correlations);
    } catch (error) {
      console.error('Error fetching whale correlations:', error);
      res.status(500).json({ error: 'Failed to fetch whale correlations' });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    // Send initial data
    storage.getOrders().then((orders) => {
      const message = JSON.stringify({
        type: 'initial_data',
        orders,
      });
      ws.send(message);
    });
  });

  // Start order generator
  orderGenerator.start(wss);
  
  // Start whale correlation tracking service
  // whaleCorrelationService.start();

  return httpServer;
}
