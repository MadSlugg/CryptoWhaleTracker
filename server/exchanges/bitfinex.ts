import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class BitfinexService implements ExchangeService {
  private readonly API_BASE = 'https://api-pub.bitfinex.com';
  private readonly SPOT_SYMBOL = 'tBTCUSD';
  private readonly FUTURES_SYMBOL = 'tBTCF0:USTF0';

  async getWhaleOrders(minNotionalUSD: number = 840000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      // Fetch both spot and futures order books in parallel
      const [spotOrders, futuresOrders] = await Promise.all([
        this.fetchOrderBook(this.SPOT_SYMBOL, minNotionalUSD, referencePrice, 'spot'),
        this.fetchOrderBook(this.FUTURES_SYMBOL, minNotionalUSD, referencePrice, 'futures')
      ]);

      return [...spotOrders, ...futuresOrders];
    } catch (error) {
      console.error('Error fetching Bitfinex whale orders:', error);
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
      `${this.API_BASE}/v2/book/${symbol}/P0`
    );

    if (!response.ok) {
      throw new Error(`Bitfinex ${market} API error: ${response.status}`);
    }

    const data = await response.json();
    const whaleOrders: OrderBookEntry[] = [];

    // Bitfinex format: [PRICE, COUNT, AMOUNT]
    // Bids have positive amount, Asks have negative amount
    for (const [priceVal, count, amountVal] of data) {
      const price = parseFloat(priceVal.toString());
      const amount = parseFloat(amountVal.toString());
      const quantity = Math.abs(amount); // BTC quantity
      const total = price * quantity;

      // Determine type based on amount sign
      const type = amount > 0 ? 'bid' : 'ask';

      if (total >= minNotionalUSD && 
          isValidPrice(price, referencePrice) && 
          isValidTotal(total) && 
          isValidCalculation(price, quantity, total)) {
        whaleOrders.push({ price, quantity, type, total, market });
      }
    }

    return whaleOrders;
  }
}

export const bitfinexService = new BitfinexService();
