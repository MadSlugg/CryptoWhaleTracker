import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { InsertBitcoinOrder, BitcoinOrder, Exchange } from "@shared/schema";
import { calculateProfitLoss } from "@shared/schema";
import { binanceService, type OrderBookEntry } from "./binance";
import { krakenService, coinbaseService, okxService } from "./exchange-services";
// import { whaleCorrelationService } from "./whale-correlation-service";

// Real whale order tracker from multiple exchanges
class OrderGenerator {
  private binanceIntervalId: NodeJS.Timeout | null = null;
  private krakenIntervalId: NodeJS.Timeout | null = null;
  private coinbaseIntervalId: NodeJS.Timeout | null = null;
  private okxIntervalId: NodeJS.Timeout | null = null;
  private wss: WebSocketServer | null = null;
  private currentBtcPrice: number = 93000; // Cache current price
  private activeOrderIds: Set<string> = new Set(); // Cache of active order IDs for fast lookup

  async start(wss: WebSocketServer) {
    this.wss = wss;
    
    // Initialize activeOrderIds cache with existing active orders
    await this.initializeActiveOrdersCache();
    
    // Fetch initial Bitcoin price
    this.updateBitcoinPrice();

    // Fetch whale orders from Binance every ~10 seconds
    this.binanceIntervalId = setInterval(() => {
      this.fetchWhaleOrders('binance');
    }, Math.random() * 4000 + 8000);

    // Fetch whale orders from Kraken every ~12 seconds (stagger to avoid spikes)
    this.krakenIntervalId = setInterval(() => {
      this.fetchWhaleOrders('kraken');
    }, Math.random() * 4000 + 10000);

    // Fetch whale orders from Coinbase every ~14 seconds
    this.coinbaseIntervalId = setInterval(() => {
      this.fetchWhaleOrders('coinbase');
    }, Math.random() * 4000 + 12000);

    // Fetch whale orders from OKX every ~16 seconds
    this.okxIntervalId = setInterval(() => {
      this.fetchWhaleOrders('okx');
    }, Math.random() * 4000 + 14000);

    // Update Bitcoin price every 5 seconds
    setInterval(() => {
      this.updateBitcoinPrice();
    }, 5000);

    // Clean old orders every hour and sync cache (keep for 7 days)
    setInterval(async () => {
      const deletedIds = await storage.clearOldOrders(168); // 7 days
      // Remove deleted order IDs from active cache
      deletedIds.forEach(id => this.activeOrderIds.delete(id));
    }, 60 * 60 * 1000);

    // Check for filled orders every 10 seconds
    setInterval(() => {
      this.checkFilledOrders();
    }, 10000);
  }

  private async initializeActiveOrdersCache() {
    try {
      const allOrders = await storage.getOrders();
      const activeOrders = allOrders.filter(o => o.status === 'active');
      this.activeOrderIds = new Set(activeOrders.map(o => o.id));
      console.log(`[OrderGenerator] Initialized with ${this.activeOrderIds.size} active orders`);
    } catch (error) {
      console.error('Failed to initialize active orders cache:', error);
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
    if (this.binanceIntervalId) clearInterval(this.binanceIntervalId);
    if (this.krakenIntervalId) clearInterval(this.krakenIntervalId);
    if (this.coinbaseIntervalId) clearInterval(this.coinbaseIntervalId);
    if (this.okxIntervalId) clearInterval(this.okxIntervalId);
    this.binanceIntervalId = null;
    this.krakenIntervalId = null;
    this.coinbaseIntervalId = null;
    this.okxIntervalId = null;
  }

  private async verifyActiveOrders(exchange: 'binance' | 'kraken' | 'coinbase' | 'okx') {
    try {
      // Get only active orders for this specific exchange (efficient - no full scan or sort)
      const activeOrdersForExchange = await storage.getActiveOrdersByExchange(exchange);

      // Fetch FULL order book (not filtered) to verify if orders still exist
      let fullOrderBook: { bids: [string, string][]; asks: [string, string][] } | null = null;
      
      try {
        switch (exchange) {
          case 'binance':
            fullOrderBook = await binanceService.getOrderBook(100);
            break;
          case 'kraken':
            const krakenData = await krakenService.getOrderBook();
            // Kraken returns [price, volume, timestamp] but we only need [price, volume]
            fullOrderBook = {
              bids: krakenData.bids.map(([price, volume]) => [price, volume]),
              asks: krakenData.asks.map(([price, volume]) => [price, volume])
            };
            break;
          case 'coinbase':
            const coinbaseData = await coinbaseService.getOrderBook();
            fullOrderBook = { bids: coinbaseData.bids, asks: coinbaseData.asks };
            break;
          case 'okx':
            const okxData = await okxService.getOrderBook();
            fullOrderBook = { bids: okxData.bids, asks: okxData.asks };
            break;
        }
      } catch (error) {
        console.error(`Failed to fetch full order book from ${exchange}:`, error);
        return; // Skip verification if we can't fetch order book
      }

      if (!fullOrderBook) return;

      // Check each active order to see if it still exists in the FULL order book
      for (const existingOrder of activeOrdersForExchange) {
        const orderBookSide = existingOrder.type === 'long' ? fullOrderBook.bids : fullOrderBook.asks;
        
        const stillExists = orderBookSide.some(([priceStr, quantityStr]) => {
          const price = parseFloat(priceStr);
          const quantity = parseFloat(quantityStr);
          const roundedSize = Math.round(quantity * 100) / 100;
          const roundedPrice = Math.round(price * 100) / 100;
          
          return (
            Math.abs(roundedPrice - existingOrder.price) < 0.01 && // Price within 1 cent
            Math.abs(roundedSize - existingOrder.size) < 0.01 // Size within 0.01 BTC
          );
        });

        // If order vanished from the order book, delete it
        if (!stillExists) {
          await storage.deleteOrder(existingOrder.id);
          this.activeOrderIds.delete(existingOrder.id);

          // Broadcast deletion to WebSocket clients
          if (this.wss) {
            const message = JSON.stringify({
              type: 'order_deleted',
              orderId: existingOrder.id,
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
      console.error(`Failed to verify active orders for ${exchange}:`, error);
    }
  }

  private async updateBitcoinPrice() {
    try {
      const newPrice = await binanceService.getCurrentPrice();
      // Only update if we got a valid price
      if (typeof newPrice === 'number' && newPrice > 0 && !isNaN(newPrice)) {
        this.currentBtcPrice = newPrice;
      }
    } catch (error) {
      console.error('Failed to update Bitcoin price:', error);
      // Keep using last known valid price
    }
  }

  private async fetchWhaleOrders(exchange: 'binance' | 'kraken' | 'coinbase' | 'okx') {
    try {
      // Fetch orders with $450k+ notional value from the specified exchange
      // Use current BTC price as reference to filter out stale/outlier prices
      let whaleOrders: OrderBookEntry[] = [];
      
      // Validate currentBtcPrice is a valid number, fallback to default if not
      const validReferencePrice = (typeof this.currentBtcPrice === 'number' && 
                                   this.currentBtcPrice > 0 && 
                                   !isNaN(this.currentBtcPrice)) 
                                   ? this.currentBtcPrice 
                                   : 90000;
      
      switch (exchange) {
        case 'binance':
          whaleOrders = await binanceService.getWhaleOrders(450000, validReferencePrice);
          break;
        case 'kraken':
          whaleOrders = await krakenService.getWhaleOrders(450000, validReferencePrice);
          break;
        case 'coinbase':
          whaleOrders = await coinbaseService.getWhaleOrders(450000, validReferencePrice);
          break;
        case 'okx':
          whaleOrders = await okxService.getWhaleOrders(450000, validReferencePrice);
          break;
      }
      
      // Verify existing active orders from this exchange still exist in the FULL order book
      // Note: This is separate from whaleOrders filtering - we check the complete order book
      await this.verifyActiveOrders(exchange);
      
      for (const whaleOrder of whaleOrders) {
        // Convert order book entry to our format
        // bid = buy order = someone going long
        // ask = sell order = someone going short
        const type = whaleOrder.type === 'bid' ? 'long' : 'short';
        const roundedSize = Math.round(whaleOrder.quantity * 100) / 100;
        const roundedPrice = Math.round(whaleOrder.price * 100) / 100;
        
        // Check if order already exists (prevent duplicates)
        // Check against BOTH active orders AND recently filled orders (last 5 minutes)
        // This prevents re-creating the same order when a whale re-places immediately after fill
        const existingOrders = await storage.getOrders();
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const isDuplicate = existingOrders.some(existing => {
          const isRecentlyFilled = existing.status === 'filled' && 
                                   existing.filledAt && 
                                   new Date(existing.filledAt) > fiveMinutesAgo;
          const isActive = existing.status === 'active';
          
          return existing.exchange === exchange &&
                 existing.type === type &&
                 Math.abs(existing.price - roundedPrice) < 0.01 && // Price within 1 cent
                 Math.abs(existing.size - roundedSize) < 0.01 && // Size within 0.01 BTC
                 (isActive || isRecentlyFilled); // Check active OR recently filled (last 5 min)
        });
        
        // Skip if duplicate found
        if (isDuplicate) {
          continue;
        }
        
        const order: InsertBitcoinOrder = {
          type,
          size: roundedSize,
          price: roundedPrice,
          exchange,
          timestamp: new Date().toISOString(),
          status: 'active',
        };
        
        const createdOrder = await storage.createOrder(order);
        
        // Add to active orders cache
        this.activeOrderIds.add(createdOrder.id);
        
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
      }
    } catch (error) {
      console.error(`Failed to fetch whale orders from ${exchange}:`, error);
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
      
      // Get major whales (100+ BTC) from base dataset
      const majorWhales = allOrders
        .filter(order => order.size >= 100)
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);
      
      const result = {
        filteredOrders,
        priceSnapshot,
        majorWhales,
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
        if (!['binance', 'kraken', 'coinbase', 'okx', 'all'].includes(ex)) {
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
        if (!['binance', 'kraken', 'coinbase', 'okx', 'all'].includes(ex)) {
          return res.status(400).json({ error: 'Invalid exchange parameter' });
        }
        exchange = ex as Exchange;
      }

      // Fetch filled order flow analysis (last 30m for most relevant signals)
      const filledOrders = await storage.getFilteredOrders({
        minSize: 5,
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
      const activeOrders = await storage.getFilteredOrders({
        minSize: 10,
        orderType: 'all',
        exchange,
        timeRange: '24h',
        status: 'active',
      });

      // Find price clusters (support/resistance zones) - group within $2000 buckets
      const priceClusters: Record<string, { price: number; longVolume: number; shortVolume: number; orderCount: number }> = {};
      
      activeOrders.forEach(order => {
        const priceLevel = Math.floor(order.price / 2000) * 2000;
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

      // Filter for significant clusters only (2+ orders OR 50+ BTC)
      const significantClusters = Object.values(priceClusters)
        .filter(cluster => cluster.orderCount >= 2 || (cluster.longVolume + cluster.shortVolume) >= 50)
        .sort((a, b) => b.price - a.price);

      // Calculate order book imbalance
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
      const volumeMultiplier = totalFilledVolume > 0 
        ? Math.log10(1 + totalFilledVolume) / 2 // Divide by 2 to keep multiplier reasonable (0.5x to 1.5x typical range)
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
          entry: { price: currentPrice, type: 'WAIT' },
          stopLoss: Math.floor(currentPrice * 0.98),
          takeProfit: Math.floor(currentPrice * 1.02),
          riskReward: 1.0,
          reasoning: ['Insufficient data for analysis', 'Wait for more whale activity'],
          signals: {
            filledOrderFlow: { score: 0, signal: 'neutral' },
            orderBookImbalance: { score: 0, signal: 'balanced' },
          },
          keyLevels: {
            nearestSupport: nearestSupport ? nearestSupport.price : null,
            nearestResistance: nearestResistance ? nearestResistance.price : null,
          },
        });
      }

      reasoning = [];

      if (compositeScore >= 30) {
        // LONG SIGNAL (BUY)
        recommendation = compositeScore >= 50 ? 'strong_buy' : 'buy';
        
        // Reduce confidence if insufficient data
        let baseConfidence = Math.min(95, 50 + Math.abs(compositeScore));
        if (isNaN(baseConfidence)) baseConfidence = 50;
        if (totalFilledVolume < 10) baseConfidence *= 0.8; // Reduce confidence if low volume
        if (activeOrders.length < 5) baseConfidence *= 0.9; // Reduce confidence if few orders
        confidence = Math.floor(baseConfidence);
        
        // Entry: Buy at current price or near support
        entryPrice = nearestSupport && nearestSupport.price < currentPrice
          ? nearestSupport.price 
          : Math.floor(currentPrice * 0.995);
        
        // LONG position: Stop loss MUST be BELOW entry
        const defaultStop = Math.floor(entryPrice * 0.98);
        if (nearestSupport && nearestSupport.price < entryPrice) {
          stopLoss = Math.min(defaultStop, Math.floor(nearestSupport.price * 0.98));
        } else {
          stopLoss = defaultStop;
        }
        
        // LONG position: Take profit MUST be ABOVE entry
        const defaultTarget = Math.floor(entryPrice * 1.04);
        if (nearestResistance && nearestResistance.price > entryPrice) {
          takeProfit = Math.max(defaultTarget, Math.floor(nearestResistance.price * 0.99));
        } else {
          takeProfit = defaultTarget;
        }
        
        // Validate: ensure stop < entry < target for LONG
        if (stopLoss >= entryPrice) stopLoss = Math.floor(entryPrice * 0.98);
        if (takeProfit <= entryPrice) takeProfit = Math.floor(entryPrice * 1.04);

        if (flowScore > 20) reasoning.push(`Whales accumulating (+${flowScore.toFixed(1)}% buying)`);
        if (imbalanceScore > 15) reasoning.push(`Strong buy pressure (${imbalanceScore.toFixed(1)}% imbalance)`);
        if (nearestSupport) reasoning.push(`Strong support at $${nearestSupport.price.toLocaleString()}`);
        
      } else if (compositeScore <= -30) {
        // SHORT SIGNAL (SELL)
        recommendation = compositeScore <= -50 ? 'strong_sell' : 'sell';
        
        // Reduce confidence if insufficient data
        let baseConfidence = Math.min(95, 50 + Math.abs(compositeScore));
        if (isNaN(baseConfidence)) baseConfidence = 50;
        if (totalFilledVolume < 10) baseConfidence *= 0.8;
        if (activeOrders.length < 5) baseConfidence *= 0.9;
        confidence = Math.floor(baseConfidence);
        
        // Entry: Sell at current price or near resistance
        entryPrice = nearestResistance && nearestResistance.price > currentPrice
          ? nearestResistance.price 
          : Math.floor(currentPrice * 1.005);
        
        // SHORT position: Calculate stop and target with defaults
        let tempStop = Math.floor(entryPrice * 1.02);
        let tempTarget = Math.floor(entryPrice * 0.96);
        
        // Adjust based on support/resistance if available
        if (nearestResistance && nearestResistance.price > entryPrice) {
          tempStop = Math.max(tempStop, Math.floor(nearestResistance.price * 1.02));
        }
        if (nearestSupport && nearestSupport.price < entryPrice) {
          tempTarget = Math.min(tempTarget, Math.floor(nearestSupport.price * 1.01));
        }
        
        // STRICT validation for SHORT: target < entry < stop
        if (tempTarget >= entryPrice) tempTarget = Math.floor(entryPrice * 0.96);
        if (tempStop <= entryPrice) tempStop = Math.floor(entryPrice * 1.02);
        
        // Final verification
        if (tempTarget >= entryPrice || tempStop <= entryPrice || tempTarget >= tempStop) {
          // Fallback to safe defaults if any validation fails
          tempStop = Math.floor(entryPrice * 1.02);
          tempTarget = Math.floor(entryPrice * 0.96);
        }
        
        stopLoss = tempStop;
        takeProfit = tempTarget;

        if (flowScore < -20) reasoning.push(`Whales distributing (${Math.abs(flowScore).toFixed(1)}% selling)`);
        if (imbalanceScore < -15) reasoning.push(`Strong sell pressure (${Math.abs(imbalanceScore).toFixed(1)}% imbalance)`);
        if (nearestResistance) reasoning.push(`Strong resistance at $${nearestResistance.price.toLocaleString()}`);
        
      } else {
        // NEUTRAL - NO CLEAR ENTRY
        recommendation = 'neutral';
        let neutralConfidence = 50 - Math.abs(compositeScore);
        if (isNaN(neutralConfidence)) neutralConfidence = 30;
        confidence = Math.max(30, Math.floor(neutralConfidence));
        
        entryPrice = currentPrice;
        stopLoss = Math.floor(currentPrice * 0.98);
        takeProfit = Math.floor(currentPrice * 1.02);
        
        reasoning.push('Mixed signals - whales not showing clear direction');
        if (totalFilledVolume < 10) reasoning.push('Low filled order volume - wait for more whale activity');
        if (activeOrders.length < 5) reasoning.push('Insufficient active orders for reliable support/resistance');
      }

      // Calculate risk/reward with comprehensive guards
      const risk = Math.abs(entryPrice - stopLoss);
      const reward = Math.abs(takeProfit - entryPrice);
      
      let riskReward = 1.0; // Default for WAIT/neutral
      if (risk > 0 && reward > 0) {
        riskReward = reward / risk;
      } else if (risk === 0 || reward === 0) {
        // WAIT state or invalid configuration - default to 1:1
        riskReward = 1.0;
      }
      
      // Response with actionable recommendations
      res.json({
        recommendation,
        confidence: isNaN(confidence) ? 50 : confidence,
        currentPrice,
        entry: {
          price: entryPrice,
          type: recommendation.includes('buy') ? 'LONG' : recommendation.includes('sell') ? 'SHORT' : 'WAIT',
        },
        stopLoss,
        takeProfit,
        riskReward: isNaN(riskReward) ? 1.0 : riskReward,
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
        keyLevels: {
          nearestSupport: nearestSupport ? nearestSupport.price : null,
          nearestResistance: nearestResistance ? nearestResistance.price : null,
        },
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
