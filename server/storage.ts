import { type BitcoinOrder, type InsertBitcoinOrder, calculateLiquidationPrice } from "@shared/schema";
import { randomUUID } from "crypto";

export interface OrderFilters {
  minSize?: number;
  minLeverage?: number;
  orderType?: 'long' | 'short' | 'all';
  timeRange?: '1h' | '4h' | '24h' | '7d';
  status?: 'open' | 'closed' | 'all';
}

export interface IStorage {
  getOrders(): Promise<BitcoinOrder[]>;
  getFilteredOrders(filters: OrderFilters): Promise<BitcoinOrder[]>;
  createOrder(order: InsertBitcoinOrder): Promise<BitcoinOrder>;
  getOrder(id: string): Promise<BitcoinOrder | undefined>;
  closeOrder(id: string, closePrice: number, profitLoss: number): Promise<BitcoinOrder | undefined>;
  getOpenOrders(): Promise<BitcoinOrder[]>;
  clearOldOrders(hoursAgo: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private orders: Map<string, BitcoinOrder>;

  constructor() {
    this.orders = new Map();
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
    
    if (filters.minLeverage && filters.minLeverage > 0) {
      orders = orders.filter(order => order.leverage >= filters.minLeverage!);
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
    const liquidationPrice = calculateLiquidationPrice(
      insertOrder.price,
      insertOrder.leverage,
      insertOrder.type
    );
    
    const order: BitcoinOrder = {
      ...insertOrder,
      id,
      liquidationPrice,
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
    
    for (const [id, order] of this.orders.entries()) {
      if (new Date(order.timestamp) < cutoffTime) {
        this.orders.delete(id);
      }
    }
  }
}

export const storage = new MemStorage();
