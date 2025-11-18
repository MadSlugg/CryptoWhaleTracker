import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

interface PriceClustersProps {
  orders: BitcoinOrder[];
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

export function PriceClusters({ orders }: PriceClustersProps) {
  const detectPatterns = (): PriceCluster[] => {
    const priceRange = 1000;
    const clusters = new Map<number, { longs: BitcoinOrder[], shorts: BitcoinOrder[] }>();
    
    orders.forEach(order => {
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
    
    return significantClusters.sort((a, b) => b.totalSize - a.totalSize).slice(0, 10);
  };
  
  const patterns = detectPatterns();
  
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
        {patterns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No significant clusters detected
          </p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {patterns.map((pattern, idx) => {
              const priceRange = 1000;
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
  );
}
