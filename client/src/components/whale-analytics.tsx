import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface WhaleAnalyticsProps {
  orders: BitcoinOrder[];
  currentPrice: number;
}

interface PriceCluster {
  price: number;
  count: number;
  totalSize: number;
  type: 'long' | 'short' | 'mixed';
  longCount: number;
  shortCount: number;
  longSize: number;
  shortSize: number;
}

export function WhaleAnalytics({ orders, currentPrice }: WhaleAnalyticsProps) {
  // 1. Whale Pattern Detection - Find clusters at similar prices
  const detectPatterns = (): PriceCluster[] => {
    const priceRange = 1000; // Group orders within $1000 of each other
    const clusters = new Map<number, { longs: BitcoinOrder[], shorts: BitcoinOrder[] }>();
    
    orders.forEach(order => {
      // Round price to nearest $1000 to create clusters
      const clusterPrice = Math.round(order.price / priceRange) * priceRange;
      
      if (!clusters.has(clusterPrice)) {
        clusters.set(clusterPrice, { longs: [], shorts: [] });
      }
      
      const cluster = clusters.get(clusterPrice)!;
      if (order.type === 'long') {
        cluster.longs.push(order);
      } else {
        cluster.shorts.push(order);
      }
    });
    
    // Convert to array and filter significant clusters (3+ orders or 50+ BTC)
    const significantClusters: PriceCluster[] = [];
    
    clusters.forEach((cluster, price) => {
      const allOrders = [...cluster.longs, ...cluster.shorts];
      const totalSize = allOrders.reduce((sum, o) => sum + o.size, 0);
      const count = allOrders.length;
      
      if (count >= 3 || totalSize >= 50) {
        const longSize = cluster.longs.reduce((sum, o) => sum + o.size, 0);
        const shortSize = cluster.shorts.reduce((sum, o) => sum + o.size, 0);
        
        // Determine type based on BTC volume, not just presence
        let type: 'long' | 'short' | 'mixed' = 'mixed';
        const volumeDifference = Math.abs(longSize - shortSize);
        const averageVolume = (longSize + shortSize) / 2;
        
        // If one side has >20% more volume than average, it dominates
        if (volumeDifference > averageVolume * 0.2) {
          type = longSize > shortSize ? 'long' : 'short';
        }
        
        significantClusters.push({
          price,
          count,
          totalSize,
          type,
          longCount: cluster.longs.length,
          shortCount: cluster.shorts.length,
          longSize,
          shortSize,
        });
      }
    });
    
    return significantClusters.sort((a, b) => b.totalSize - a.totalSize).slice(0, 10);
  };
  
  // 2. Order Flow Indicator - Buying vs selling pressure
  const calculateOrderFlow = () => {
    const longOrders = orders.filter(o => o.type === 'long');
    const shortOrders = orders.filter(o => o.type === 'short');
    
    const longVolume = longOrders.reduce((sum, o) => sum + o.size, 0);
    const shortVolume = shortOrders.reduce((sum, o) => sum + o.size, 0);
    const totalVolume = longVolume + shortVolume;
    
    const longPercentage = totalVolume > 0 ? (longVolume / totalVolume) * 100 : 50;
    const shortPercentage = totalVolume > 0 ? (shortVolume / totalVolume) * 100 : 50;
    
    // Calculate pressure intensity
    const pressure = Math.abs(longPercentage - shortPercentage);
    let pressureLevel: 'balanced' | 'moderate' | 'strong' = 'balanced';
    if (pressure > 30) pressureLevel = 'strong';
    else if (pressure > 15) pressureLevel = 'moderate';
    
    let dominance: 'buying' | 'selling' | 'neutral' = 'neutral';
    if (longPercentage > shortPercentage) dominance = 'buying';
    else if (shortPercentage > longPercentage) dominance = 'selling';
    
    return {
      longVolume,
      shortVolume,
      longPercentage,
      shortPercentage,
      longCount: longOrders.length,
      shortCount: shortOrders.length,
      pressureLevel,
      dominance,
    };
  };
  
  const patterns = detectPatterns();
  const flow = calculateOrderFlow();
  
  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      {/* Order Flow Indicator */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" data-testid="icon-flow" />
            Order Flow
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Real-time buying vs selling pressure from whale orders. Shows market sentiment and directional bias.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                Buying Pressure
              </span>
              <span className="font-mono font-semibold">{flow.longPercentage.toFixed(1)}%</span>
            </div>
            <Progress value={flow.longPercentage} className="h-2 bg-red-100 dark:bg-red-950" data-testid="progress-buying" />
            
            <div className="flex items-center justify-between text-sm mt-3">
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-500" />
                Selling Pressure
              </span>
              <span className="font-mono font-semibold">{flow.shortPercentage.toFixed(1)}%</span>
            </div>
            <Progress value={flow.shortPercentage} className="h-2 bg-green-100 dark:bg-green-950" data-testid="progress-selling" />
          </div>
          
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Long Volume:</span>
              <span className="font-mono font-semibold">{flow.longVolume.toFixed(2)} BTC</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Short Volume:</span>
              <span className="font-mono font-semibold">{flow.shortVolume.toFixed(2)} BTC</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Pressure:</span>
              <Badge 
                variant={flow.pressureLevel === 'strong' ? 'destructive' : flow.pressureLevel === 'moderate' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {flow.pressureLevel === 'strong' ? 'Strong' : flow.pressureLevel === 'moderate' ? 'Moderate' : 'Balanced'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Whale Pattern Detection - Order Book Style */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" data-testid="icon-patterns" />
            Price Clusters
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Multiple large orders concentrated at similar price levels. Indicates strong support or resistance zones.
          </p>
        </CardHeader>
        <CardContent>
          {patterns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No significant clusters detected
            </p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {patterns.map((pattern, idx) => {
                const priceRange = 1000;
                const minPrice = pattern.price - priceRange / 2;
                const maxPrice = pattern.price + priceRange / 2;
                
                // Calculate circle sizes based on BTC volume (max 50px diameter)
                const maxSize = Math.max(...patterns.map(p => p.totalSize));
                const longCircleSize = (pattern.longSize / maxSize) * 40 + 10;
                const shortCircleSize = (pattern.shortSize / maxSize) * 40 + 10;
                
                return (
                  <div 
                    key={idx} 
                    className="flex items-center gap-3 p-2 rounded-md hover-elevate border border-border/50" 
                    data-testid={`pattern-${idx}`}
                  >
                    {/* Price Level */}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold truncate">
                        ${pattern.price.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pattern.totalSize.toFixed(1)} BTC
                      </div>
                    </div>
                    
                    {/* Long Side - Order Book Style */}
                    <div className="flex items-center justify-end gap-2 w-24">
                      {pattern.longSize > 0 && (
                        <>
                          <div className="text-right">
                            <div className="text-xs font-mono font-semibold text-green-600 dark:text-green-400">
                              {pattern.longSize.toFixed(1)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {pattern.longCount}x
                            </div>
                          </div>
                          <div 
                            className="rounded-full bg-green-500/20 border-2 border-green-500 flex-shrink-0"
                            style={{ 
                              width: `${longCircleSize}px`, 
                              height: `${longCircleSize}px` 
                            }}
                            title={`${pattern.longCount} long orders, ${pattern.longSize.toFixed(1)} BTC`}
                          />
                        </>
                      )}
                    </div>
                    
                    {/* Short Side - Order Book Style */}
                    <div className="flex items-center gap-2 w-24">
                      {pattern.shortSize > 0 && (
                        <>
                          <div 
                            className="rounded-full bg-red-500/20 border-2 border-red-500 flex-shrink-0"
                            style={{ 
                              width: `${shortCircleSize}px`, 
                              height: `${shortCircleSize}px` 
                            }}
                            title={`${pattern.shortCount} short orders, ${pattern.shortSize.toFixed(1)} BTC`}
                          />
                          <div className="text-left">
                            <div className="text-xs font-mono font-semibold text-red-600 dark:text-red-400">
                              {pattern.shortSize.toFixed(1)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {pattern.shortCount}x
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
