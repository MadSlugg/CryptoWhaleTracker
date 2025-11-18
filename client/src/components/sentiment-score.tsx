import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import type { BitcoinOrder } from "@shared/schema";

interface SentimentScoreProps {
  orders: BitcoinOrder[];
  currentPrice: number;
}

export function SentimentScore({ orders, currentPrice }: SentimentScoreProps) {
  // Calculate AI-driven sentiment score (0-100 scale)
  const calculateSentiment = () => {
    if (orders.length === 0) return { score: 50, label: 'NEUTRAL', color: 'bg-muted' };

    // Time decay factor: recent orders matter more (last hour = 1.0x, 24h ago = 0.3x)
    const now = Date.now();
    const getTimeWeight = (timestamp: string) => {
      const ageMs = now - new Date(timestamp).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      // Exponential decay: recent orders have much more weight
      return Math.exp(-ageHours / 8); // 8-hour half-life
    };

    // Position weight: orders near current price matter more
    const getPriceWeight = (orderPrice: number) => {
      const deviation = Math.abs(orderPrice - currentPrice) / currentPrice;
      // Orders within 5% of current price have full weight, decay beyond that
      return Math.max(0.2, 1 - deviation * 10);
    };

    // Calculate weighted sentiment
    let bullishScore = 0;
    let bearishScore = 0;

    orders.forEach(order => {
      const timeWeight = getTimeWeight(order.timestamp);
      const priceWeight = getPriceWeight(order.price);
      const sizeWeight = Math.log10(order.size + 1); // Logarithmic size weight
      
      const totalWeight = timeWeight * priceWeight * sizeWeight;

      if (order.type === 'long') {
        bullishScore += totalWeight;
      } else {
        bearishScore += totalWeight;
      }
    });

    // Convert to 0-100 scale with sigmoid-like curve
    const totalScore = bullishScore + bearishScore;
    if (totalScore === 0) return { score: 50, label: 'NEUTRAL', color: 'bg-muted' };

    const rawRatio = bullishScore / totalScore;
    // Apply sigmoid transformation for smooth scaling
    const score = Math.round(100 / (1 + Math.exp(-8 * (rawRatio - 0.5))));

    // Determine sentiment label
    let label: string;
    let color: string;
    
    if (score >= 75) {
      label = 'EXTREMELY BULLISH';
      color = 'bg-green-600 text-white';
    } else if (score >= 60) {
      label = 'BULLISH';
      color = 'bg-green-500 text-white';
    } else if (score >= 55) {
      label = 'SLIGHTLY BULLISH';
      color = 'bg-green-400 text-black';
    } else if (score >= 45) {
      label = 'NEUTRAL';
      color = 'bg-muted';
    } else if (score >= 40) {
      label = 'SLIGHTLY BEARISH';
      color = 'bg-red-400 text-black';
    } else if (score >= 25) {
      label = 'BEARISH';
      color = 'bg-red-500 text-white';
    } else {
      label = 'EXTREMELY BEARISH';
      color = 'bg-red-600 text-white';
    }

    return { score, label, color, bullishScore, bearishScore };
  };

  const sentiment = calculateSentiment();

  // Calculate volume breakdown
  const longVolume = orders
    .filter(o => o.type === 'long')
    .reduce((sum, o) => sum + o.size, 0);
  
  const shortVolume = orders
    .filter(o => o.type === 'short')
    .reduce((sum, o) => sum + o.size, 0);

  const totalVolume = longVolume + shortVolume;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" data-testid="icon-sentiment" />
          Whale Sentiment Index
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          AI-driven sentiment analysis from whale order patterns. Considers recency, size, and price positioning.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Sentiment Score Display */}
          <div className="flex flex-col items-center gap-3 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-5xl font-bold font-mono" data-testid="text-sentiment-score">
                  {sentiment.score}
                </div>
                <div className="text-xs text-muted-foreground mt-1">out of 100</div>
              </div>
              
              <div className="flex flex-col gap-2">
                <Badge 
                  className={sentiment.color}
                  data-testid="badge-sentiment-label"
                >
                  {sentiment.label}
                </Badge>
                
                {sentiment.score > 50 ? (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs font-semibold">Whales are bullish</span>
                  </div>
                ) : sentiment.score < 50 ? (
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-xs font-semibold">Whales are bearish</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Activity className="h-4 w-4" />
                    <span className="text-xs font-semibold">Market neutral</span>
                  </div>
                )}
              </div>
            </div>

            {/* Visual sentiment bar */}
            <div className="w-full space-y-1">
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 via-muted to-green-600 transition-all duration-500"
                  style={{ 
                    transform: `translateX(${sentiment.score - 50}%)`,
                    opacity: 0.8 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Bearish</span>
                <span>Neutral</span>
                <span>Bullish</span>
              </div>
            </div>
          </div>

          {/* Volume breakdown */}
          {totalVolume > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Volume Breakdown</div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-muted-foreground">Long Orders</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold" data-testid="text-long-volume">
                      {longVolume.toFixed(2)} BTC
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {((longVolume / totalVolume) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-3 w-3 text-red-600" />
                    <span className="text-xs text-muted-foreground">Short Orders</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold" data-testid="text-short-volume">
                      {shortVolume.toFixed(2)} BTC
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {((shortVolume / totalVolume) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Methodology note */}
          <div className="text-xs text-muted-foreground p-2 rounded bg-muted/50">
            <span className="font-semibold">Methodology:</span> Score weighs recent orders more heavily (exponential time decay), 
            prioritizes orders near current price, and applies logarithmic size weighting to emphasize larger whales.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
