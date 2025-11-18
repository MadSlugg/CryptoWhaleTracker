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
    
    return significantClusters.sort((a, b) => b.totalSize - a.totalSize).slice(0, 5);
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

      {/* Whale Pattern Detection */}
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
            <div className="space-y-3">
              {patterns.map((pattern, idx) => {
                const priceRange = 1000; // Same as detection logic
                const minPrice = pattern.price - priceRange / 2;
                const maxPrice = pattern.price + priceRange / 2;
                
                return (
                  <div key={idx} className="flex flex-col gap-2 p-2 rounded-md border bg-muted/30" data-testid={`pattern-${idx}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-semibold">
                          ${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Center: ${pattern.price.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {pattern.totalSize.toFixed(1)} BTC
                        </span>
                        <Badge 
                          variant={pattern.type === 'long' ? 'default' : pattern.type === 'short' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {pattern.type === 'mixed' ? 'Balanced' : pattern.type.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">
                        {pattern.longCount} longs ({pattern.longSize.toFixed(1)} BTC)
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-red-600 dark:text-red-400">
                        {pattern.shortCount} shorts ({pattern.shortSize.toFixed(1)} BTC)
                      </span>
                    </div>
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
