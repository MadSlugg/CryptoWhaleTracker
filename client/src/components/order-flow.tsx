import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface OrderFlowProps {
  orders: BitcoinOrder[];
}

export function OrderFlow({ orders }: OrderFlowProps) {
  const calculateOrderFlow = () => {
    const longOrders = orders.filter(o => o.type === 'long');
    const shortOrders = orders.filter(o => o.type === 'short');
    
    const longVolume = longOrders.reduce((sum, o) => sum + o.size, 0);
    const shortVolume = shortOrders.reduce((sum, o) => sum + o.size, 0);
    const totalVolume = longVolume + shortVolume;
    
    const longPercentage = totalVolume > 0 ? (longVolume / totalVolume) * 100 : 50;
    const shortPercentage = totalVolume > 0 ? (shortVolume / totalVolume) * 100 : 50;
    
    // Calculate pressure as difference between long and short percentages
    // Pressure thresholds aligned with Order Book Imbalance:
    // >50% difference = 75/25 split or more extreme (STRONG)
    // >30% difference = 65/35 split (MODERATE)
    // <=30% difference = relatively balanced
    const pressure = Math.abs(longPercentage - shortPercentage);
    let pressureLevel: 'balanced' | 'moderate' | 'strong' = 'balanced';
    if (pressure > 50) pressureLevel = 'strong';
    else if (pressure > 30) pressureLevel = 'moderate';
    
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
  
  const flow = calculateOrderFlow();
  
  return (
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
  );
}
