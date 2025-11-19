import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import type { Exchange } from '@shared/schema';

interface FilledOrderFlowProps {
  minSize: number;
  exchange: Exchange;
}

interface FilledOrderAnalysis {
  timeRange: string;
  totalOrders: number;
  totalVolume: number;
  longVolume: number;
  shortVolume: number;
  longPercentage: number;
  shortPercentage: number;
  longOrderCount: number;
  shortOrderCount: number;
  signal: 'strong_accumulation' | 'accumulation' | 'neutral' | 'distribution' | 'strong_distribution';
  signalStrength: number;
  executionLevels: Array<{
    price: number;
    longVolume: number;
    shortVolume: number;
    totalVolume: number;
    orderCount: number;
    dominantType: 'long' | 'short' | 'mixed';
  }>;
}

export function FilledOrderFlow({ minSize, exchange }: FilledOrderFlowProps) {
  const { data, isLoading } = useQuery<FilledOrderAnalysis>({
    queryKey: ['/api/filled-order-analysis', minSize, exchange],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeRange: '30m', // Fixed 30-minute window for most relevant signals
        minSize: minSize.toString(),
        exchange,
      });
      const response = await fetch(`/api/filled-order-analysis?${params}`);
      if (!response.ok) throw new Error('Failed to fetch filled order analysis');
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Filled Order Flow (Last 30 Minutes)
          </CardTitle>
          <CardDescription>
            Time-weighted analysis of whale executions in the last 30 minutes. Recent fills matter more. More longs = accumulation (bullish), more shorts = distribution (bearish).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            Loading filled order analysis...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Signal badge configuration
  const getSignalConfig = () => {
    switch (data.signal) {
      case 'strong_accumulation':
        return {
          label: 'STRONG ACCUMULATION',
          variant: 'default' as const,
          icon: <TrendingUp className="w-4 h-4" />,
          description: 'Whales aggressively buying dips - Strong bullish signal',
          color: 'text-green-600 dark:text-green-400',
        };
      case 'accumulation':
        return {
          label: 'ACCUMULATION',
          variant: 'default' as const,
          icon: <TrendingUp className="w-4 h-4" />,
          description: 'Whales buying weakness - Bullish signal',
          color: 'text-green-600 dark:text-green-400',
        };
      case 'distribution':
        return {
          label: 'DISTRIBUTION',
          variant: 'destructive' as const,
          icon: <TrendingDown className="w-4 h-4" />,
          description: 'Whales selling strength - Bearish signal',
          color: 'text-red-600 dark:text-red-400',
        };
      case 'strong_distribution':
        return {
          label: 'STRONG DISTRIBUTION',
          variant: 'destructive' as const,
          icon: <TrendingDown className="w-4 h-4" />,
          description: 'Whales aggressively selling rallies - Strong bearish signal',
          color: 'text-red-600 dark:text-red-400',
        };
      default:
        return {
          label: 'NEUTRAL',
          variant: 'secondary' as const,
          icon: <Minus className="w-4 h-4" />,
          description: 'Balanced execution - No clear directional bias',
          color: 'text-muted-foreground',
        };
    }
  };

  const signalConfig = getSignalConfig();

  return (
    <Card data-testid="card-filled-order-flow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Filled Order Flow (Last 30 Minutes)
        </CardTitle>
        <CardDescription>
          Time-weighted analysis of whale executions in the last 30 minutes. Recent fills matter more. More longs = accumulation (bullish), more shorts = distribution (bearish).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Signal Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant={signalConfig.variant} 
              className="px-3 py-1"
              data-testid={`badge-signal-${data.signal}`}
            >
              <span className="flex items-center gap-1">
                {signalConfig.icon}
                {signalConfig.label}
              </span>
            </Badge>
            <span className="text-sm text-muted-foreground">
              Strength: {data.signalStrength}%
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {data.totalOrders} filled orders ({data.totalVolume.toFixed(1)} BTC)
          </div>
        </div>

        {/* Signal Description */}
        <div className={`text-sm font-medium ${signalConfig.color}`}>
          {signalConfig.description}
        </div>

        {/* Volume-Weighted Ratio */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Volume-Weighted Execution</span>
            <span className="font-mono">
              {data.longPercentage.toFixed(1)}% L / {data.shortPercentage.toFixed(1)}% S
            </span>
          </div>
          
          {/* Visual Bar */}
          <div className="h-8 flex rounded-md overflow-hidden border">
            <div
              className="bg-green-500/80 dark:bg-green-600/80 flex items-center justify-center text-xs font-medium text-white transition-all"
              style={{ width: `${data.longPercentage}%` }}
              data-testid="bar-long-percentage"
            >
              {data.longPercentage >= 15 && `${data.longPercentage.toFixed(0)}%`}
            </div>
            <div
              className="bg-red-500/80 dark:bg-red-600/80 flex items-center justify-center text-xs font-medium text-white transition-all"
              style={{ width: `${data.shortPercentage}%` }}
              data-testid="bar-short-percentage"
            >
              {data.shortPercentage >= 15 && `${data.shortPercentage.toFixed(0)}%`}
            </div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Filled Longs</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-green-600 dark:text-green-400" data-testid="text-long-volume">
                {data.longVolume.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">BTC</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {data.longOrderCount} orders
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Filled Shorts</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-red-600 dark:text-red-400" data-testid="text-short-volume">
                {data.shortVolume.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">BTC</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {data.shortOrderCount} orders
            </div>
          </div>
        </div>

        {/* Philosophy Note */}
        <div className="text-xs text-muted-foreground italic pt-2 border-t">
          "Not every trade is equal" - Metrics weighted by actual BTC volume, not order count
        </div>
      </CardContent>
    </Card>
  );
}
