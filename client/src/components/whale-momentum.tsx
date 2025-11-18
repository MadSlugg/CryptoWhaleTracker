import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, Zap, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface WhaleMomentumProps {
  orders: BitcoinOrder[];
  currentPrice?: number;
}

interface MomentumWindow {
  label: string;
  minutes: number;
  count: number;
  totalBTC: number;
  rate: number; // orders per minute
  orders: BitcoinOrder[];
}

interface PriceArea {
  priceRange: string;
  centerPrice: number;
  count: number;
  totalBTC: number;
  longCount: number;
  shortCount: number;
}

export function WhaleMomentum({ orders, currentPrice = 0 }: WhaleMomentumProps) {
  const now = new Date();
  const MIN_WHALE_SIZE = 10; // Only track 10+ BTC orders
  
  const calculateMomentum = (minutesAgo: number): { count: number; totalBTC: number; orders: BitcoinOrder[] } => {
    const cutoffTime = new Date(now.getTime() - minutesAgo * 60 * 1000);
    const recentOrders = orders.filter(order => {
      const orderTime = new Date(order.timestamp);
      return orderTime >= cutoffTime && order.size >= MIN_WHALE_SIZE;
    });
    
    return {
      count: recentOrders.length,
      totalBTC: recentOrders.reduce((sum, o) => sum + o.size, 0),
      orders: recentOrders
    };
  };
  
  const windows: MomentumWindow[] = [
    { label: '5 min', minutes: 5, ...calculateMomentum(5), rate: 0 },
    { label: '10 min', minutes: 10, ...calculateMomentum(10), rate: 0 },
    { label: '30 min', minutes: 30, ...calculateMomentum(30), rate: 0 },
  ];
  
  // Calculate rates (orders per minute)
  windows.forEach(window => {
    window.rate = window.count / window.minutes;
  });
  
  // Determine momentum level based on most recent window (5 min)
  const currentMomentum = windows[0];
  let momentumLevel: 'low' | 'moderate' | 'high' = 'low';
  let momentumColor: 'secondary' | 'default' | 'destructive' = 'secondary';
  
  if (currentMomentum.rate > 1) {
    momentumLevel = 'high';
    momentumColor = 'destructive';
  } else if (currentMomentum.rate > 0.3) {
    momentumLevel = 'moderate';
    momentumColor = 'default';
  }
  
  // Calculate max count for progress bars
  const maxCount = Math.max(...windows.map(w => w.count), 1);
  
  // Analyze price areas for 5-minute window (most recent activity)
  const analyzePriceAreas = (): PriceArea[] => {
    const priceRange = 2000; // Group orders within $2000 ranges
    const areaMap = new Map<number, { orders: BitcoinOrder[] }>();
    
    currentMomentum.orders.forEach(order => {
      const centerPrice = Math.round(order.price / priceRange) * priceRange;
      if (!areaMap.has(centerPrice)) {
        areaMap.set(centerPrice, { orders: [] });
      }
      areaMap.get(centerPrice)!.orders.push(order);
    });
    
    const areas: PriceArea[] = [];
    areaMap.forEach((data, centerPrice) => {
      const longOrders = data.orders.filter(o => o.type === 'long');
      const shortOrders = data.orders.filter(o => o.type === 'short');
      
      areas.push({
        priceRange: `$${(centerPrice - priceRange / 2).toLocaleString()} - $${(centerPrice + priceRange / 2).toLocaleString()}`,
        centerPrice,
        count: data.orders.length,
        totalBTC: data.orders.reduce((sum, o) => sum + o.size, 0),
        longCount: longOrders.length,
        shortCount: shortOrders.length,
      });
    });
    
    return areas.sort((a, b) => b.totalBTC - a.totalBTC).slice(0, 5);
  };
  
  const priceAreas = analyzePriceAreas();
  
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" data-testid="icon-momentum" />
            <span className="text-base">Whale Momentum (10+ BTC)</span>
          </div>
          <Badge 
            variant={momentumColor}
            className="text-xs"
            data-testid="badge-momentum-level"
          >
            {momentumLevel.toUpperCase()}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Rate of new 10+ BTC whale orders entering the market and their price areas. High momentum indicates increased whale activity.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {windows.map((window, idx) => (
          <div key={idx} className="space-y-2" data-testid={`momentum-window-${window.label.replace(' ', '-')}`}>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{window.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span 
                  className="text-xs text-muted-foreground"
                  data-testid={`text-btc-total-${window.label.replace(' ', '-')}`}
                >
                  {window.totalBTC.toFixed(1)} BTC
                </span>
                <span 
                  className="font-mono font-semibold min-w-[3rem] text-right"
                  data-testid={`text-order-count-${window.label.replace(' ', '-')}`}
                >
                  {window.count} {window.count === 1 ? 'order' : 'orders'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Progress 
                value={(window.count / maxCount) * 100} 
                className="h-2 flex-1" 
                data-testid={`progress-${window.label.replace(' ', '-')}`}
              />
              <span 
                className="text-xs text-muted-foreground font-mono min-w-[4rem] text-right"
                data-testid={`text-rate-${window.label.replace(' ', '-')}`}
              >
                {window.rate.toFixed(2)}/min
              </span>
            </div>
          </div>
        ))}
        
        {orders.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              No whale orders to track
            </p>
          </div>
        )}
        
        {currentMomentum.count > 0 && (
          <>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Latest Activity:</span>
                <span className="font-medium" data-testid="text-latest-activity">
                  {currentMomentum.count} whale{currentMomentum.count !== 1 ? 's' : ''} in last {windows[0].label}
                </span>
              </div>
            </div>
            
            {/* Price Areas - Show where whales are active */}
            {priceAreas.length > 0 && (
              <div className="pt-3 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-3 w-3 text-primary" />
                  <span className="text-xs font-semibold">Active Price Areas (Last 5 min)</span>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {priceAreas.map((area, idx) => {
                    const isCurrentPriceArea = currentPrice >= (area.centerPrice - 1000) && currentPrice <= (area.centerPrice + 1000);
                    
                    return (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between p-2 rounded-md border ${
                          isCurrentPriceArea ? 'bg-primary/10 border-primary' : 'bg-muted/30'
                        }`}
                        data-testid={`price-area-${idx}`}
                      >
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold">
                              {area.priceRange}
                            </span>
                            {isCurrentPriceArea && (
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                Current
                              </Badge>
                            )}
                          </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                            {area.longCount}L
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                            {area.shortCount}S
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs font-semibold font-mono">
                          {area.totalBTC.toFixed(1)} BTC
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {area.count} order{area.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
