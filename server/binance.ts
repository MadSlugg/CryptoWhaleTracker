// Binance API service for fetching real Bitcoin prices and order book data

interface BinanceTickerResponse {
  symbol: string;
  price: string;
}

interface BinanceDepthResponse {
  lastUpdateId: number;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  type: 'bid' | 'ask'; // bid = buy order, ask = sell order
  total: number; // price * quantity in USD
}

const BINANCE_API_BASE = 'https://api.binance.com';
const BINANCE_SYMBOL = 'BTCUSDT';

export class BinanceService {
  private lastUpdateId: number = 0;
  
  /**
   * Fetch current Bitcoin price from Binance
   */
  async getCurrentPrice(): Promise<number> {
    try {
      const response = await fetch(
        `${BINANCE_API_BASE}/api/v3/ticker/price?symbol=${BINANCE_SYMBOL}`
      );
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }
      
      const data: BinanceTickerResponse = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      console.error('Error fetching Bitcoin price from Binance:', error);
      // Fallback to simulated price if API fails
      return 91000 + Math.random() * 5000;
    }
  }
  
  /**
   * Fetch order book depth from Binance
   * @param limit Number of price levels to fetch (5, 10, 20, 50, 100, 500, 1000, 5000)
   */
  async getOrderBook(limit: number = 100): Promise<BinanceDepthResponse> {
    try {
      const response = await fetch(
        `${BINANCE_API_BASE}/api/v3/depth?symbol=${BINANCE_SYMBOL}&limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }
      
      const data: BinanceDepthResponse = await response.json();
      this.lastUpdateId = data.lastUpdateId;
      return data;
    } catch (error) {
      console.error('Error fetching order book from Binance:', error);
      throw error;
    }
  }
  
  /**
   * Parse order book and extract whale orders above threshold
   * @param minBtcSize Minimum BTC size to be considered a whale order
   */
  async getWhaleOrders(minBtcSize: number = 5): Promise<OrderBookEntry[]> {
    try {
      const orderBook = await this.getOrderBook(100);
      const whaleOrders: OrderBookEntry[] = [];
      
      // Process bids (buy orders)
      for (const [priceStr, quantityStr] of orderBook.bids) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(quantityStr);
        const total = price * quantity;
        
        if (quantity >= minBtcSize) {
          whaleOrders.push({
            price,
            quantity,
            type: 'bid',
            total,
          });
        }
      }
      
      // Process asks (sell orders)
      for (const [priceStr, quantityStr] of orderBook.asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(quantityStr);
        const total = price * quantity;
        
        if (quantity >= minBtcSize) {
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
      console.error('Error fetching whale orders:', error);
      return [];
    }
  }
}

export const binanceService = new BinanceService();
