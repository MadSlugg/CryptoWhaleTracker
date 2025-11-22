import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class HTXService implements ExchangeService {
  private readonly SPOT_API = 'https://api.huobi.pro';
  private readonly FUTURES_API = 'https://api.hbdm.com';
  private readonly SPOT_SYMBOL = 'btcusdt';
  private readonly FUTURES_SYMBOL = 'BTC-USDT';

  async getWhaleOrders(minNotionalUSD: number = 8400000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      // Fetch both spot and futures order books in parallel
      const [spotOrders, futuresOrders] = await Promise.all([
        this.fetchSpotOrders(minNotionalUSD, referencePrice),
        this.fetchFuturesOrders(minNotionalUSD, referencePrice)
      ]);

      return [...spotOrders, ...futuresOrders];
    } catch (error) {
      console.error('Error fetching HTX whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }

  private async fetchSpotOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${this.SPOT_API}/market/depth?symbol=${this.SPOT_SYMBOL}&type=step0`
    );

    if (!response.ok) {
      throw new Error(`HTX Spot API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status !== 'ok') {
      throw new Error(`HTX Spot API error: ${result['err-msg'] || 'Unknown error'}`);
    }

    return this.processOrderBook(result.tick, minNotionalUSD, referencePrice, 'spot');
  }

  private async fetchFuturesOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${this.FUTURES_API}/linear-swap-ex/market/depth?contract_code=${this.FUTURES_SYMBOL}&type=step0`
    );

    if (!response.ok) {
      throw new Error(`HTX Futures API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status !== 'ok') {
      throw new Error(`HTX Futures API error: ${result['err-msg'] || 'Unknown error'}`);
    }

    return this.processOrderBook(result.tick, minNotionalUSD, referencePrice, 'futures');
  }

  private processOrderBook(
    data: any,
    minNotionalUSD: number,
    referencePrice: number,
    market: 'spot' | 'futures'
  ): OrderBookEntry[] {
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
        whaleOrders.push({ price, quantity, type: 'bid', total, market });
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
        whaleOrders.push({ price, quantity, type: 'ask', total, market });
      }
    }

    return whaleOrders;
  }
}

export const htxService = new HTXService();
