import { storage } from './storage';
import { binanceService } from './binance';
import type { WhaleMovement, LongShortRatio } from '@shared/schema';

interface PendingCorrelation {
  whaleMovement: WhaleMovement;
  initialRatio: number;
  checkTime: number; // Timestamp when to check the ratio again
}

export class WhaleCorrelationService {
  private pendingCorrelations: Map<string, PendingCorrelation> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private ratioPollingInterval: NodeJS.Timeout | null = null;
  
  start() {
    console.log('[WhaleCorrelation] Starting whale correlation tracking service...');
    
    // Poll long/short ratios every 15 minutes
    this.ratioPollingInterval = setInterval(async () => {
      await this.updateLongShortRatios();
    }, 15 * 60 * 1000); // 15 minutes
    
    // Initial fetch
    this.updateLongShortRatios();
    
    // Check pending correlations every minute
    this.checkInterval = setInterval(() => {
      this.checkPendingCorrelations();
    }, 60 * 1000);
  }
  
  /**
   * Fetch and store latest long/short ratio data
   */
  private async updateLongShortRatios() {
    try {
      // Fetch both global and top trader ratios
      const [globalRatios, topTraderRatios] = await Promise.all([
        binanceService.getLongShortRatio('15m', 10, false),
        binanceService.getLongShortRatio('15m', 10, true),
      ]);
      
      // Store in database
      for (const ratio of globalRatios) {
        await storage.addLongShortRatio({
          timestamp: new Date(ratio.timestamp).toISOString(),
          symbol: ratio.symbol,
          longShortRatio: parseFloat(ratio.longShortRatio),
          longAccount: parseFloat(ratio.longAccount),
          shortAccount: parseFloat(ratio.shortAccount),
          period: '15m',
          isTopTrader: false,
        });
      }
      
      for (const ratio of topTraderRatios) {
        await storage.addLongShortRatio({
          timestamp: new Date(ratio.timestamp).toISOString(),
          symbol: ratio.symbol,
          longShortRatio: parseFloat(ratio.longShortRatio),
          longAccount: parseFloat(ratio.longAccount),
          shortAccount: parseFloat(ratio.shortAccount),
          period: '15m',
          isTopTrader: true,
        });
      }
      
      console.log(`[WhaleCorrelation] Updated long/short ratios (${globalRatios.length} global, ${topTraderRatios.length} top trader)`);
    } catch (error) {
      console.error('[WhaleCorrelation] Error updating long/short ratios:', error);
    }
  }
  
  /**
   * Track a whale movement and schedule correlation check
   */
  async trackWhaleMovement(whaleMovement: WhaleMovement) {
    try {
      // Get current long/short ratio
      const latestRatio = await storage.getLatestLongShortRatio(true); // Use top trader ratio
      
      if (!latestRatio) {
        console.log('[WhaleCorrelation] No ratio data available yet, skipping correlation');
        return;
      }
      
      // Schedule check for 15 minutes later
      const checkTime = Date.now() + 15 * 60 * 1000;
      
      this.pendingCorrelations.set(whaleMovement.id, {
        whaleMovement,
        initialRatio: latestRatio.longShortRatio,
        checkTime,
      });
      
      console.log(
        `[WhaleCorrelation] Tracking ${whaleMovement.amount} BTC movement ` +
        `(initial L/S ratio: ${latestRatio.longShortRatio.toFixed(4)}), will check in 15 mins`
      );
    } catch (error) {
      console.error('[WhaleCorrelation] Error tracking whale movement:', error);
    }
  }
  
  /**
   * Check pending correlations that are due
   */
  private async checkPendingCorrelations() {
    const now = Date.now();
    const toCheck: PendingCorrelation[] = [];
    
    // Find correlations that are due for checking
    for (const [id, correlation] of this.pendingCorrelations) {
      if (now >= correlation.checkTime) {
        toCheck.push(correlation);
        this.pendingCorrelations.delete(id);
      }
    }
    
    // Process each correlation
    for (const pending of toCheck) {
      await this.analyzeCorrelation(pending);
    }
  }
  
  /**
   * Analyze correlation between whale movement and long/short ratio change
   */
  private async analyzeCorrelation(pending: PendingCorrelation) {
    try {
      const { whaleMovement, initialRatio } = pending;
      
      // Get current ratio
      const currentRatioData = await storage.getLatestLongShortRatio(true);
      if (!currentRatioData) {
        console.log('[WhaleCorrelation] No current ratio data available');
        return;
      }
      
      const currentRatio = currentRatioData.longShortRatio;
      
      // Analyze the change
      const analysis = binanceService.analyzeShortSpike(initialRatio, currentRatio);
      
      // Determine likely action based on movement direction and ratio change
      let likelyAction: 'shorting' | 'longing' | 'neutral' = 'neutral';
      
      if (whaleMovement.isToExchange) {
        // Whale moved BTC TO exchange
        if (analysis.spiked) {
          // Shorts increased = whale likely shorting
          likelyAction = 'shorting';
        } else if (analysis.percentageChange > 5) {
          // Longs increased = whale might be longing
          likelyAction = 'longing';
        }
      } else if (whaleMovement.isFromExchange) {
        // Whale moved BTC FROM exchange (accumulation)
        if (analysis.percentageChange > 5) {
          // Longs increased = bullish accumulation
          likelyAction = 'longing';
        }
      }
      
      // Create correlation record
      const correlation = await storage.addWhaleCorrelation({
        whaleMovementId: whaleMovement.id,
        timestamp: new Date().toISOString(),
        btcAmount: whaleMovement.amount,
        initialLongShortRatio: initialRatio,
        currentLongShortRatio: currentRatio,
        ratioChange: analysis.percentageChange,
        shortSpike: analysis.spiked,
        likelyAction,
        confidence: analysis.confidence,
      });
      
      console.log(
        `[WhaleCorrelation] ${whaleMovement.amount.toFixed(2)} BTC movement → ` +
        `L/S ratio changed ${analysis.percentageChange.toFixed(2)}% → ` +
        `Likely action: ${likelyAction} (confidence: ${analysis.confidence})`
      );
      
      // Log high-confidence patterns
      if (analysis.confidence === 'high' && likelyAction !== 'neutral') {
        console.log(
          `🐋 [WHALE ALERT] High confidence ${likelyAction.toUpperCase()} detected! ` +
          `${whaleMovement.amount.toFixed(2)} BTC ${whaleMovement.isToExchange ? 'to' : 'from'} exchange, ` +
          `shorts ${analysis.spiked ? 'SPIKED' : 'changed'} by ${Math.abs(analysis.percentageChange).toFixed(2)}%`
        );
      }
    } catch (error) {
      console.error('[WhaleCorrelation] Error analyzing correlation:', error);
    }
  }
  
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.ratioPollingInterval) {
      clearInterval(this.ratioPollingInterval);
      this.ratioPollingInterval = null;
    }
    this.pendingCorrelations.clear();
  }
}

export const whaleCorrelationService = new WhaleCorrelationService();
