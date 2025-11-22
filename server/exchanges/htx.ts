import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class HTXService implements ExchangeService {
  private readonly API_BASE = 'https://api.huobi.pro';
  private readonly SYMBOL = 'btcusdt';

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/market/depth?symbol=${this.SYMBOL}&type=step0`
      );

      if (!response.ok) {
        throw new Error(`HTX API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status !== 'ok') {
        throw new Error(`HTX API error: ${result['err-msg'] || 'Unknown error'}`);
      }

      const data = result.tick;
      const whaleOrders: OrderBookEntry[] = [];

      // Process bids (buy orders) - [price, quantity]
      for (const [priceVal, quantityVal] of data.bids) {
        const price = parseFloat(priceVal.toString());
        const quantity = parseFloat(quantityVal.toString());
        const total = price * quantity;

        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'bid', total });
        }
      }

      // Process asks (sell orders) - [price, quantity]
      for (const [priceVal, quantityVal] of data.asks) {
        const price = parseFloat(priceVal.toString());
        const quantity = parseFloat(quantityVal.toString());
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
      console.error('Error fetching HTX whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }
}

export const htxService = new HTXService();
