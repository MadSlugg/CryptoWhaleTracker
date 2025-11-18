import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { InsertBitcoinOrder, BitcoinOrder } from "@shared/schema";
import { calculateProfitLoss } from "@shared/schema";
import { binanceService, type OrderBookEntry } from "./binance";
import { krakenService, coinbaseService, okxService } from "./exchange-services";
import { whaleCorrelationService } from "./whale-correlation-service";

// Real whale order tracker from multiple exchanges
class OrderGenerator {
  private binanceIntervalId: NodeJS.Timeout | null = null;
  private krakenIntervalId: NodeJS.Timeout | null = null;
  private coinbaseIntervalId: NodeJS.Timeout | null = null;
  private okxIntervalId: NodeJS.Timeout | null = null;
  private wss: WebSocketServer | null = null;
  private seenOrderBookEntries: Set<string> = new Set();
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

    // Clean old orders every hour and sync cache
    setInterval(async () => {
      const deletedIds = await storage.clearOldOrders(24);
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
      
      for (const whaleOrder of whaleOrders) {
        // Create unique key including exchange to avoid duplicates
        const entryKey = `${exchange}-${whaleOrder.type}-${whaleOrder.price.toFixed(2)}-${whaleOrder.quantity.toFixed(2)}`;
        
        // Skip if we've already shown this order
        if (this.seenOrderBookEntries.has(entryKey)) {
          continue;
        }
        
        // Mark as seen
        this.seenOrderBookEntries.add(entryKey);
        
        // Clean up old entries periodically (keep last 2000 for 4 exchanges)
        if (this.seenOrderBookEntries.size > 2000) {
          const entriesToDelete = Array.from(this.seenOrderBookEntries).slice(0, 1000);
          entriesToDelete.forEach(key => this.seenOrderBookEntries.delete(key));
        }
        
        // Convert order book entry to our format
        // bid = buy order = someone going long
        // ask = sell order = someone going short
        const type = whaleOrder.type === 'bid' ? 'long' : 'short';
        
        const order: InsertBitcoinOrder = {
          type,
          size: Math.round(whaleOrder.quantity * 100) / 100,
          price: Math.round(whaleOrder.price * 100) / 100,
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

export async function registerRoutes(app: Express): Promise<Server> {
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
  whaleCorrelationService.start();

  return httpServer;
}
