import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class GeminiService implements ExchangeService {
  private readonly API_BASE = 'https://api.gemini.com';
  private readonly SYMBOL = 'btcusd';

  async getWhaleOrders(minNotionalUSD: number = 840000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/v1/book/${this.SYMBOL}?limit_bids=0&limit_asks=0`
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const whaleOrders: OrderBookEntry[] = [];

      // Process bids (buy orders) - {price, amount, timestamp}
      for (const order of data.bids) {
        const price = parseFloat(order.price);
        const quantity = parseFloat(order.amount);
        const total = price * quantity;

        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'bid', total, market: 'spot' });
        }
      }

      // Process asks (sell orders) - {price, amount, timestamp}
      for (const order of data.asks) {
        const price = parseFloat(order.price);
        const quantity = parseFloat(order.amount);
        const total = price * quantity;

        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'ask', total, market: 'spot' });
        }
      }

      return whaleOrders;
    } catch (error) {
      console.error('Error fetching Gemini whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }
}

export const geminiService = new GeminiService();
