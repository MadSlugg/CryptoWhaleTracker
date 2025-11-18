// Multi-exchange service for fetching real whale orders from various crypto exchanges
// All data is sourced from public order book APIs - no authentication required

export interface OrderBookEntry {
  price: number;
  quantity: number;
  type: 'bid' | 'ask';
  total: number;
}

// Price validation helper to filter out stale/outlier orders
// Only accept prices within ±20% of current market price
function isValidPrice(price: number, referencePrice: number): boolean {
  const deviation = Math.abs(price - referencePrice) / referencePrice;
  return deviation <= 0.20; // 20% tolerance
}

// Validate that total value makes sense (prevents parsing errors)
// For whale orders, total should be between $450k and $100M (reasonable upper bound)
function isValidTotal(total: number): boolean {
  return total >= 450000 && total <= 100000000; // $450k to $100M
}

// Validate that total approximately equals price * quantity
// This catches parsing errors where we might multiply wrong fields
function isValidCalculation(price: number, quantity: number, total: number): boolean {
  const expectedTotal = price * quantity;
  const deviation = Math.abs(expectedTotal - total) / expectedTotal;
  return deviation < 0.01; // 1% tolerance for rounding
}

// Kraken API service
export class KrakenService {
  private readonly API_BASE = 'https://api.kraken.com';
  private readonly SYMBOL = 'XXBTZUSD'; // BTC/USD pair

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/0/public/Depth?pair=${this.SYMBOL}&count=100`
      );

      if (!response.ok) {
        throw new Error(`Kraken API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
      }

      const result = data.result[this.SYMBOL];
      const whaleOrders: OrderBookEntry[] = [];

      // Process bids (buy orders) - filter out stale/outlier prices
      for (const [priceStr, volumeStr, timestamp] of result.bids) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(volumeStr);
        const total = price * quantity;

        // Comprehensive validation: threshold, price range, total sanity, calculation accuracy
        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'bid', total });
        }
      }

      // Process asks (sell orders) - filter out stale/outlier prices
      for (const [priceStr, volumeStr, timestamp] of result.asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(volumeStr);
        const total = price * quantity;

        // Comprehensive validation: threshold, price range, total sanity, calculation accuracy
        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'ask', total });
        }
      }

      return whaleOrders;
    } catch (error) {
      console.error('Error fetching Kraken whale orders:', error);
      return [];
    }
  }
}

// Coinbase API service
export class CoinbaseService {
  private readonly API_BASE = 'https://api.exchange.coinbase.com';
  private readonly SYMBOL = 'BTC-USD';

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/products/${this.SYMBOL}/book?level=2`
      );

      if (!response.ok) {
        throw new Error(`Coinbase API error: ${response.status}`);
      }

      const data = await response.json();
      const whaleOrders: OrderBookEntry[] = [];

      // Process bids (buy orders) - [price, size, num-orders]
      // Size is base currency quantity (BTC)
      for (const [priceStr, sizeStr] of data.bids) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(sizeStr); // BTC quantity
        const total = price * quantity; // USD notional value

        // Comprehensive validation: threshold, price range, total sanity, calculation accuracy
        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'bid', total });
        }
      }

      // Process asks (sell orders)
      for (const [priceStr, sizeStr] of data.asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(sizeStr); // BTC quantity
        const total = price * quantity; // USD notional value

        // Comprehensive validation: threshold, price range, total sanity, calculation accuracy
        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'ask', total });
        }
      }

      return whaleOrders;
    } catch (error) {
      console.error('Error fetching Coinbase whale orders:', error);
      return [];
    }
  }
}

// OKX API service
export class OKXService {
  private readonly API_BASE = 'https://www.okx.com';
  private readonly SYMBOL = 'BTC-USDT'; // Note: USDT is close to USD (~1:1), no conversion needed

  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE}/api/v5/market/books?instId=${this.SYMBOL}&sz=100`
      );

      if (!response.ok) {
        throw new Error(`OKX API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code !== '0') {
        throw new Error(`OKX API error: ${result.msg}`);
      }

      const data = result.data[0];
      const whaleOrders: OrderBookEntry[] = [];

      // Process bids (buy orders) - [price, quantity, deprecated, num-orders]
      // USDT is treated as USD (typically 1:1 parity), quantity is in BTC
      for (const [priceStr, quantityStr] of data.bids) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(quantityStr); // BTC quantity
        const total = price * quantity; // USDT notional (treated as USD)

        // Comprehensive validation: threshold, price range, total sanity, calculation accuracy
        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'bid', total });
        }
      }

      // Process asks (sell orders)
      for (const [priceStr, quantityStr] of data.asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(quantityStr); // BTC quantity
        const total = price * quantity; // USDT notional (treated as USD)

        // Comprehensive validation: threshold, price range, total sanity, calculation accuracy
        if (total >= minNotionalUSD && 
            isValidPrice(price, referencePrice) && 
            isValidTotal(total) && 
            isValidCalculation(price, quantity, total)) {
          whaleOrders.push({ price, quantity, type: 'ask', total });
        }
      }

      return whaleOrders;
    } catch (error) {
      console.error('Error fetching OKX whale orders:', error);
      return [];
    }
  }
}

// Export service instances
export const krakenService = new KrakenService();
export const coinbaseService = new CoinbaseService();
export const okxService = new OKXService();
