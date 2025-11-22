import type { Request, Response } from "express";
import { storage } from "./storage";
import type { Exchange, PriceLevel } from "@shared/schema";
import { futuresMarketService } from "./futures-market";
import { confidenceEngine } from "./confidence-engine";
import { liquiditySnapshotService } from "./liquidity-snapshot";

export async function handleEntryPoints(req: Request, res: Response) {
  try {
    let exchange: Exchange = 'all';
    if (req.query.exchange) {
      const ex = req.query.exchange as string;
      if (!['binance', 'kraken', 'coinbase', 'okx', 'bybit', 'bitfinex', 'gemini', 'bitstamp', 'htx', 'kucoin', 'all'].includes(ex)) {
        return res.status(400).json({ error: 'Invalid exchange parameter' });
      }
      exchange = ex as Exchange;
    }

    let futuresData: { totalLongOI: number; totalShortOI: number; longPercentage: number; shortPercentage: number };
    try {
      const marketData = await futuresMarketService.getAggregatedMarketData();
      futuresData = {
        totalLongOI: marketData.totalOpenInterest.long,
        totalShortOI: marketData.totalOpenInterest.short,
        longPercentage: marketData.avgLongPercentage,
        shortPercentage: marketData.avgShortPercentage,
      };
    } catch (error) {
      console.error('Failed to fetch futures data, using neutral defaults:', error);
      futuresData = { totalLongOI: 0, totalShortOI: 0, longPercentage: 50, shortPercentage: 50 };
    }

    // Get liquidity snapshot instead of database orders
    const snapshot = liquiditySnapshotService.getLatestSnapshot();
    if (!snapshot) {
      return res.status(503).json({ 
        error: 'Liquidity data not yet available',
        recommendation: 'neutral',
        confidence: 50
      });
    }

    const currentPrice = snapshot.currentPrice;
    
    // Filter price levels by exchange if specified
    let filteredLevels = snapshot.levels;
    if (exchange !== 'all') {
      filteredLevels = snapshot.levels.filter(level => 
        level.exchanges.includes(exchange)
      );
    }

    // Convert PriceLevel[] to SupportResistanceLevel[] format
    const levels = filteredLevels.map(level => ({
      price: level.price,
      supportBTC: level.buyLiquidity,      // Buy orders provide support
      resistanceBTC: level.sellLiquidity,  // Sell orders provide resistance
      netLiquidity: level.buyLiquidity - level.sellLiquidity
    }));

    const confidenceScores = confidenceEngine.calculateConfidenceScores(levels, futuresData, currentPrice);

    const bestLongEntry = confidenceEngine.getBestEntryPoint(confidenceScores, 'long');
    const bestShortEntry = confidenceEngine.getBestEntryPoint(confidenceScores, 'short');

    let recommendation: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' = 'neutral';
    let confidence = 50;
    let entryPrice = currentPrice;
    let reasoning: string[] = [];
    let support: number | null = null;
    let resistance: number | null = null;

    if (bestLongEntry && bestLongEntry.confidence > 60) {
      recommendation = bestLongEntry.signal === 'STRONG_BUY' ? 'strong_buy' : 'buy';
      confidence = Math.round(bestLongEntry.confidence);
      entryPrice = bestLongEntry.price;
      support = bestLongEntry.price;
      reasoning.push(`Entry: $${bestLongEntry.price.toLocaleString()} - ${bestLongEntry.reasoning}`);
      reasoning.push(`Confidence: ${confidence}%`);
    } else if (bestShortEntry && bestShortEntry.confidence > 60) {
      recommendation = bestShortEntry.signal === 'STRONG_SELL' ? 'strong_sell' : 'sell';
      confidence = Math.round(bestShortEntry.confidence);
      entryPrice = bestShortEntry.price;
      resistance = bestShortEntry.price;
      reasoning.push(`Entry: $${bestShortEntry.price.toLocaleString()} - ${bestShortEntry.reasoning}`);
      reasoning.push(`Confidence: ${confidence}%`);
    } else {
      recommendation = 'neutral';
      confidence = 50;
      entryPrice = currentPrice;
      reasoning.push('No strong entry signals detected (need 50+ BTC whale orders + confidence >60%)');
      
      if (bestLongEntry) {
        support = bestLongEntry.price;
        reasoning.push(`Nearest support: $${bestLongEntry.price.toLocaleString()} - ${bestLongEntry.reasoning} (${Math.round(bestLongEntry.confidence)}% confidence)`);
      }
      if (bestShortEntry) {
        resistance = bestShortEntry.price;
        reasoning.push(`Nearest resistance: $${bestShortEntry.price.toLocaleString()} - ${bestShortEntry.reasoning} (${Math.round(bestShortEntry.confidence)}% confidence)`);
      }
    }

    res.json({
      recommendation,
      confidence,
      currentPrice,
      entryPrice,
      reasoning,
      signals: {
        filledOrderFlow: {
          score: 0,
          signal: 'neutral',
        },
        orderBookImbalance: {
          score: 0,
          signal: 'balanced',
        },
      },
      support,
      resistance,
      futuresData: {
        longOpenInterest: futuresData.totalLongOI,
        shortOpenInterest: futuresData.totalShortOI,
        longPercentage: futuresData.longPercentage,
        shortPercentage: futuresData.shortPercentage,
      },
      confidenceModel: {
        description: 'Spot liquidity strength + futures market alignment',
        spotStrength: {
          '1000+ BTC': '80% base confidence',
          '500+ BTC': '65% base confidence',
          '200+ BTC': '50% base confidence',
          '100+ BTC': '40% base confidence',
          '50+ BTC': '25% base confidence',
        },
        futuresBonus: {
          'Strong alignment (>10%)': '+15% confidence',
          'Moderate alignment (>5%)': '+10% confidence',
          'Opposing (<-5%)': '-10% confidence',
        },
      },
    });
  } catch (error) {
    console.error('Error generating entry points:', error);
    res.status(500).json({ error: 'Failed to generate entry point recommendations' });
  }
}
