import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { InsertBitcoinOrder } from "@shared/schema";
import { calculateProfitLoss } from "@shared/schema";
import { binanceService, type OrderBookEntry } from "./binance";
import { liquidationService } from "./liquidation-service";
import { whaleCorrelationService } from "./whale-correlation-service";

// Simulated order generator with real Binance data
class OrderGenerator {
  private intervalId: NodeJS.Timeout | null = null;
  private closeIntervalId: NodeJS.Timeout | null = null;
  private whaleIntervalId: NodeJS.Timeout | null = null;
  private wss: WebSocketServer | null = null;
  private seenOrderBookEntries: Set<string> = new Set();
  private currentBtcPrice: number = 93000; // Cache current price

  start(wss: WebSocketServer) {
    this.wss = wss;
    
    // Fetch initial Bitcoin price
    this.updateBitcoinPrice();
    
    // Generate initial orders
    this.generateBatch(15);
    
    // Generate new simulated order every ~12.5 seconds (static interval)
    this.intervalId = setInterval(() => {
      this.generateOrder();
    }, Math.random() * 5000 + 10000);

    // Fetch real whale orders from Binance every ~10 seconds (static interval)
    this.whaleIntervalId = setInterval(() => {
      this.fetchRealWhaleOrders();
    }, Math.random() * 4000 + 8000);

    // Update Bitcoin price every 5 seconds
    setInterval(() => {
      this.updateBitcoinPrice();
    }, 5000);

    // Close random positions every 5-15 seconds
    this.closeIntervalId = setInterval(() => {
      this.closeRandomPosition();
    }, Math.random() * 10000 + 5000);

    // Clean old orders every hour
    setInterval(() => {
      storage.clearOldOrders(24);
    }, 60 * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.closeIntervalId) {
      clearInterval(this.closeIntervalId);
      this.closeIntervalId = null;
    }
    if (this.whaleIntervalId) {
      clearInterval(this.whaleIntervalId);
      this.whaleIntervalId = null;
    }
  }

  private async updateBitcoinPrice() {
    try {
      this.currentBtcPrice = await binanceService.getCurrentPrice();
    } catch (error) {
      console.error('Failed to update Bitcoin price:', error);
    }
  }

  private async fetchRealWhaleOrders() {
    try {
      // Fetch orders with $450k+ notional value (approx 5 BTC at $90k)
      const whaleOrders = await binanceService.getWhaleOrders(450000);
      
      for (const whaleOrder of whaleOrders) {
        // Create unique key for this order book entry
        const entryKey = `${whaleOrder.type}-${whaleOrder.price.toFixed(2)}-${whaleOrder.quantity.toFixed(2)}`;
        
        // Skip if we've already shown this order
        if (this.seenOrderBookEntries.has(entryKey)) {
          continue;
        }
        
        // Mark as seen
        this.seenOrderBookEntries.add(entryKey);
        
        // Clean up old entries periodically (keep last 1000)
        if (this.seenOrderBookEntries.size > 1000) {
          const entriesToDelete = Array.from(this.seenOrderBookEntries).slice(0, 500);
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
          timestamp: new Date().toISOString(),
          status: 'open',
        };
        
        const createdOrder = await storage.createOrder(order);
        
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
      console.error('Failed to fetch real whale orders:', error);
    }
  }

  private async generateBatch(count: number) {
    for (let i = 0; i < count; i++) {
      await this.generateOrder(false);
      // Small delay to stagger timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async generateOrder(broadcast = true) {
    // Use real Bitcoin price with small variation
    const btcPrice = this.currentBtcPrice;
    
    const type = Math.random() > 0.5 ? 'long' : 'short';
    
    // Size distribution: more whales and larger transactions
    const sizeRandom = Math.random();
    let size: number;
    if (sizeRandom < 0.2) {
      size = 1 + Math.random() * 9; // 1-10 BTC (small)
    } else if (sizeRandom < 0.5) {
      size = 10 + Math.random() * 20; // 10-30 BTC (medium)
    } else if (sizeRandom < 0.8) {
      size = 30 + Math.random() * 45; // 30-75 BTC (large)
    } else {
      size = 75 + Math.random() * 125; // 75-200 BTC (massive whales)
    }

    // Add some price variation (proportional to current BTC price)
    const priceVariation = (Math.random() - 0.5) * 500;
    const price = btcPrice + priceVariation;

    const order: InsertBitcoinOrder = {
      type: type as 'long' | 'short',
      size: Math.round(size * 100) / 100,
      price: Math.round(price * 100) / 100,
      timestamp: new Date().toISOString(),
      status: 'open',
    };

    const createdOrder = await storage.createOrder(order);

    // Broadcast to all WebSocket clients
    if (broadcast && this.wss) {
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

    return createdOrder;
  }

  private async closeRandomPosition() {
    const openOrders = await storage.getOpenOrders();
    
    // Only close positions if there are at least 5 open orders
    if (openOrders.length < 5) {
      return;
    }

    // Pick a random open order
    const randomIndex = Math.floor(Math.random() * openOrders.length);
    const order = openOrders[randomIndex];

    // Generate realistic close price using real Bitcoin price
    const currentBtcPrice = this.currentBtcPrice;
    const priceVariation = (Math.random() - 0.5) * 1000;
    const closePrice = currentBtcPrice + priceVariation;

    // Calculate profit/loss
    const profitLoss = calculateProfitLoss(
      order.price,
      closePrice,
      order.type
    );

    // Close the order
    const closedOrder = await storage.closeOrder(
      order.id,
      Math.round(closePrice * 100) / 100,
      Math.round(profitLoss * 100) / 100
    );

    // Broadcast to all WebSocket clients
    if (closedOrder && this.wss) {
      const message = JSON.stringify({
        type: 'close_order',
        order: closedOrder,
      });

      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
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
      let timeRange: '1h' | '4h' | '24h' | '7d' = '24h';
      let status: 'open' | 'closed' | 'all' = 'all';
      
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
      
      if (req.query.timeRange) {
        const range = req.query.timeRange as string;
        if (!['1h', '4h', '24h', '7d'].includes(range)) {
          return res.status(400).json({ error: 'Invalid timeRange parameter (must be 1h, 4h, 24h, or 7d)' });
        }
        timeRange = range as '1h' | '4h' | '24h' | '7d';
      }

      if (req.query.status) {
        const st = req.query.status as string;
        if (!['open', 'closed', 'all'].includes(st)) {
          return res.status(400).json({ error: 'Invalid status parameter (must be open, closed, or all)' });
        }
        status = st as 'open' | 'closed' | 'all';
      }
      
      // Get filtered orders from storage
      const orders = await storage.getFilteredOrders({
        minSize,
        orderType,
        timeRange,
        status,
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

  // API endpoint for liquidations
  app.get("/api/liquidations", async (req, res) => {
    try {
      const hoursAgo = req.query.hours ? parseInt(req.query.hours as string) : 24;
      const liquidations = await storage.getLiquidations(hoursAgo);
      res.json(liquidations);
    } catch (error) {
      console.error('Error fetching liquidations:', error);
      res.status(500).json({ error: 'Failed to fetch liquidations' });
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

  // Start liquidation monitoring service
  liquidationService.start();
  
  // Start whale correlation tracking service
  whaleCorrelationService.start();

  return httpServer;
}
