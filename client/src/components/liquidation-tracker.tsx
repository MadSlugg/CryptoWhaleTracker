import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown, Zap } from "lucide-react";
import type { BitcoinOrder } from "@shared/schema";

interface LiquidationTrackerProps {
  orders: BitcoinOrder[];
  currentPrice: number;
}

interface LiquidationCluster {
  price: number;
  type: 'long' | 'short';
  volume: number;
  orderCount: number;
  distance: number;
  impact: string;
  explanation: string;
  cascadeRisk: 'high' | 'medium' | 'low';
}

export function LiquidationTracker({ orders, currentPrice }: LiquidationTrackerProps) {
  const findLiquidationClusters = (): LiquidationCluster[] => {
    const clusters: LiquidationCluster[] = [];
    
    // Simulate liquidation levels based on whale orders
    // In reality, these would come from exchange liquidation data
    // We estimate liquidation levels assuming traders use 10x-20x leverage
    
    const bucketSize = 1000;
    const priceLevels = new Map<number, { longs: BitcoinOrder[], shorts: BitcoinOrder[] }>();
    
    orders.forEach(order => {
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

    priceLevels.forEach((level, price) => {
      const longVolume = level.longs.reduce((sum, o) => sum + o.size, 0);
      const shortVolume = level.shorts.reduce((sum, o) => sum + o.size, 0);
      
      // For long positions, liquidation occurs ~5-10% below entry
      // For short positions, liquidation occurs ~5-10% above entry
      
      // Long liquidation clusters (triggered when price drops)
      if (longVolume > 10) {
        const liquidationPrice = Math.floor(price * 0.90); // ~10% below for 10x leverage
        const distance = ((currentPrice - liquidationPrice) / currentPrice) * 100;
        
        // Only show clusters within realistic range (±30%)
        if (distance >= -30 && distance <= 30) {
          let impact = '';
          let explanation = '';
          let cascadeRisk: 'high' | 'medium' | 'low' = 'low';
          
          if (liquidationPrice < currentPrice) {
            // Below current price - if price drops here
            if (longVolume > 50) {
              impact = 'STRONG SELLING PRESSURE';
              explanation = `If price drops to $${liquidationPrice.toLocaleString()}, ${longVolume.toFixed(2)} BTC in long positions will be forcefully SOLD. This will push price DOWN further, potentially triggering a cascade of more liquidations.`;
              cascadeRisk = 'high';
            } else if (longVolume > 20) {
              impact = 'MODERATE SELLING PRESSURE';
              explanation = `If price drops to $${liquidationPrice.toLocaleString()}, ${longVolume.toFixed(2)} BTC in long positions will be liquidated and sold. This could accelerate the downward move.`;
              cascadeRisk = 'medium';
            } else {
              impact = 'MINOR SELLING PRESSURE';
              explanation = `If price drops to $${liquidationPrice.toLocaleString()}, ${longVolume.toFixed(2)} BTC in long positions will be liquidated. Impact on price will be limited.`;
              cascadeRisk = 'low';
            }
          } else {
            // Above current price - already liquidated or safe zone
            return;
          }
          
          clusters.push({
            price: liquidationPrice,
            type: 'long',
            volume: longVolume,
            orderCount: level.longs.length,
            distance,
            impact,
            explanation,
            cascadeRisk
          });
        }
      }
      
      // Short liquidation clusters (triggered when price rises)
      if (shortVolume > 10) {
        const liquidationPrice = Math.ceil(price * 1.10); // ~10% above for 10x leverage
        const distance = ((liquidationPrice - currentPrice) / currentPrice) * 100;
        
        // Only show clusters within realistic range (±30%)
        if (distance >= -30 && distance <= 30) {
          let impact = '';
          let explanation = '';
          let cascadeRisk: 'high' | 'medium' | 'low' = 'low';
          
          if (liquidationPrice > currentPrice) {
            // Above current price - if price rises here
            if (shortVolume > 50) {
              impact = 'STRONG BUYING PRESSURE';
              explanation = `If price rises to $${liquidationPrice.toLocaleString()}, ${shortVolume.toFixed(2)} BTC in short positions will be forcefully BOUGHT. This will push price UP further, potentially triggering a cascade of more liquidations (short squeeze).`;
              cascadeRisk = 'high';
            } else if (shortVolume > 20) {
              impact = 'MODERATE BUYING PRESSURE';
              explanation = `If price rises to $${liquidationPrice.toLocaleString()}, ${shortVolume.toFixed(2)} BTC in short positions will be liquidated and bought. This could accelerate the upward move.`;
              cascadeRisk = 'medium';
            } else {
              impact = 'MINOR BUYING PRESSURE';
              explanation = `If price rises to $${liquidationPrice.toLocaleString()}, ${shortVolume.toFixed(2)} BTC in short positions will be liquidated. Impact on price will be limited.`;
              cascadeRisk = 'low';
            }
          } else {
            // Below current price - already liquidated or safe zone
            return;
          }
          
          clusters.push({
            price: liquidationPrice,
            type: 'short',
            volume: shortVolume,
            orderCount: level.shorts.length,
            distance,
            impact,
            explanation,
            cascadeRisk
          });
        }
      }
    });

    // Sort by distance from current price (closest first)
    return clusters.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance)).slice(0, 8);
  };

  const clusters = findLiquidationClusters();

  const getCascadeColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'bg-red-600 text-white';
      case 'medium':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-yellow-500 text-black';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-primary" data-testid="icon-liquidations" />
          Liquidation Tracker
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Shows where leveraged positions will be forcefully closed. When price reaches these levels, 
          liquidations trigger automatic buying or selling that can accelerate price movement.
        </p>
      </CardHeader>
      <CardContent>
        {clusters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="empty-state-liquidations">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No significant liquidation clusters detected
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Liquidation zones form when many leveraged traders enter at similar prices
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clusters.map((cluster, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-2 ${
                  cluster.type === 'long'
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                    : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                }`}
                data-testid={`cluster-${idx}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {cluster.type === 'long' ? (
                      <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-mono font-bold" data-testid={`text-price-${idx}`}>
                          ${cluster.price.toLocaleString()}
                        </span>
                        <Badge 
                          variant={cluster.type === 'long' ? 'destructive' : 'default'}
                          data-testid={`badge-type-${idx}`}
                        >
                          {cluster.type.toUpperCase()} LIQ
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-distance-${idx}`}>
                        {Math.abs(cluster.distance).toFixed(1)}% {cluster.distance > 0 ? 'above' : 'below'} current
                      </div>
                    </div>
                  </div>
                  
                  <Badge 
                    className={getCascadeColor(cluster.cascadeRisk)}
                    data-testid={`badge-cascade-${idx}`}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    {cluster.cascadeRisk.toUpperCase()} RISK
                  </Badge>
                </div>

                {/* Impact */}
                <div className="mb-3">
                  <div className="text-sm font-semibold mb-1" data-testid={`text-impact-${idx}`}>
                    {cluster.impact}
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed" data-testid={`text-explanation-${idx}`}>
                    {cluster.explanation}
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Liquidation Volume: </span>
                    <span className="font-mono font-semibold" data-testid={`text-volume-${idx}`}>
                      {cluster.volume.toFixed(2)} BTC
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Positions: </span>
                    <span className="font-semibold" data-testid={`text-count-${idx}`}>
                      {cluster.orderCount}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">USD Value: </span>
                    <span className="font-mono font-semibold" data-testid={`text-usd-value-${idx}`}>
                      ${(cluster.volume * cluster.price / 1000000).toFixed(2)}M
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Educational Footer */}
            <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="text-xs font-semibold">How to Use Liquidation Clusters:</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div><strong>Avoid Getting Liquidated:</strong> If you have leveraged positions, make sure they're not near these levels</div>
                <div><strong>Anticipate Cascades:</strong> High-risk clusters can trigger chain reactions - price may accelerate through them</div>
                <div><strong>Trade the Bounce:</strong> After large liquidation clusters are hit, price often reverses temporarily</div>
                <div><strong>Follow Smart Money:</strong> Whales often push price toward liquidation clusters to create liquidity</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
