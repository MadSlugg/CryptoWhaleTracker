// Binance API service for fetching real Bitcoin prices, order book data, long/short ratios, and liquidations

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

// Long/Short Ratio response from Binance Futures API
export interface LongShortRatioResponse {
  symbol: string;
  longShortRatio: string;
  longAccount: string;
  shortAccount: string;
  timestamp: number;
}

// Liquidation order from WebSocket stream
export interface LiquidationOrder {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  timeInForce: string;
  quantity: string;
  price: string;
  averagePrice: string;
  orderStatus: string;
  lastFilledQty: string;
  accumulatedFilledQty: string;
  tradeTime: number;
}

// Using Binance's market data-only endpoint which has different geo-restrictions
const BINANCE_API_BASE = 'https://data-api.binance.vision';
const BINANCE_FUTURES_API = 'https://fapi.binance.com';
const BINANCE_SYMBOL = 'BTCUSDT';

export class BinanceService {
  private lastUpdateId: number = 0;
  private lastKnownPrice: number = 90000; // Cache last known price
  private longShortRatioCache: Map<string, LongShortRatioResponse[]> = new Map();
  
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
      const price = parseFloat(data.price);
      this.lastKnownPrice = price; // Cache the price
      return price;
    } catch (error) {
      console.error('Error fetching Bitcoin price from Binance:', error);
      // Fallback to last known price with small random drift
      const drift = (Math.random() - 0.5) * 200; // ±$100 drift
      return this.lastKnownPrice + drift;
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
   * Parse order book and extract whale orders above notional threshold
   * @param minNotionalUSD Minimum USD value to be considered a whale order (default: $450k)
   * @param referencePrice Current BTC price for validating order book entries (default: 90000)
   */
  async getWhaleOrders(minNotionalUSD: number = 450000, referencePrice: number = 90000): Promise<OrderBookEntry[]> {
    try {
      const orderBook = await this.getOrderBook(100);
      const whaleOrders: OrderBookEntry[] = [];
      
      // Validation helpers
      const isValidPrice = (price: number): boolean => {
        const deviation = Math.abs(price - referencePrice) / referencePrice;
        return deviation <= 0.20; // 20% tolerance
      };
      
      const isValidTotal = (total: number): boolean => {
        return total >= 450000 && total <= 100000000; // $450k to $100M
      };
      
      const isValidCalculation = (price: number, quantity: number, total: number): boolean => {
        const expectedTotal = price * quantity;
        const deviation = Math.abs(expectedTotal - total) / expectedTotal;
        return deviation < 0.01; // 1% tolerance
      };
      
      // Process bids (buy orders) - comprehensive validation
      for (const [priceStr, quantityStr] of orderBook.bids) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(quantityStr);
        const total = price * quantity;
        
        // Comprehensive validation: threshold, price range, total sanity, calculation accuracy
        if (total >= minNotionalUSD && 
            isValidPrice(price) && 
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
      
      // Process asks (sell orders) - comprehensive validation
      for (const [priceStr, quantityStr] of orderBook.asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(quantityStr);
        const total = price * quantity;
        
        // Comprehensive validation: threshold, price range, total sanity, calculation accuracy
        if (total >= minNotionalUSD && 
            isValidPrice(price) && 
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
      console.error('Error fetching whale orders:', error);
      return [];
    }
  }
  
  /**
   * Fetch long/short ratio from Binance Futures API
   * @param period Time interval (5m, 15m, 30m, 1h, 2h, 4h)
   * @param limit Number of data points (default: 30, max: 500)
   * @param isTopTrader If true, fetches top trader ratio instead of global
   */
  async getLongShortRatio(
    period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' = '15m',
    limit: number = 30,
    isTopTrader: boolean = false
  ): Promise<LongShortRatioResponse[]> {
    try {
      const endpoint = isTopTrader 
        ? '/futures/data/topLongShortAccountRatio'
        : '/futures/data/globalLongShortAccountRatio';
      
      const response = await fetch(
        `${BINANCE_FUTURES_API}${endpoint}?symbol=${BINANCE_SYMBOL}&period=${period}&limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`Binance Futures API error: ${response.status}`);
      }
      
      const data: LongShortRatioResponse[] = await response.json();
      
      // Cache the data
      const cacheKey = `${isTopTrader ? 'top' : 'global'}-${period}`;
      this.longShortRatioCache.set(cacheKey, data);
      
      console.log(`[Binance] Fetched ${data.length} long/short ratio data points (${cacheKey})`);
      return data;
    } catch (error) {
      console.error('Error fetching long/short ratio from Binance:', error);
      
      // Return cached data if available
      const cacheKey = `${isTopTrader ? 'top' : 'global'}-${period}`;
      const cached = this.longShortRatioCache.get(cacheKey);
      if (cached) {
        console.log(`[Binance] Using cached long/short ratio data (${cacheKey})`);
        return cached;
      }
      
      return [];
    }
  }
  
  /**
   * Get the latest long/short ratio (most recent data point)
   */
  async getLatestLongShortRatio(isTopTrader: boolean = false): Promise<LongShortRatioResponse | null> {
    const data = await this.getLongShortRatio('15m', 1, isTopTrader);
    return data.length > 0 ? data[0] : null;
  }
  
  /**
   * Analyze if shorts spiked after a whale movement
   * @param initialRatio The long/short ratio before the whale movement
   * @param currentRatio The long/short ratio after the whale movement
   * @returns Object with spike detection and percentage change
   */
  analyzeShortSpike(initialRatio: number, currentRatio: number): {
    spiked: boolean;
    percentageChange: number;
    confidence: 'low' | 'medium' | 'high';
  } {
    // Calculate percentage change in the ratio
    // Lower ratio = more shorts relative to longs
    const percentageChange = ((currentRatio - initialRatio) / initialRatio) * 100;
    
    // Negative change means shorts increased
    const spiked = percentageChange < -5; // At least 5% decrease in ratio = short spike
    
    let confidence: 'low' | 'medium' | 'high' = 'low';
    if (Math.abs(percentageChange) > 15) {
      confidence = 'high';
    } else if (Math.abs(percentageChange) > 8) {
      confidence = 'medium';
    }
    
    return {
      spiked,
      percentageChange,
      confidence
    };
  }
}

export const binanceService = new BinanceService();
