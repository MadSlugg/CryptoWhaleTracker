import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Activity, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface WhaleMomentumProps {
  orders: BitcoinOrder[];
}

interface MomentumWindow {
  label: string;
  minutes: number;
  count: number;
  totalBTC: number;
  rate: number; // orders per minute
}

export function WhaleMomentum({ orders }: WhaleMomentumProps) {
  const now = new Date();
  
  const calculateMomentum = (minutesAgo: number): { count: number; totalBTC: number } => {
    const cutoffTime = new Date(now.getTime() - minutesAgo * 60 * 1000);
    const recentOrders = orders.filter(order => {
      const orderTime = new Date(order.timestamp);
      return orderTime >= cutoffTime;
    });
    
    return {
      count: recentOrders.length,
      totalBTC: recentOrders.reduce((sum, o) => sum + o.size, 0)
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
  
  if (currentMomentum.rate > 2) {
    momentumLevel = 'high';
    momentumColor = 'destructive';
  } else if (currentMomentum.rate > 0.5) {
    momentumLevel = 'moderate';
    momentumColor = 'default';
  }
  
  // Calculate max count for progress bars
  const maxCount = Math.max(...windows.map(w => w.count), 1);
  
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" data-testid="icon-momentum" />
            <span className="text-base">Whale Momentum</span>
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
          Rate of new whale orders entering the market. High momentum indicates increased whale activity.
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
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Latest Activity:</span>
              <span className="font-medium" data-testid="text-latest-activity">
                {currentMomentum.count} whale{currentMomentum.count !== 1 ? 's' : ''} in last {windows[0].label}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
