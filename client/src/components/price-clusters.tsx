import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown } from "lucide-react";

interface PriceClustersProps {
  orders: BitcoinOrder[];
  currentPrice: number;
}

interface PriceCluster {
  price: number;
  count: number;
  totalSize: number;
  type: 'support' | 'resistance';
  buyCount: number;
  sellCount: number;
  buySize: number;
  sellSize: number;
}

export function PriceClusters({ orders, currentPrice }: PriceClustersProps) {
  const detectPatterns = (): PriceCluster[] => {
    // Filter to active whale positions
    const whaleOrders = orders.filter(o => o.status === 'active' && o.size >= 100);
    
    // Use $100 clusters for precise price zones
    const priceRange = 100;
    const clusters = new Map<number, { buys: BitcoinOrder[], sells: BitcoinOrder[] }>();
    
    whaleOrders.forEach(order => {
      const clusterPrice = Math.round(order.price / priceRange) * priceRange;
      
      if (!clusters.has(clusterPrice)) {
        clusters.set(clusterPrice, { buys: [], sells: [] });
      }
      
      const cluster = clusters.get(clusterPrice)!;
      if (order.type === 'long') {
        cluster.buys.push(order);
      } else {
        cluster.sells.push(order);
      }
    });
    
    const significantClusters: PriceCluster[] = [];
    
    clusters.forEach((cluster, price) => {
      const allOrders = [...cluster.buys, ...cluster.sells];
      const totalSize = allOrders.reduce((sum, o) => sum + o.size, 0);
      const count = allOrders.length;
      
      // Only show important clusters: 2+ whales OR 50+ BTC total
      if (count >= 2 || totalSize >= 50) {
        const buySize = cluster.buys.reduce((sum, o) => sum + o.size, 0);
        const sellSize = cluster.sells.reduce((sum, o) => sum + o.size, 0);
        
        // Determine if support (below price) or resistance (above price)
        const type: 'support' | 'resistance' = price < currentPrice ? 'support' : 'resistance';
        
        significantClusters.push({
          price,
          count,
          totalSize,
          type,
          buyCount: cluster.buys.length,
          sellCount: cluster.sells.length,
          buySize,
          sellSize,
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
            Support & Resistance Levels
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Key price zones where whales are positioned. Green = support below price, Red = resistance above price.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No significant levels detected
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxVolume = Math.max(...patterns.map(p => p.totalSize));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" data-testid="icon-patterns" />
          Support & Resistance Levels
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Key price zones where whales are positioned. Green = support below price, Red = resistance above price.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2" data-testid="heatmap-container">
          {patterns.map((pattern, idx) => {
            const isSupport = pattern.type === 'support';
            const percentFromPrice = ((pattern.price - currentPrice) / currentPrice * 100).toFixed(1);
            const strength = ((pattern.totalSize / maxVolume) * 100).toFixed(0);
            
            return (
              <div 
                key={idx} 
                className={`p-3 rounded-lg border-2 ${
                  isSupport 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-red-500/10 border-red-500/30'
                }`}
                data-testid={`cluster-${idx}`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Price and Label */}
                  <div className="flex items-center gap-3">
                    <Badge 
                      className={`${
                        isSupport 
                          ? 'bg-emerald-600 text-white dark:bg-emerald-500' 
                          : 'bg-red-600 text-white dark:bg-red-500'
                      } text-xs font-bold px-3`}
                    >
                      {isSupport ? (
                        <><TrendingUp className="w-3 h-3 mr-1" /> SUPPORT</>
                      ) : (
                        <><TrendingDown className="w-3 h-3 mr-1" /> RESISTANCE</>
                      )}
                    </Badge>
                    
                    <div>
                      <div className="font-mono font-bold text-base">
                        ${Math.round(pattern.price).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isSupport ? '↓' : '↑'} {Math.abs(parseFloat(percentFromPrice))}% from current
                      </div>
                    </div>
                  </div>
                  
                  {/* Strength Metrics */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Strength</div>
                      <div className="font-mono font-bold text-lg">
                        {pattern.totalSize.toFixed(0)} BTC
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Whales</div>
                      <div className="font-mono font-bold text-lg">
                        {pattern.count}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>{patterns.length} key levels detected</span>
          <span>Current Price: ${Math.round(currentPrice).toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
