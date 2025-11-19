import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

interface PriceClustersProps {
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

export function PriceClusters({ orders, currentPrice }: PriceClustersProps) {
  const detectPatterns = (): PriceCluster[] => {
    // Filter to active orders only (consistent with Order Book Imbalance)
    const activeOrders = orders.filter(o => o.status === 'active');
    
    const priceRange = 1000;
    const clusters = new Map<number, { longs: BitcoinOrder[], shorts: BitcoinOrder[] }>();
    
    activeOrders.forEach(order => {
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
    
    const significantClusters: PriceCluster[] = [];
    
    clusters.forEach((cluster, price) => {
      const allOrders = [...cluster.longs, ...cluster.shorts];
      const totalSize = allOrders.reduce((sum, o) => sum + o.size, 0);
      const count = allOrders.length;
      
      if (count >= 3 || totalSize >= 50) {
        const longSize = cluster.longs.reduce((sum, o) => sum + o.size, 0);
        const shortSize = cluster.shorts.reduce((sum, o) => sum + o.size, 0);
        
        let type: 'long' | 'short' | 'mixed' = 'mixed';
        const volumeDifference = Math.abs(longSize - shortSize);
        const averageVolume = (longSize + shortSize) / 2;
        
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
    
    return significantClusters.sort((a, b) => b.price - a.price);
  };
  
  const patterns = detectPatterns();
  
  if (patterns.length === 0) {
    return (
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
          <p className="text-sm text-muted-foreground text-center py-4">
            No significant clusters detected
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxVolume = Math.max(...patterns.map(p => p.totalSize));
  
  const getHeatColor = (volume: number, type: 'long' | 'short' | 'mixed') => {
    const intensity = volume / maxVolume;
    
    if (type === 'long') {
      if (intensity < 0.2) return 'rgba(34, 197, 94, 0.15)';
      if (intensity < 0.4) return 'rgba(34, 197, 94, 0.3)';
      if (intensity < 0.6) return 'rgba(34, 197, 94, 0.5)';
      if (intensity < 0.8) return 'rgba(74, 222, 128, 0.65)';
      return 'rgba(134, 239, 172, 0.8)';
    } else if (type === 'short') {
      if (intensity < 0.2) return 'rgba(239, 68, 68, 0.15)';
      if (intensity < 0.4) return 'rgba(239, 68, 68, 0.3)';
      if (intensity < 0.6) return 'rgba(239, 68, 68, 0.5)';
      if (intensity < 0.8) return 'rgba(248, 113, 113, 0.65)';
      return 'rgba(252, 165, 165, 0.8)';
    } else {
      if (intensity < 0.2) return 'rgba(59, 130, 246, 0.15)';
      if (intensity < 0.4) return 'rgba(59, 130, 246, 0.3)';
      if (intensity < 0.6) return 'rgba(59, 130, 246, 0.5)';
      if (intensity < 0.8) return 'rgba(96, 165, 250, 0.65)';
      return 'rgba(147, 197, 253, 0.8)';
    }
  };

  const getBarWidth = (volume: number) => {
    const minWidth = 30;
    const maxWidth = 100;
    const intensity = volume / maxVolume;
    return minWidth + (intensity * (maxWidth - minWidth));
  };

  return (
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
        <div className="space-y-1" data-testid="heatmap-container">
          {patterns.map((pattern, idx) => {
            const priceRange = 1000;
            const minPrice = pattern.price - priceRange / 2;
            const maxPrice = pattern.price + priceRange / 2;
            const isNearCurrent = Math.abs(pattern.price - currentPrice) < priceRange * 2;
            const barWidth = getBarWidth(pattern.totalSize);
            const heatColor = getHeatColor(pattern.totalSize, pattern.type);
            
            return (
              <div 
                key={idx} 
                className="relative group"
                data-testid={`cluster-${idx}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-28 flex-shrink-0">
                    <div className="font-mono text-xs font-semibold">
                      ${pattern.price.toLocaleString()}
                    </div>
                    {isNearCurrent && (
                      <div className="text-[10px] text-muted-foreground">
                        {((pattern.price - currentPrice) / currentPrice * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 relative h-7 flex items-center">
                    <div
                      className="absolute left-0 h-full rounded-sm transition-all duration-300"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: heatColor,
                        boxShadow: `0 0 8px ${heatColor}`,
                      }}
                      data-testid={`heatbar-${idx}`}
                    />
                    
                    <div className="relative z-10 flex items-center gap-2 px-2 w-full pointer-events-none">
                      <Badge 
                        variant={pattern.type === 'long' ? 'default' : pattern.type === 'short' ? 'destructive' : 'secondary'}
                        className="text-[10px] h-4 px-1.5"
                      >
                        {pattern.type === 'mixed' ? 'MIX' : pattern.type.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {pattern.totalSize.toFixed(1)} BTC
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        (L:{pattern.longCount} S:{pattern.shortCount})
                      </span>
                    </div>
                  </div>
                </div>
                
                <div 
                  className="absolute left-0 right-0 top-full mt-1 p-2 rounded-md border bg-card shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none"
                  style={{ minWidth: '300px' }}
                >
                  <div className="text-xs space-y-1">
                    <div className="font-semibold">
                      Price Range: ${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-green-600 dark:text-green-400">
                        ↑ {pattern.longCount} longs ({pattern.longSize.toFixed(1)} BTC)
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-red-600 dark:text-red-400">
                        ↓ {pattern.shortCount} shorts ({pattern.shortSize.toFixed(1)} BTC)
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Intensity: {((pattern.totalSize / maxVolume) * 100).toFixed(0)}% of max volume
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Showing {patterns.length} clusters</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Max volume:</span>
            <span className="font-mono font-semibold">{maxVolume.toFixed(1)} BTC</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
