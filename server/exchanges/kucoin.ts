import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class KuCoinService implements ExchangeService {
  private readonly SPOT_API = 'https://api.kucoin.com';
  private readonly FUTURES_API = 'https://api-futures.kucoin.com';
  private readonly SPOT_SYMBOL = 'BTC-USDT';
  private readonly FUTURES_SYMBOL = 'XBTUSDTM';

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      // Fetch both spot and futures order books in parallel
      const [spotOrders, futuresOrders] = await Promise.all([
        this.fetchSpotOrders(minNotionalUSD, referencePrice),
        this.fetchFuturesOrders(minNotionalUSD, referencePrice)
      ]);

      return [...spotOrders, ...futuresOrders];
    } catch (error) {
      console.error('Error fetching KuCoin whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }

  private async fetchSpotOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${this.SPOT_API}/api/v1/market/orderbook/level2_100?symbol=${this.SPOT_SYMBOL}`
    );

    if (!response.ok) {
      throw new Error(`KuCoin Spot API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code !== '200000') {
      throw new Error(`KuCoin Spot API error: ${result.msg || 'Unknown error'}`);
    }

    return this.processOrderBook(result.data, minNotionalUSD, referencePrice, 'spot');
  }

  private async fetchFuturesOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${this.FUTURES_API}/api/v1/level2/depth100?symbol=${this.FUTURES_SYMBOL}`
    );

    if (!response.ok) {
      throw new Error(`KuCoin Futures API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code !== '200000') {
      throw new Error(`KuCoin Futures API error: ${result.msg || 'Unknown error'}`);
    }

    return this.processOrderBook(result.data, minNotionalUSD, referencePrice, 'futures');
  }

  private processOrderBook(
    data: any,
    minNotionalUSD: number,
    referencePrice: number,
    market: 'spot' | 'futures'
  ): OrderBookEntry[] {
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
        whaleOrders.push({ price, quantity, type: 'bid', total, market });
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
        whaleOrders.push({ price, quantity, type: 'ask', total, market });
      }
    }

    return whaleOrders;
  }
}

export const kucoinService = new KuCoinService();
