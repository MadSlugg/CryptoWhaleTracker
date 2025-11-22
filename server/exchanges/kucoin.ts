import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class KuCoinService implements ExchangeService {
  private readonly API_BASE = 'https://api.kucoin.com';
  private readonly SYMBOL = 'BTC-USDT';

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/api/v1/market/orderbook/level2_100?symbol=${this.SYMBOL}`
      );

      if (!response.ok) {
        throw new Error(`KuCoin API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code !== '200000') {
        throw new Error(`KuCoin API error: ${result.msg || 'Unknown error'}`);
      }

      const data = result.data;
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
          whaleOrders.push({ price, quantity, type: 'bid', total });
        }
      }

      // Process asks (sell orders) - [price, size]
      for (const [priceStr, sizeStr] of data.asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(sizeStr);
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
      console.error('Error fetching KuCoin whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }
}

export const kucoinService = new KuCoinService();
