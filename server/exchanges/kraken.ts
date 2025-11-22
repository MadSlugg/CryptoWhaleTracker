import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class KrakenService implements ExchangeService {
  private readonly SPOT_API = 'https://api.kraken.com';
  private readonly FUTURES_API = 'https://futures.kraken.com';
  private readonly SPOT_SYMBOL = 'XXBTZUSD';
  private readonly FUTURES_SYMBOL = 'PI_XBTUSD';

  async getWhaleOrders(minNotionalUSD: number = 840000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      // Fetch both spot and futures order books in parallel
      const [spotOrders, futuresOrders] = await Promise.all([
        this.fetchSpotOrders(minNotionalUSD, referencePrice),
        this.fetchFuturesOrders(minNotionalUSD, referencePrice)
      ]);

      return [...spotOrders, ...futuresOrders];
    } catch (error) {
      console.error('Error fetching Kraken whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }

  private async fetchSpotOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${this.SPOT_API}/0/public/Depth?pair=${this.SPOT_SYMBOL}&count=100`
    );

    if (!response.ok) {
      throw new Error(`Kraken Spot API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken Spot API error: ${data.error.join(', ')}`);
    }

    const result = data.result[this.SPOT_SYMBOL];
    return this.processOrderBook(result, minNotionalUSD, referencePrice, 'spot');
  }

  private async fetchFuturesOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${this.FUTURES_API}/derivatives/api/v3/orderbook?symbol=${this.FUTURES_SYMBOL}`
    );

    if (!response.ok) {
      throw new Error(`Kraken Futures API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.result !== 'success') {
      throw new Error(`Kraken Futures API error: ${data.error || 'Unknown error'}`);
    }

    return this.processOrderBook(data.orderBook, minNotionalUSD, referencePrice, 'futures');
  }

  private processOrderBook(
    data: any,
    minNotionalUSD: number,
    referencePrice: number,
    market: 'spot' | 'futures'
  ): OrderBookEntry[] {
    const whaleOrders: OrderBookEntry[] = [];

    // Process bids (buy orders) - format: [price, volume, timestamp] for spot or [price, size] for futures
    const bids = Array.isArray(data.bids) ? data.bids : [];
    for (const bid of bids) {
      const priceStr = bid[0];
      const volumeStr = bid[1];
      const price = parseFloat(priceStr.toString());
      const quantity = parseFloat(volumeStr.toString());
      const total = price * quantity;

      if (total >= minNotionalUSD && 
          isValidPrice(price, referencePrice) && 
          isValidTotal(total) && 
          isValidCalculation(price, quantity, total)) {
        whaleOrders.push({ price, quantity, type: 'bid', total, market });
      }
    }

    // Process asks (sell orders)
    const asks = Array.isArray(data.asks) ? data.asks : [];
    for (const ask of asks) {
      const priceStr = ask[0];
      const volumeStr = ask[1];
      const price = parseFloat(priceStr.toString());
      const quantity = parseFloat(volumeStr.toString());
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

export const krakenService = new KrakenService();
