import { OrderBookEntry, ExchangeService } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

export class BitfinexService implements ExchangeService {
  private readonly API_BASE = 'https://api-pub.bitfinex.com';
  private readonly SYMBOL = 'tBTCUSD'; // Trading pairs use 't' prefix

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/v2/book/${this.SYMBOL}/P0`
      );

      if (!response.ok) {
        throw new Error(`Bitfinex API error: ${response.status}`);
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
          whaleOrders.push({ price, quantity, type, total });
        }
      }

      return whaleOrders;
    } catch (error) {
      console.error('Error fetching Bitfinex whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }
}

export const bitfinexService = new BitfinexService();
