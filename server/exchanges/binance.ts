import type { ExchangeService, OrderBookEntry } from './types';
import { isValidPrice, isValidTotal, isValidCalculation } from './validators';

interface BinanceDepthResponse {
  lastUpdateId: number;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
}

const BINANCE_API_BASE = 'https://data-api.binance.vision';
const BINANCE_SYMBOL = 'BTCUSDT';

export class BinanceService implements ExchangeService {
  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${BINANCE_API_BASE}/api/v3/depth?symbol=${BINANCE_SYMBOL}&limit=100`
      );

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data: BinanceDepthResponse = await response.json();
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
          });
        }
      }

      return whaleOrders;
    } catch (error) {
      console.error('Error fetching Binance whale orders:', error);
      throw error; // Propagate error for circuit breaker
    }
  }
}

export const binanceService = new BinanceService();
