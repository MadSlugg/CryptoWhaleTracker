import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class BitstampService implements ExchangeService {
  private readonly API_BASE = 'https://www.bitstamp.net';
  private readonly SYMBOL = 'btcusd';

  async getWhaleOrders(minNotionalUSD: number = 840000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/api/v2/order_book/${this.SYMBOL}/`
      );

      if (!response.ok) {
        throw new Error(`Bitstamp API error: ${response.status}`);
      }

      const data = await response.json();
      const whaleOrders: OrderBookEntry[] = [];

      // Process bids (buy orders) - [price, amount]
      for (const [priceStr, amountStr] of data.bids) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(amountStr);
        const total = price * quantity;

        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'bid', total, market: 'spot' });
        }
      }

      // Process asks (sell orders) - [price, amount]
      for (const [priceStr, amountStr] of data.asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(amountStr);
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
      console.error('Error fetching Bitstamp whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }
}

export const bitstampService = new BitstampService();
