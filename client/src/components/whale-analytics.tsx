import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Layers, Activity } from "lucide-react";
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

interface AccumulationZone {
  price: number;
  orderCount: number;
  totalSize: number;
  lastUpdate: string;
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
        let type: 'long' | 'short' | 'mixed' = 'mixed';
        if (cluster.longs.length === 0) type = 'short';
        else if (cluster.shorts.length === 0) type = 'long';
        
        const longSize = cluster.longs.reduce((sum, o) => sum + o.size, 0);
        const shortSize = cluster.shorts.reduce((sum, o) => sum + o.size, 0);
        
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
  
  // 2. Whale Accumulation Tracker - Price levels with repeated whale orders
  const detectAccumulation = (): AccumulationZone[] => {
    const priceRange = 500; // Tighter range for accumulation ($500)
    const accumulation = new Map<number, { orders: BitcoinOrder[], longs: number, shorts: number }>();
    
    orders.forEach(order => {
      const zonePrice = Math.round(order.price / priceRange) * priceRange;
      
      if (!accumulation.has(zonePrice)) {
        accumulation.set(zonePrice, { orders: [], longs: 0, shorts: 0 });
      }
      
      const zone = accumulation.get(zonePrice)!;
      zone.orders.push(order);
      if (order.type === 'long') zone.longs++;
      else zone.shorts++;
    });
    
    // Filter zones with multiple orders (accumulation)
    const zones: AccumulationZone[] = [];
    
    accumulation.forEach((zone, price) => {
      if (zone.orders.length >= 2) {
        const totalSize = zone.orders.reduce((sum, o) => sum + o.size, 0);
        // Clone array before sorting to avoid mutating shared data
        const sortedByTime = [...zone.orders].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        let type: 'long' | 'short' | 'mixed' = 'mixed';
        if (zone.longs === 0) type = 'short';
        else if (zone.shorts === 0) type = 'long';
        
        const longOrders = zone.orders.filter(o => o.type === 'long');
        const shortOrders = zone.orders.filter(o => o.type === 'short');
        const longSize = longOrders.reduce((sum, o) => sum + o.size, 0);
        const shortSize = shortOrders.reduce((sum, o) => sum + o.size, 0);
        
        zones.push({
          price,
          orderCount: zone.orders.length,
          totalSize,
          lastUpdate: sortedByTime[0].timestamp,
          type,
          longCount: zone.longs,
          shortCount: zone.shorts,
          longSize,
          shortSize,
        });
      }
    });
    
    return zones.sort((a, b) => b.orderCount - a.orderCount).slice(0, 5);
  };
  
  // 3. Order Flow Indicator - Buying vs selling pressure
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
  const accumulation = detectAccumulation();
  const flow = calculateOrderFlow();
  
  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
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
              {patterns.map((pattern, idx) => (
                <div key={idx} className="flex flex-col gap-2 p-2 rounded-md border bg-muted/30" data-testid={`pattern-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold">
                      ${pattern.price.toLocaleString()}
                    </span>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Whale Accumulation Tracker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" data-testid="icon-accumulation" />
            Accumulation Zones
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Price levels with repeated whale activity. Shows where large traders are building or defending positions.
          </p>
        </CardHeader>
        <CardContent>
          {accumulation.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No accumulation detected
            </p>
          ) : (
            <div className="space-y-3">
              {accumulation.map((zone, idx) => (
                <div key={idx} className="flex flex-col gap-2 p-2 rounded-md border bg-muted/30" data-testid={`zone-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold">
                      ${zone.price.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {zone.totalSize.toFixed(1)} BTC
                      </span>
                      <Badge 
                        variant={zone.type === 'long' ? 'default' : zone.type === 'short' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {zone.type === 'mixed' ? 'Balanced' : zone.type.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">
                        {zone.longCount} longs ({zone.longSize.toFixed(1)} BTC)
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-red-600 dark:text-red-400">
                        {zone.shortCount} shorts ({zone.shortSize.toFixed(1)} BTC)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
