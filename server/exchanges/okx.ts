import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class OKXService implements ExchangeService {
  private readonly API_BASE = 'https://www.okx.com';
  private readonly SPOT_SYMBOL = 'BTC-USDT';
  private readonly FUTURES_SYMBOL = 'BTC-USDT-SWAP';

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      // Fetch both spot and futures order books in parallel
      const [spotOrders, futuresOrders] = await Promise.all([
        this.fetchOrderBook(this.SPOT_SYMBOL, minNotionalUSD, referencePrice, 'spot'),
        this.fetchOrderBook(this.FUTURES_SYMBOL, minNotionalUSD, referencePrice, 'futures')
      ]);

      return [...spotOrders, ...futuresOrders];
    } catch (error) {
      console.error('Error fetching OKX whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }

  private async fetchOrderBook(
    symbol: string,
    minNotionalUSD: number,
    referencePrice: number,
    market: 'spot' | 'futures'
  ): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${this.API_BASE}/api/v5/market/books?instId=${symbol}&sz=100`
    );

    if (!response.ok) {
      throw new Error(`OKX ${market} API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code !== '0') {
      throw new Error(`OKX ${market} API error: ${result.msg}`);
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
        whaleOrders.push({ price, quantity, type: 'bid', total, market });
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
        whaleOrders.push({ price, quantity, type: 'ask', total, market });
      }
    }

    return whaleOrders;
  }
}

export const okxService = new OKXService();
