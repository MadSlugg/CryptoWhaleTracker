import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";
import type { BitcoinOrder } from "@shared/schema";

interface PriceHeatmapProps {
  orders: BitcoinOrder[];
  currentPrice: number;
}

interface HeatmapLevel {
  priceRange: string;
  minPrice: number;
  maxPrice: number;
  longVolume: number;
  shortVolume: number;
  totalVolume: number;
  longCount: number;
  shortCount: number;
  intensity: number; // 0-100 scale for color intensity
}

export function PriceHeatmap({ orders, currentPrice }: PriceHeatmapProps) {
  // Filter for 50+ BTC orders only
  const whaleOrders = orders.filter(order => order.size >= 50);

  if (whaleOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" data-testid="icon-heatmap" />
              <span className="text-base">Price Level Heatmap</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              50+ BTC
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Visual map of whale concentration across price levels. Brighter colors indicate higher volume clusters.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No whale orders detected
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group orders into $2,000 price buckets
  const bucketSize = 2000;
  const levelMap = new Map<number, { longs: BitcoinOrder[], shorts: BitcoinOrder[] }>();

  whaleOrders.forEach(order => {
    const bucketPrice = Math.floor(order.price / bucketSize) * bucketSize;
    
    if (!levelMap.has(bucketPrice)) {
      levelMap.set(bucketPrice, { longs: [], shorts: [] });
    }
    
    const bucket = levelMap.get(bucketPrice)!;
    if (order.type === 'long') {
      bucket.longs.push(order);
    } else {
      bucket.shorts.push(order);
    }
  });

  // Convert to heatmap levels and calculate intensity
  const levels: HeatmapLevel[] = [];
  let maxVolume = 0;

  levelMap.forEach((bucket, price) => {
    const longVolume = bucket.longs.reduce((sum, o) => sum + o.size, 0);
    const shortVolume = bucket.shorts.reduce((sum, o) => sum + o.size, 0);
    const totalVolume = longVolume + shortVolume;

    if (totalVolume > maxVolume) {
      maxVolume = totalVolume;
    }

    levels.push({
      priceRange: `$${price.toLocaleString()} - $${(price + bucketSize).toLocaleString()}`,
      minPrice: price,
      maxPrice: price + bucketSize,
      longVolume,
      shortVolume,
      totalVolume,
      longCount: bucket.longs.length,
      shortCount: bucket.shorts.length,
      intensity: 0, // Will calculate after we know maxVolume
    });
  });

  // Calculate intensity (0-100 scale)
  levels.forEach(level => {
    level.intensity = maxVolume > 0 ? (level.totalVolume / maxVolume) * 100 : 0;
  });

  // Sort by price (descending)
  levels.sort((a, b) => b.minPrice - a.minPrice);

  // Get color based on intensity and dominant type
  const getHeatColor = (level: HeatmapLevel) => {
    const isLongDominant = level.longVolume > level.shortVolume;
    const intensity = level.intensity;
    
    if (intensity >= 80) {
      return isLongDominant 
        ? 'bg-green-600 dark:bg-green-500 text-white' 
        : 'bg-red-600 dark:bg-red-500 text-white';
    } else if (intensity >= 60) {
      return isLongDominant 
        ? 'bg-green-500 dark:bg-green-600 text-white' 
        : 'bg-red-500 dark:bg-red-600 text-white';
    } else if (intensity >= 40) {
      return isLongDominant 
        ? 'bg-green-400 dark:bg-green-700 text-white' 
        : 'bg-red-400 dark:bg-red-700 text-white';
    } else if (intensity >= 20) {
      return isLongDominant 
        ? 'bg-green-300 dark:bg-green-800 text-black dark:text-white' 
        : 'bg-red-300 dark:bg-red-800 text-black dark:text-white';
    } else {
      return isLongDominant 
        ? 'bg-green-200 dark:bg-green-900 text-black dark:text-white' 
        : 'bg-red-200 dark:bg-red-900 text-black dark:text-white';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" data-testid="icon-heatmap" />
            <span className="text-base">Price Level Heatmap</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            50+ BTC
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Visual map of whale concentration across price levels. Brighter colors indicate higher volume clusters.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Legend */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
            <span>Price Range</span>
            <div className="flex items-center gap-4">
              <span>Volume</span>
              <span className="w-16 text-right">Orders</span>
            </div>
          </div>

          {/* Heatmap bars */}
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {levels.map((level, idx) => {
              const isNearCurrentPrice = currentPrice >= level.minPrice && currentPrice <= level.maxPrice;
              
              return (
                <div 
                  key={idx} 
                  className={`relative rounded-md transition-all ${getHeatColor(level)} ${
                    isNearCurrentPrice ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                  data-testid={`heatmap-level-${idx}`}
                >
                  <div className="flex items-center justify-between p-2.5">
                    <div className="flex flex-col gap-0.5 flex-1">
                      <span className="font-mono text-xs font-semibold">
                        {level.priceRange}
                      </span>
                      {isNearCurrentPrice && (
                        <Badge className="text-[10px] w-fit px-1 py-0 bg-green-600 dark:bg-green-500 text-white">
                          Current Price
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-xs font-bold">
                          {level.totalVolume.toFixed(1)} BTC
                        </span>
                        <span className="text-[10px] opacity-90">
                          L: {level.longVolume.toFixed(1)} / S: {level.shortVolume.toFixed(1)}
                        </span>
                      </div>
                      
                      <div className="w-16 text-right">
                        <span className="font-mono text-xs font-semibold">
                          {level.longCount + level.shortCount}
                        </span>
                        <div className="text-[10px] opacity-90">
                          {level.longCount}L / {level.shortCount}S
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Intensity indicator bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20 dark:bg-white/20">
                    <div 
                      className="h-full bg-black/40 dark:bg-white/40 transition-all"
                      style={{ width: `${level.intensity}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="pt-2 mt-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Total Orders (50+ BTC):</span>
              <span className="font-mono font-semibold">{whaleOrders.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total Volume:</span>
              <span className="font-mono font-semibold">
                {whaleOrders.reduce((sum, o) => sum + o.size, 0).toFixed(1)} BTC
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Price Levels:</span>
              <span className="font-mono font-semibold">{levels.length}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
