import type { ExchangeService, OrderBookEntry } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

interface BinanceDepthResponse {
  lastUpdateId: number;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
}

const BINANCE_SPOT_API = 'https://data-api.binance.vision';
const BINANCE_FUTURES_API = 'https://fapi.binance.com';
const BINANCE_SYMBOL = 'BTCUSDT';

export class BinanceService implements ExchangeService {
  async getWhaleOrders(minNotionalUSD: number = 840000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      // Fetch both spot and futures order books in parallel
      const [spotOrders, futuresOrders] = await Promise.all([
        this.fetchSpotOrders(minNotionalUSD, referencePrice),
        this.fetchFuturesOrders(minNotionalUSD, referencePrice)
      ]);

      return [...spotOrders, ...futuresOrders];
    } catch (error) {
      console.error('Error fetching Binance whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }

  private async fetchSpotOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${BINANCE_SPOT_API}/api/v3/depth?symbol=${BINANCE_SYMBOL}&limit=100`
    );

    if (!response.ok) {
      throw new Error(`Binance Spot API error: ${response.status}`);
    }

    const data: BinanceDepthResponse = await response.json();
    return this.processOrderBook(data, minNotionalUSD, referencePrice, 'spot');
  }

  private async fetchFuturesOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]> {
    const response = await fetch(
      `${BINANCE_FUTURES_API}/fapi/v1/depth?symbol=${BINANCE_SYMBOL}&limit=100`
    );

    if (!response.ok) {
      throw new Error(`Binance Futures API error: ${response.status}`);
    }

    const data: BinanceDepthResponse = await response.json();
    return this.processOrderBook(data, minNotionalUSD, referencePrice, 'futures');
  }

  private processOrderBook(
    data: BinanceDepthResponse,
    minNotionalUSD: number,
    referencePrice: number,
    market: 'spot' | 'futures'
  ): OrderBookEntry[] {
    const whaleOrders: OrderBookEntry[] = [];

    // Process bids (buy orders)
    for (const [priceStr, quantityStr] of data.bids) {
      const price = parseFloat(priceStr);
      const quantity = parseFloat(quantityStr);
      const total = price * quantity;

      if (total >= minNotionalUSD &&
          isValidPrice(price, referencePrice) &&
          isValidTotal(total) &&
          isValidCalculation(price, quantity, total)) {
        whaleOrders.push({
          price,
          quantity,
          type: 'bid',
          total,
          market,
        });
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
        whaleOrders.push({
          price,
          quantity,
          type: 'ask',
          total,
          market,
        });
      }
    }

    return whaleOrders;
  }
}

export const binanceService = new BinanceService();
