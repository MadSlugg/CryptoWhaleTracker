import { 
  type BitcoinOrder, 
  type InsertBitcoinOrder, 
  type WhaleMovement,
  type LongShortRatio,
  type Liquidation,
  type WhaleCorrelation
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface OrderFilters {
  minSize?: number;
  orderType?: 'long' | 'short' | 'all';
  timeRange?: '1h' | '4h' | '24h' | '7d';
  status?: 'open' | 'closed' | 'all';
}

export interface IStorage {
  // Bitcoin orders
  getOrders(): Promise<BitcoinOrder[]>;
  getFilteredOrders(filters: OrderFilters): Promise<BitcoinOrder[]>;
  createOrder(order: InsertBitcoinOrder): Promise<BitcoinOrder>;
  getOrder(id: string): Promise<BitcoinOrder | undefined>;
  closeOrder(id: string, closePrice: number, profitLoss: number): Promise<BitcoinOrder | undefined>;
  getOpenOrders(): Promise<BitcoinOrder[]>;
  clearOldOrders(hoursAgo: number): Promise<void>;
  
  // Whale movements
  addWhaleMovement(movement: Omit<WhaleMovement, 'id'>): Promise<WhaleMovement>;
  getWhaleMovements(hoursAgo?: number): Promise<WhaleMovement[]>;
  
  // Long/Short ratios
  addLongShortRatio(ratio: Omit<LongShortRatio, 'id'>): Promise<LongShortRatio>;
  getLongShortRatios(period?: string, limit?: number): Promise<LongShortRatio[]>;
  getLatestLongShortRatio(isTopTrader?: boolean): Promise<LongShortRatio | undefined>;
  
  // Liquidations
  addLiquidation(liquidation: Omit<Liquidation, 'id'>): Promise<Liquidation>;
  getLiquidations(hoursAgo?: number): Promise<Liquidation[]>;
  
  // Whale correlations
  addWhaleCorrelation(correlation: Omit<WhaleCorrelation, 'id'>): Promise<WhaleCorrelation>;
  getWhaleCorrelations(hoursAgo?: number): Promise<WhaleCorrelation[]>;
}

export class MemStorage implements IStorage {
  private orders: Map<string, BitcoinOrder>;
  private whaleMovements: Map<string, WhaleMovement>;
  private longShortRatios: Map<string, LongShortRatio>;
  private liquidations: Map<string, Liquidation>;
  private whaleCorrelations: Map<string, WhaleCorrelation>;

  constructor() {
    this.orders = new Map();
    this.whaleMovements = new Map();
    this.longShortRatios = new Map();
    this.liquidations = new Map();
    this.whaleCorrelations = new Map();
  }

  async getOrders(): Promise<BitcoinOrder[]> {
    return Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async getFilteredOrders(filters: OrderFilters): Promise<BitcoinOrder[]> {
    let orders = await this.getOrders();
    
    // Apply filters
    if (filters.minSize && filters.minSize > 0) {
      orders = orders.filter(order => order.size >= filters.minSize!);
    }
    
    if (filters.orderType && filters.orderType !== 'all') {
      orders = orders.filter(order => order.type === filters.orderType);
    }
    
    if (filters.status && filters.status !== 'all') {
      orders = orders.filter(order => order.status === filters.status);
    }
    
    if (filters.timeRange) {
      const now = Date.now();
      const timeRanges: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      
      const rangeMs = timeRanges[filters.timeRange];
      if (rangeMs) {
        orders = orders.filter(order => {
          const orderTime = new Date(order.timestamp).getTime();
          return now - orderTime <= rangeMs;
        });
      }
    }
    
    return orders;
  }

  async createOrder(insertOrder: InsertBitcoinOrder): Promise<BitcoinOrder> {
    const id = randomUUID();
    
    const order: BitcoinOrder = {
      ...insertOrder,
      id,
      status: insertOrder.status || 'open',
    };
    
    this.orders.set(id, order);
    return order;
  }

  async getOrder(id: string): Promise<BitcoinOrder | undefined> {
    return this.orders.get(id);
  }

  async closeOrder(id: string, closePrice: number, profitLoss: number): Promise<BitcoinOrder | undefined> {
    const order = this.orders.get(id);
    // Treat undefined status as open (for legacy records)
    if (!order || order.status === 'closed') {
      return undefined;
    }

    const closedOrder: BitcoinOrder = {
      ...order,
      status: 'closed',
      closePrice,
      closedAt: new Date().toISOString(),
      profitLoss,
    };

    this.orders.set(id, closedOrder);
    return closedOrder;
  }

  async getOpenOrders(): Promise<BitcoinOrder[]> {
    const allOrders = await this.getOrders();
    return allOrders.filter(order => order.status === 'open');
  }

  async clearOldOrders(hoursAgo: number): Promise<void> {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    for (const [id, order] of Array.from(this.orders.entries())) {
      if (new Date(order.timestamp) < cutoffTime) {
        this.orders.delete(id);
      }
    }
  }

  // Whale movement methods
  async addWhaleMovement(movement: Omit<WhaleMovement, 'id'>): Promise<WhaleMovement> {
    const id = randomUUID();
    const whaleMovement: WhaleMovement = { ...movement, id };
    this.whaleMovements.set(id, whaleMovement);
    return whaleMovement;
  }

  async getWhaleMovements(hoursAgo: number = 24): Promise<WhaleMovement[]> {
    const cutoffTime = Date.now() - hoursAgo * 60 * 60 * 1000;
    return Array.from(this.whaleMovements.values())
      .filter(m => new Date(m.timestamp).getTime() >= cutoffTime)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Long/Short ratio methods
  async addLongShortRatio(ratio: Omit<LongShortRatio, 'id'>): Promise<LongShortRatio> {
    const id = randomUUID();
    const longShortRatio: LongShortRatio = { ...ratio, id };
    this.longShortRatios.set(id, longShortRatio);
    return longShortRatio;
  }

  async getLongShortRatios(period?: string, limit: number = 100): Promise<LongShortRatio[]> {
    let ratios = Array.from(this.longShortRatios.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (period) {
      ratios = ratios.filter(r => r.period === period);
    }
    
    return ratios.slice(0, limit);
  }

  async getLatestLongShortRatio(isTopTrader: boolean = false): Promise<LongShortRatio | undefined> {
    const ratios = Array.from(this.longShortRatios.values())
      .filter(r => r.isTopTrader === isTopTrader)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return ratios[0];
  }

  // Liquidation methods
  async addLiquidation(liquidation: Omit<Liquidation, 'id'>): Promise<Liquidation> {
    const id = randomUUID();
    const liq: Liquidation = { ...liquidation, id };
    this.liquidations.set(id, liq);
    return liq;
  }

  async getLiquidations(hoursAgo: number = 24): Promise<Liquidation[]> {
    const cutoffTime = Date.now() - hoursAgo * 60 * 60 * 1000;
    return Array.from(this.liquidations.values())
      .filter(l => new Date(l.timestamp).getTime() >= cutoffTime)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Whale correlation methods
  async addWhaleCorrelation(correlation: Omit<WhaleCorrelation, 'id'>): Promise<WhaleCorrelation> {
    const id = randomUUID();
    const wc: WhaleCorrelation = { ...correlation, id };
    this.whaleCorrelations.set(id, wc);
    return wc;
  }

  async getWhaleCorrelations(hoursAgo: number = 24): Promise<WhaleCorrelation[]> {
    const cutoffTime = Date.now() - hoursAgo * 60 * 60 * 1000;
    return Array.from(this.whaleCorrelations.values())
      .filter(c => new Date(c.timestamp).getTime() >= cutoffTime)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

export const storage = new MemStorage();
