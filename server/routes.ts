import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { InsertBitcoinOrder } from "@shared/schema";

// Generate realistic Bitcoin wallet address (bc1 native SegWit format)
function generateWalletAddress(): string {
  const chars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const length = 42; // bc1 addresses are typically 42 characters
  let address = 'bc1q';
  
  for (let i = 0; i < length - 4; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return address;
}

// Simulated order generator
class OrderGenerator {
  private intervalId: NodeJS.Timeout | null = null;
  private wss: WebSocketServer | null = null;

  start(wss: WebSocketServer) {
    this.wss = wss;
    
    // Generate initial orders
    this.generateBatch(15);
    
    // Generate new order every 3-8 seconds
    this.intervalId = setInterval(() => {
      this.generateOrder();
    }, Math.random() * 5000 + 3000);

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
  }

  private async generateBatch(count: number) {
    for (let i = 0; i < count; i++) {
      await this.generateOrder(false);
      // Small delay to stagger timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async generateOrder(broadcast = true) {
    const btcPrice = 91000 + Math.random() * 5000; // Base price around $91k-$96k (current realistic range)
    
    const type = Math.random() > 0.5 ? 'long' : 'short';
    
    // Size distribution: mostly small, few whales
    const sizeRandom = Math.random();
    let size: number;
    if (sizeRandom < 0.5) {
      size = 1 + Math.random() * 5; // 1-6 BTC
    } else if (sizeRandom < 0.8) {
      size = 5 + Math.random() * 15; // 5-20 BTC
    } else if (sizeRandom < 0.95) {
      size = 20 + Math.random() * 30; // 20-50 BTC
    } else {
      size = 50 + Math.random() * 50; // 50-100 BTC (whales)
    }

    // Leverage distribution: mostly conservative, some degenerates
    const leverageRandom = Math.random();
    let leverage: number;
    if (leverageRandom < 0.3) {
      leverage = 1 + Math.random() * 4; // 1-5x
    } else if (leverageRandom < 0.6) {
      leverage = 5 + Math.random() * 5; // 5-10x
    } else if (leverageRandom < 0.85) {
      leverage = 10 + Math.random() * 15; // 10-25x
    } else if (leverageRandom < 0.95) {
      leverage = 25 + Math.random() * 25; // 25-50x
    } else {
      leverage = 50 + Math.random() * 50; // 50-100x (extremely risky)
    }

    // Add some price variation (proportional to current BTC price)
    const priceVariation = (Math.random() - 0.5) * 500;
    const price = btcPrice + priceVariation;

    const order: InsertBitcoinOrder = {
      type: type as 'long' | 'short',
      size: Math.round(size * 100) / 100,
      price: Math.round(price * 100) / 100,
      leverage: Math.round(leverage * 10) / 10,
      timestamp: new Date().toISOString(),
      walletAddress: generateWalletAddress(),
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
}

const orderGenerator = new OrderGenerator();

export async function registerRoutes(app: Express): Promise<Server> {
  // API endpoint to fetch all orders with optional filtering
  app.get("/api/orders", async (req, res) => {
    try {
      // Validate and parse query parameters
      let minSize = 0;
      let minLeverage = 0;
      let orderType: 'long' | 'short' | 'all' = 'all';
      let timeRange: '1h' | '4h' | '24h' | '7d' = '24h';
      
      if (req.query.minSize) {
        const parsed = parseFloat(req.query.minSize as string);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({ error: 'Invalid minSize parameter' });
        }
        minSize = parsed;
      }
      
      if (req.query.minLeverage) {
        const parsed = parseFloat(req.query.minLeverage as string);
        if (isNaN(parsed) || parsed < 1 || parsed > 100) {
          return res.status(400).json({ error: 'Invalid minLeverage parameter (must be 1-100)' });
        }
        minLeverage = parsed;
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
      
      // Get filtered orders from storage
      const orders = await storage.getFilteredOrders({
        minSize,
        minLeverage,
        orderType,
        timeRange,
      });
      
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
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

  return httpServer;
}
