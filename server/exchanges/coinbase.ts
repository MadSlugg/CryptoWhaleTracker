import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class CoinbaseService implements ExchangeService {
  private readonly API_BASE = 'https://api.exchange.coinbase.com';
  private readonly SYMBOL = 'BTC-USD';

  async getWhaleOrders(minNotionalUSD: number = 840000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/products/${this.SYMBOL}/book?level=2`
      );

      if (!response.ok) {
        throw new Error(`Coinbase API error: ${response.status}`);
      }

      const data = await response.json();
      const whaleOrders: OrderBookEntry[] = [];

      // Process bids (buy orders) - [price, size]
      for (const [priceStr, sizeStr] of data.bids) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(sizeStr);
        const total = price * quantity;

        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'bid', total, market: 'spot' });
        }
      }

      // Process asks (sell orders)
      for (const [priceStr, sizeStr] of data.asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(sizeStr);
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
      console.error('Error fetching Coinbase whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }
}

export const coinbaseService = new CoinbaseService();
