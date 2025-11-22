interface FuturesMarketData {
  openInterest: {
    long: number;
    short: number;
  };
  longShortRatio: number;
  timestamp: number;
}

interface ExchangeFuturesService {
  getMarketData(): Promise<FuturesMarketData>;
}

class BinanceFuturesService implements ExchangeFuturesService {
  private readonly API_BASE = 'https://fapi.binance.com';
  private readonly SYMBOL = 'BTCUSDT';

  async getMarketData(): Promise<FuturesMarketData> {
    try {
      const [totalOI, longShortRatio] = await Promise.all([
        this.getOpenInterest(),
        this.getLongShortRatio()
      ]);

      const longPortion = longShortRatio / (1 + longShortRatio);
      const shortPortion = 1 / (1 + longShortRatio);

      return {
        openInterest: {
          long: totalOI * longPortion,
          short: totalOI * shortPortion,
        },
        longShortRatio,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error fetching Binance futures data:', error);
      throw error;
    }
  }

  private async getOpenInterest(): Promise<number> {
    const response = await fetch(
      `${this.API_BASE}/fapi/v1/openInterest?symbol=${this.SYMBOL}`
    );

    if (!response.ok) {
      throw new Error(`Binance Open Interest API error: ${response.status}`);
    }

    const data = await response.json();
    return parseFloat(data.openInterest);
  }

  private async getLongShortRatio(): Promise<number> {
    const response = await fetch(
      `${this.API_BASE}/futures/data/globalLongShortAccountRatio?symbol=${this.SYMBOL}&period=5m&limit=1`
    );

    if (!response.ok) {
      throw new Error(`Binance Long/Short Ratio API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.length === 0) {
      return 1.0;
    }

    return parseFloat(data[0].longShortRatio);
  }
}

class BybitFuturesService implements ExchangeFuturesService {
  private readonly API_BASE = 'https://api.bybit.com';
  private readonly SYMBOL = 'BTCUSDT';

  async getMarketData(): Promise<FuturesMarketData> {
    try {
      const [openInterestData, longShortData] = await Promise.all([
        this.getOpenInterest(),
        this.getLongShortRatio()
      ]);

      return {
        openInterest: openInterestData,
        longShortRatio: longShortData,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error fetching Bybit futures data:', error);
      throw error;
    }
  }

  private async getOpenInterest(): Promise<{ long: number; short: number }> {
    const response = await fetch(
      `${this.API_BASE}/v5/market/open-interest?category=linear&symbol=${this.SYMBOL}&intervalTime=5min&limit=1`
    );

    if (!response.ok) {
      throw new Error(`Bybit Open Interest API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.retCode !== 0 || !result.result.list || result.result.list.length === 0) {
      throw new Error(`Bybit Open Interest API error: ${result.retMsg || 'No data'}`);
    }

    const totalOI = parseFloat(result.result.list[0].openInterest);

    return {
      long: totalOI * 0.5,
      short: totalOI * 0.5,
    };
  }

  private async getLongShortRatio(): Promise<number> {
    const response = await fetch(
      `${this.API_BASE}/v5/market/account-ratio?category=linear&symbol=${this.SYMBOL}&period=5min&limit=1`
    );

    if (!response.ok) {
      throw new Error(`Bybit Long/Short Ratio API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.retCode !== 0 || !result.result.list || result.result.list.length === 0) {
      return 1.0;
    }

    const buyRatio = parseFloat(result.result.list[0].buyRatio);
    const sellRatio = parseFloat(result.result.list[0].sellRatio);

    if (sellRatio === 0) return 1.0;
    return buyRatio / sellRatio;
  }
}

class OKXFuturesService implements ExchangeFuturesService {
  private readonly API_BASE = 'https://www.okx.com';
  private readonly SYMBOL = 'BTC-USDT-SWAP';

  async getMarketData(): Promise<FuturesMarketData> {
    try {
      const [openInterestData, longShortData] = await Promise.all([
        this.getOpenInterest(),
        this.getLongShortRatio()
      ]);

      return {
        openInterest: openInterestData,
        longShortRatio: longShortData,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error fetching OKX futures data:', error);
      throw error;
    }
  }

  private async getOpenInterest(): Promise<{ long: number; short: number }> {
    const response = await fetch(
      `${this.API_BASE}/api/v5/public/open-interest?instId=${this.SYMBOL}`
    );

    if (!response.ok) {
      throw new Error(`OKX Open Interest API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code !== '0' || !result.data || result.data.length === 0) {
      throw new Error(`OKX Open Interest API error: ${result.msg || 'No data'}`);
    }

    const totalOI = parseFloat(result.data[0].oi);

    return {
      long: totalOI * 0.5,
      short: totalOI * 0.5,
    };
  }

  private async getLongShortRatio(): Promise<number> {
    const response = await fetch(
      `${this.API_BASE}/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=5m&limit=1`
    );

    if (!response.ok) {
      throw new Error(`OKX Long/Short Ratio API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code !== '0' || !result.data || result.data.length === 0) {
      return 1.0;
    }

    const longRatio = parseFloat(result.data[0].longRatio);
    const shortRatio = parseFloat(result.data[0].shortRatio);

    if (shortRatio === 0) return 1.0;
    return longRatio / shortRatio;
  }
}

export class FuturesMarketService {
  private exchanges: Map<string, ExchangeFuturesService>;

  constructor() {
    this.exchanges = new Map<string, ExchangeFuturesService>();
    this.exchanges.set('binance', new BinanceFuturesService());
    this.exchanges.set('bybit', new BybitFuturesService());
    this.exchanges.set('okx', new OKXFuturesService());
  }

  async getAggregatedMarketData(): Promise<{
    totalOpenInterest: { long: number; short: number };
    avgLongShortRatio: number;
    avgLongPercentage: number;
    avgShortPercentage: number;
    timestamp: number;
  }> {
    const results = await Promise.allSettled(
      Array.from(this.exchanges.entries()).map(async ([name, service]) => {
        try {
          return await service.getMarketData();
        } catch (error) {
          console.error(`Failed to fetch futures data from ${name}:`, error);
          return null;
        }
      })
    );

    let totalLong = 0;
    let totalShort = 0;
    let ratioSum = 0;
    let successCount = 0;

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        totalLong += result.value.openInterest.long;
        totalShort += result.value.openInterest.short;
        ratioSum += result.value.longShortRatio;
        successCount++;
      }
    }

    if (successCount === 0) {
      throw new Error('Failed to fetch futures data from all exchanges');
    }

    const totalOI = totalLong + totalShort;
    const longPct = totalOI > 0 ? (totalLong / totalOI) * 100 : 50;
    const shortPct = totalOI > 0 ? (totalShort / totalOI) * 100 : 50;

    return {
      totalOpenInterest: {
        long: totalLong,
        short: totalShort,
      },
      avgLongShortRatio: ratioSum / successCount,
      avgLongPercentage: longPct,
      avgShortPercentage: shortPct,
      timestamp: Date.now(),
    };
  }
}

export const futuresMarketService = new FuturesMarketService();
