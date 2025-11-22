import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class KrakenService implements ExchangeService {
  private readonly API_BASE = 'https://api.kraken.com';
  private readonly SYMBOL = 'XXBTZUSD'; // BTC/USD pair

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/0/public/Depth?pair=${this.SYMBOL}&count=100`
      );

      if (!response.ok) {
        throw new Error(`Kraken API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
      }

      const result = data.result[this.SYMBOL];
      const whaleOrders: OrderBookEntry[] = [];

      // Process bids (buy orders)
      for (const [priceStr, volumeStr, timestamp] of result.bids) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(volumeStr);
        const total = price * quantity;

        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'bid', total });
        }
      }

      // Process asks (sell orders)
      for (const [priceStr, volumeStr, timestamp] of result.asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(volumeStr);
        const total = price * quantity;

        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'ask', total });
        }
      }

      return whaleOrders;
    } catch (error) {
      console.error('Error fetching Kraken whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }
}

export const krakenService = new KrakenService();
