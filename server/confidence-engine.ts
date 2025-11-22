import type { BitcoinOrder } from '@shared/schema';

export interface SupportResistanceLevel {
  price: number;
  supportBTC: number;
  resistanceBTC: number;
  netLiquidity: number;
}

export interface FuturesMarketData {
  totalLongOI: number;
  totalShortOI: number;
  longPercentage: number;
  shortPercentage: number;
}

export interface ConfidenceScore {
  price: number;
  direction: 'long' | 'short';
  spotLiquidityBTC: number;
  futuresAlignment: number;
  confidence: number;
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  reasoning: string;
}

export class ConfidenceEngine {
  private readonly CLUSTER_RANGE = 100;
  private readonly MIN_WHALE_SIZE = 50;
  
  calculateSupportResistanceLevels(
    orders: BitcoinOrder[],
    currentPrice: number,
    rangePercent: number = 5
  ): SupportResistanceLevel[] {
    const priceMin = currentPrice * (1 - rangePercent / 100);
    const priceMax = currentPrice * (1 + rangePercent / 100);

    const relevantOrders = orders.filter(
      order => order.status === 'active' && order.price >= priceMin && order.price <= priceMax
    );

    const clusters = new Map<number, { support: number; resistance: number }>();

    for (const order of relevantOrders) {
      const clusterPrice = Math.round(order.price / this.CLUSTER_RANGE) * this.CLUSTER_RANGE;

      if (!clusters.has(clusterPrice)) {
        clusters.set(clusterPrice, { support: 0, resistance: 0 });
      }

      const cluster = clusters.get(clusterPrice)!;
      if (order.type === 'long') {
        cluster.support += order.size;
      } else {
        cluster.resistance += order.size;
      }
    }

    return Array.from(clusters.entries())
      .map(([price, { support, resistance }]) => ({
        price,
        supportBTC: support,
        resistanceBTC: resistance,
        netLiquidity: support - resistance,
      }))
      .sort((a, b) => Math.abs(b.netLiquidity) - Math.abs(a.netLiquidity));
  }

  calculateConfidenceScores(
    levels: SupportResistanceLevel[],
    futuresData: FuturesMarketData,
    currentPrice: number
  ): ConfidenceScore[] {
    const scores: ConfidenceScore[] = [];
    
    const netFuturesBias = (futuresData.longPercentage - futuresData.shortPercentage) / 100;
    
    for (const level of levels) {
      if (level.price < currentPrice && level.supportBTC >= this.MIN_WHALE_SIZE) {
        const spotStrength = this.calculateSpotStrength(level.supportBTC);
        
        const biasPct = netFuturesBias * 100;
        
        let baseConfidence = spotStrength;
        if (biasPct > 10) {
          baseConfidence += 15;
        } else if (biasPct > 5) {
          baseConfidence += 10;
        } else if (biasPct < -5) {
          baseConfidence -= 10;
        }
        
        const confidence = Math.max(15, Math.min(95, baseConfidence));
        const signal = this.confidenceToSignal(confidence, 'long');
        
        const reasoning = this.generateReasoning(
          'long',
          level.supportBTC,
          spotStrength,
          netFuturesBias,
          confidence
        );

        scores.push({
          price: level.price,
          direction: 'long',
          spotLiquidityBTC: level.supportBTC,
          futuresAlignment: biasPct,
          confidence,
          signal,
          reasoning,
        });
      }

      if (level.price > currentPrice && level.resistanceBTC >= this.MIN_WHALE_SIZE) {
        const spotStrength = this.calculateSpotStrength(level.resistanceBTC);
        
        const biasPct = -netFuturesBias * 100;
        
        let baseConfidence = spotStrength;
        if (biasPct > 10) {
          baseConfidence += 15;
        } else if (biasPct > 5) {
          baseConfidence += 10;
        } else if (biasPct < -5) {
          baseConfidence -= 10;
        }
        
        const confidence = Math.max(15, Math.min(95, baseConfidence));
        const signal = this.confidenceToSignal(confidence, 'short');
        
        const reasoning = this.generateReasoning(
          'short',
          level.resistanceBTC,
          spotStrength,
          -netFuturesBias,
          confidence
        );

        scores.push({
          price: level.price,
          direction: 'short',
          spotLiquidityBTC: level.resistanceBTC,
          futuresAlignment: biasPct,
          confidence,
          signal,
          reasoning,
        });
      }
    }

    return scores.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateSpotStrength(liquidityBTC: number): number {
    if (liquidityBTC >= 1000) return 80;
    if (liquidityBTC >= 500) return 65;
    if (liquidityBTC >= 200) return 50;
    if (liquidityBTC >= 100) return 40;
    return 25;
  }

  private generateReasoning(
    direction: 'long' | 'short',
    liquidityBTC: number,
    spotStrength: number,
    futuresBias: number,
    finalConfidence: number
  ): string {
    const directionName = direction === 'long' ? 'support' : 'resistance';
    const futuresDirection = direction === 'long' ? 'long' : 'short';
    
    const parts: string[] = [];
    
    if (liquidityBTC >= 1000) {
      parts.push(`MEGA ${directionName.toUpperCase()} (${liquidityBTC.toFixed(0)} BTC)`);
    } else if (liquidityBTC >= 500) {
      parts.push(`Very strong ${directionName} (${liquidityBTC.toFixed(0)} BTC)`);
    } else if (liquidityBTC >= 200) {
      parts.push(`Strong ${directionName} (${liquidityBTC.toFixed(0)} BTC)`);
    } else {
      parts.push(`Moderate ${directionName} (${liquidityBTC.toFixed(0)} BTC)`);
    }
    
    const futuresAlignmentPct = Math.abs(futuresBias * 100);
    if (futuresBias > 0.1) {
      parts.push(`futures ${futuresDirection}-biased (+${futuresAlignmentPct.toFixed(1)}%)`);
    } else if (futuresBias < -0.05) {
      parts.push(`futures opposing (-${futuresAlignmentPct.toFixed(1)}%)`);
    } else {
      parts.push('futures neutral');
    }
    
    return parts.join(', ');
  }

  private confidenceToSignal(
    confidence: number,
    direction: 'long' | 'short'
  ): 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL' {
    if (direction === 'long') {
      if (confidence >= 80) return 'STRONG_BUY';
      if (confidence >= 50) return 'BUY';
      return 'NEUTRAL';
    } else {
      if (confidence >= 80) return 'STRONG_SELL';
      if (confidence >= 50) return 'SELL';
      return 'NEUTRAL';
    }
  }

  getBestEntryPoint(scores: ConfidenceScore[], direction: 'long' | 'short'): ConfidenceScore | null {
    const filteredScores = scores.filter(s => s.direction === direction && s.confidence >= 50);
    
    if (filteredScores.length === 0) return null;
    
    return filteredScores.reduce((best, current) => {
      if (current.confidence > best.confidence) return current;
      if (current.confidence === best.confidence) {
        if (direction === 'long') {
          return current.price > best.price ? current : best;
        } else {
          return current.price < best.price ? current : best;
        }
      }
      return best;
    });
  }
}

export const confidenceEngine = new ConfidenceEngine();
