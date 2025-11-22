import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class BybitService implements ExchangeService {
  private readonly API_BASE = 'https://api.bybit.com';
  private readonly SYMBOL = 'BTCUSDT';

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      // Fetch both spot and futures order books in parallel
      const [spotOrders, futuresOrders] = await Promise.all([
        this.fetchSpotOrders(minNotionalUSD, referencePrice),
        this.fetchFuturesOrders(minNotionalUSD, referencePrice)
      ]);

      return [...spotOrders, ...futuresOrders];
    } catch (error) {
      console.error('Error fetching Bybit whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }

  private async fetchSpotOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${this.API_BASE}/v5/market/orderbook?category=spot&symbol=${this.SYMBOL}`
    );

    if (!response.ok) {
      throw new Error(`Bybit Spot API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.retCode !== 0) {
      throw new Error(`Bybit Spot API error: ${result.retMsg}`);
    }

    return this.processOrderBook(result.result, minNotionalUSD, referencePrice, 'spot');
  }

  private async fetchFuturesOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${this.API_BASE}/v5/market/orderbook?category=linear&symbol=${this.SYMBOL}`
    );

    if (!response.ok) {
      throw new Error(`Bybit Futures API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.retCode !== 0) {
      throw new Error(`Bybit Futures API error: ${result.retMsg}`);
    }

    return this.processOrderBook(result.result, minNotionalUSD, referencePrice, 'futures');
  }

  private processOrderBook(
    data: any,
    minNotionalUSD: number,
    referencePrice: number,
    market: 'spot' | 'futures'
  ): OrderBookEntry[] {
    const whaleOrders: OrderBookEntry[] = [];

    // Process bids (buy orders) - [price, quantity]
    for (const [priceStr, quantityStr] of data.b) {
      const price = parseFloat(priceStr);
      const quantity = parseFloat(quantityStr);
      const total = price * quantity;

      if (total >= minNotionalUSD && 
          isValidPrice(price, referencePrice) && 
          isValidTotal(total) && 
          isValidCalculation(price, quantity, total)) {
        whaleOrders.push({ price, quantity, type: 'bid', total, market });
      }
    }

    // Process asks (sell orders) - [price, quantity]
    for (const [priceStr, quantityStr] of data.a) {
      const price = parseFloat(priceStr);
      const quantity = parseFloat(quantityStr);
      const total = price * quantity;

      if (total >= minNotionalUSD && 
          isValidPrice(price, referencePrice) && 
          isValidTotal(total) && 
          isValidCalculation(price, quantity, total)) {
        whaleOrders.push({ price, quantity, type: 'ask', total, market });
      }
    }

    return whaleOrders;
  }
}

export const bybitService = new BybitService();
