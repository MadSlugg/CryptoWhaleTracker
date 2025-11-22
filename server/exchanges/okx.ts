import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class OKXService implements ExchangeService {
  private readonly API_BASE = 'https://www.okx.com';
  private readonly SYMBOL = 'BTC-USDT';

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/api/v5/market/books?instId=${this.SYMBOL}&sz=100`
      );

      if (!response.ok) {
        throw new Error(`OKX API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code !== '0') {
        throw new Error(`OKX API error: ${result.msg}`);
      }

      const data = result.data[0];
      const whaleOrders: OrderBookEntry[] = [];

      // Process bids (buy orders) - [price, quantity, deprecated, num-orders]
      for (const [priceStr, quantityStr] of data.bids) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(quantityStr);
        const total = price * quantity;

        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'bid', total });
        }
      }

      // Process asks (sell orders)
      for (const [priceStr, quantityStr] of data.asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(quantityStr);
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
      console.error('Error fetching OKX whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }
}

export const okxService = new OKXService();
