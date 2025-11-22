import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import type { BitcoinOrder } from "@shared/schema";

interface EntrySignalsProps {
  orders: BitcoinOrder[];
  currentPrice: number;
}

interface EntrySignal {
  price: number;
  type: 'long' | 'short';
  strength: 'strong' | 'moderate' | 'weak';
  reasons: string[];
  whaleVolume: number;
  orderCount: number;
}

export function EntrySignals({ orders, currentPrice }: EntrySignalsProps) {
  const findEntrySignals = (): EntrySignal[] => {
    const signals: EntrySignal[] = [];
    const activeOrders = orders.filter(o => o.status === 'active');
    
    // Group orders into $500 price buckets for precise entry analysis
    const bucketSize = 500;
    const priceLevels = new Map<number, { longs: BitcoinOrder[], shorts: BitcoinOrder[] }>();
    
    activeOrders.forEach(order => {
      const bucket = Math.floor(order.price / bucketSize) * bucketSize;
      if (!priceLevels.has(bucket)) {
        priceLevels.set(bucket, { longs: [], shorts: [] });
      }
      const level = priceLevels.get(bucket)!;
      if (order.type === 'long') {
        level.longs.push(order);
      } else {
        level.shorts.push(order);
      }
    });

    // Analyze each price level for entry signals
    priceLevels.forEach((level, price) => {
      const longVolume = level.longs.reduce((sum, o) => sum + o.size, 0);
      const shortVolume = level.shorts.reduce((sum, o) => sum + o.size, 0);
      const totalVolume = longVolume + shortVolume;
      const longCount = level.longs.length;
      const shortCount = level.shorts.length;
      
      // Skip levels with insufficient volume
      if (totalVolume < 10) return;
      
      // Calculate price distance from current
      const priceDistance = Math.abs(price - currentPrice);
      const priceDeviation = priceDistance / currentPrice;
      
      // Only consider levels within 15% of current price (realistic entry zones)
      if (priceDeviation > 0.15) return;

      const reasons: string[] = [];
      let strength: 'strong' | 'moderate' | 'weak' = 'weak';
      
      // LONG ENTRY SIGNALS (buy opportunities)
      if (longVolume > shortVolume * 1.5) {
        // Strong buy wall below current price = support level
        if (price < currentPrice) {
          reasons.push(`Strong buy support: ${longVolume.toFixed(2)} BTC in buy orders`);
          
          if (longCount >= 5) {
            reasons.push(`Multiple whales (${longCount} orders) creating support`);
          }
          
          if (longVolume > 150) {
            reasons.push('Massive whale accumulation zone');
            strength = 'strong';
          } else if (longVolume > 75) {
            reasons.push('Large whale accumulation zone');
            strength = 'moderate';
          }
          
          // Check for recent filled shorts near this level (trapped sellers)
          const recentFilledShorts = orders.filter(o => 
            o.status === 'filled' && 
            o.type === 'short' && 
            Math.abs(o.price - price) < bucketSize &&
            Date.now() - new Date(o.timestamp).getTime() < 3600000 // Last hour
          );
          
          if (recentFilledShorts.length > 0) {
            const trappedVolume = recentFilledShorts.reduce((sum, o) => sum + o.size, 0);
            reasons.push(`Short sellers trapped (${trappedVolume.toFixed(2)} BTC) - potential squeeze`);
            // Only upgrade if trapped volume is significant
            if (strength === 'weak' && trappedVolume > 30) {
              strength = 'moderate';
            } else if (strength === 'moderate' && trappedVolume > 75) {
              strength = 'strong';
            }
          }
          
          signals.push({
            price,
            type: 'long',
            strength,
            reasons,
            whaleVolume: longVolume,
            orderCount: longCount
          });
        }
      }
      
      // SHORT ENTRY SIGNALS (sell opportunities)
      if (shortVolume > longVolume * 1.5) {
        // Strong sell wall above current price = resistance level
        if (price > currentPrice) {
          reasons.push(`Strong sell resistance: ${shortVolume.toFixed(2)} BTC in sell orders`);
          
          if (shortCount >= 5) {
            reasons.push(`Multiple whales (${shortCount} orders) creating resistance`);
          }
          
          if (shortVolume > 150) {
            reasons.push('Massive whale distribution zone');
            strength = 'strong';
          } else if (shortVolume > 75) {
            reasons.push('Large whale distribution zone');
            strength = 'moderate';
          }
          
          // Check for recent filled longs near this level (trapped buyers)
          const recentFilledLongs = orders.filter(o => 
            o.status === 'filled' && 
            o.type === 'long' && 
            Math.abs(o.price - price) < bucketSize &&
            Date.now() - new Date(o.timestamp).getTime() < 3600000 // Last hour
          );
          
          if (recentFilledLongs.length > 0) {
            const trappedVolume = recentFilledLongs.reduce((sum, o) => sum + o.size, 0);
            reasons.push(`Long buyers trapped (${trappedVolume.toFixed(2)} BTC) - potential dump`);
            // Only upgrade if trapped volume is significant
            if (strength === 'weak' && trappedVolume > 30) {
              strength = 'moderate';
            } else if (strength === 'moderate' && trappedVolume > 75) {
              strength = 'strong';
            }
          }
          
          signals.push({
            price,
            type: 'short',
            strength,
            reasons,
            whaleVolume: shortVolume,
            orderCount: shortCount
          });
        }
      }
    });

    // Sort by strength and whale volume
    return signals.sort((a, b) => {
      const strengthScore = { strong: 3, moderate: 2, weak: 1 };
      if (strengthScore[b.strength] !== strengthScore[a.strength]) {
        return strengthScore[b.strength] - strengthScore[a.strength];
      }
      return b.whaleVolume - a.whaleVolume;
    }).slice(0, 5); // Show top 5 signals
  };

  const signals = findEntrySignals();

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong':
        return 'bg-primary text-primary-foreground';
      case 'moderate':
        return 'bg-secondary';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" data-testid="icon-entry-signals" />
          Price Entry Signals
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Analyzes whale order positioning to identify potential entry points. Based on support/resistance levels created by large orders.
        </p>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No clear entry signals detected at current price levels
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Whale orders may be too dispersed or outside realistic entry range (±15%)
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map((signal, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  signal.type === 'long' 
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' 
                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                }`}
                data-testid={`signal-${idx}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {signal.type === 'long' ? (
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" data-testid={`icon-long-${idx}`} />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" data-testid={`icon-short-${idx}`} />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-mono font-bold" data-testid={`text-price-${idx}`}>
                          ${Math.round(signal.price).toLocaleString()}
                        </span>
                        <Badge 
                          variant={signal.type === 'long' ? 'default' : 'destructive'}
                          data-testid={`badge-type-${idx}`}
                        >
                          {signal.type.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {((Math.abs(signal.price - currentPrice) / currentPrice) * 100).toFixed(1)}% from current
                      </div>
                    </div>
                  </div>
                  
                  <Badge 
                    className={getStrengthColor(signal.strength)}
                    data-testid={`badge-strength-${idx}`}
                  >
                    {signal.strength.toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-1.5 mb-2">
                  {signal.reasons.map((reason, rIdx) => (
                    <div key={rIdx} className="flex items-start gap-2 text-xs">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-muted-foreground">{reason}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Whale Volume: </span>
                    <span className="font-mono font-semibold" data-testid={`text-volume-${idx}`}>
                      {signal.whaleVolume.toFixed(2)} BTC
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Orders: </span>
                    <span className="font-semibold" data-testid={`text-count-${idx}`}>
                      {signal.orderCount}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <strong>Note:</strong> Entry signals are based on whale order positioning and should not be used as sole trading advice. 
              Always conduct your own research and consider multiple factors before entering positions.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
