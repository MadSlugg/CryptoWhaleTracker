import type { PriceLevel } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown } from "lucide-react";

interface PriceClustersProps {
  levels: PriceLevel[];
  currentPrice: number;
}

export function PriceClusters({ levels, currentPrice }: PriceClustersProps) {
  // Filter to significant levels: 50+ BTC total liquidity
  const significantLevels = levels.filter(level => {
    const totalLiquidity = level.buyLiquidity + level.sellLiquidity;
    return totalLiquidity >= 50;
  });
  
  const patterns = significantLevels.sort((a, b) => b.price - a.price);
  
  if (patterns.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" data-testid="icon-patterns" />
            Support & Resistance Levels
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Key price zones where large positions are concentrated. Green = support below price, Red = resistance above price.
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

  const maxVolume = Math.max(...patterns.map(p => p.buyLiquidity + p.sellLiquidity));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" data-testid="icon-patterns" />
          Support & Resistance Levels
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Key price zones where large positions are concentrated. Green = support below price, Red = resistance above price.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2" data-testid="heatmap-container">
          {patterns.map((level, idx) => {
            const isSupport = level.type === 'support';
            const percentFromPrice = ((level.price - currentPrice) / currentPrice * 100).toFixed(1);
            const totalLiquidity = level.buyLiquidity + level.sellLiquidity;
            
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
                        ${Math.round(level.price).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isSupport ? '↓' : '↑'} {Math.abs(parseFloat(percentFromPrice))}% from current
                      </div>
                    </div>
                  </div>
                  
                  {/* BTC Liquidity */}
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Liquidity</div>
                    <div className="font-mono font-bold text-lg">
                      {totalLiquidity.toFixed(0)} BTC
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
