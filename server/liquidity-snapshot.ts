import { WebSocketServer, WebSocket } from "ws";
import type { PriceLevel, LiquiditySnapshot } from "@shared/schema";
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
import { binanceService as binancePriceService } from "./binance";

interface ExchangeConfig {
  id: string;
  service: ExchangeService;
  pollIntervalMs: number;
}

export class LiquiditySnapshotService {
  private wss: WebSocketServer | null = null;
  private currentBtcPrice: number = 93000;
  private latestSnapshot: LiquiditySnapshot | null = null;
  private readonly BUCKET_SIZE = 100; // $100 price buckets
  private readonly MIN_NOTIONAL = 8_400_000; // $8.4M minimum position size
  
  private readonly exchangeConfigs: ExchangeConfig[] = [
    { id: 'binance', service: binanceService, pollIntervalMs: 10000 },
    { id: 'bybit', service: bybitService, pollIntervalMs: 12000 },
    { id: 'kraken', service: krakenService, pollIntervalMs: 14000 },
    { id: 'bitfinex', service: bitfinexService, pollIntervalMs: 16000 },
    { id: 'coinbase', service: coinbaseService, pollIntervalMs: 18000 },
    { id: 'okx', service: okxService, pollIntervalMs: 20000 },
    { id: 'gemini', service: geminiService, pollIntervalMs: 22000 },
    { id: 'bitstamp', service: bitstampService, pollIntervalMs: 24000 },
    { id: 'kucoin', service: kucoinService, pollIntervalMs: 26000 },
    { id: 'htx', service: htxService, pollIntervalMs: 28000 },
  ];

  async start(wss: WebSocketServer) {
    this.wss = wss;
    
    // Fetch initial Bitcoin price
    await this.updateBitcoinPrice();

    // Start polling all exchanges immediately
    await this.aggregateLiquidity();

    // Poll all exchanges every 15 seconds
    setInterval(() => {
      this.aggregateLiquidity();
    }, 15000);

    // Update Bitcoin price every 5 seconds
    setInterval(() => {
      this.updateBitcoinPrice();
    }, 5000);

    console.log('[LiquiditySnapshot] Service started');
  }

  private async updateBitcoinPrice() {
    try {
      const price = await binancePriceService.getCurrentPrice();
      if (price && price > 0) {
        this.currentBtcPrice = price;
      }
    } catch (error) {
      console.error('[LiquiditySnapshot] Error fetching BTC price:', error);
    }
  }

  private async aggregateLiquidity() {
    const startTime = Date.now();
    
    // Fetch order books from all exchanges in parallel
    const orderBookPromises = this.exchangeConfigs.map(async (config) => {
      try {
        const orders = await config.service.getWhaleOrders(this.MIN_NOTIONAL, this.currentBtcPrice);
        return { exchangeId: config.id, orders };
      } catch (error) {
        console.error(`[LiquiditySnapshot] Error fetching ${config.id}:`, error);
        return { exchangeId: config.id, orders: [] };
      }
    });

    const results = await Promise.all(orderBookPromises);
    
    // Aggregate by price buckets
    const buckets = new Map<number, {
      buyLiquidity: number;
      sellLiquidity: number;
      exchanges: Set<string>;
    }>();

    for (const { exchangeId, orders } of results) {
      for (const order of orders) {
        const bucketPrice = this.getBucketPrice(order.price);
        
        if (!buckets.has(bucketPrice)) {
          buckets.set(bucketPrice, {
            buyLiquidity: 0,
            sellLiquidity: 0,
            exchanges: new Set(),
          });
        }

        const bucket = buckets.get(bucketPrice)!;
        
        if (order.type === 'bid') {
          bucket.buyLiquidity += order.quantity;
        } else {
          bucket.sellLiquidity += order.quantity;
        }
        
        bucket.exchanges.add(exchangeId);
      }
    }

    // Convert to PriceLevel array
    const levels: PriceLevel[] = Array.from(buckets.entries()).map(([price, data]) => ({
      price,
      buyLiquidity: Math.round(data.buyLiquidity * 100) / 100,
      sellLiquidity: Math.round(data.sellLiquidity * 100) / 100,
      exchanges: Array.from(data.exchanges),
      type: price < this.currentBtcPrice ? 'support' : 'resistance',
    }));

    // Calculate totals
    const totalBuyLiquidity = levels.reduce((sum, level) => sum + level.buyLiquidity, 0);
    const totalSellLiquidity = levels.reduce((sum, level) => sum + level.sellLiquidity, 0);

    // Create snapshot
    const snapshot: LiquiditySnapshot = {
      timestamp: new Date().toISOString(),
      currentPrice: this.currentBtcPrice,
      levels: levels.sort((a, b) => b.price - a.price), // Sort by price descending
      totalBuyLiquidity: Math.round(totalBuyLiquidity * 100) / 100,
      totalSellLiquidity: Math.round(totalSellLiquidity * 100) / 100,
    };

    this.latestSnapshot = snapshot;

    const duration = Date.now() - startTime;
    console.log(`[LiquiditySnapshot] Aggregated ${levels.length} price levels in ${duration}ms (${totalBuyLiquidity.toFixed(0)} BTC buy, ${totalSellLiquidity.toFixed(0)} BTC sell)`);

    // Broadcast to WebSocket clients
    if (this.wss) {
      const message = JSON.stringify({
        type: 'liquidity_update',
        snapshot,
      });
      
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  private getBucketPrice(price: number): number {
    return Math.floor(price / this.BUCKET_SIZE) * this.BUCKET_SIZE;
  }

  public getLatestSnapshot(): LiquiditySnapshot | null {
    return this.latestSnapshot;
  }

  public getCurrentPrice(): number {
    return this.currentBtcPrice;
  }
}

export const liquiditySnapshotService = new LiquiditySnapshotService();
