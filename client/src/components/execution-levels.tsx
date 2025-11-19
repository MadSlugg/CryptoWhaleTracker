import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import type { Exchange } from '@shared/schema';

interface ExecutionLevelsProps {
  timeRange: '1h' | '4h' | '24h' | '7d' | 'all';
  minSize: number;
  exchange: Exchange;
  currentPrice: number;
}

interface ExecutionLevel {
  price: number;
  longVolume: number;
  shortVolume: number;
  totalVolume: number;
  orderCount: number;
  dominantType: 'long' | 'short' | 'mixed';
}

interface FilledOrderAnalysis {
  executionLevels: ExecutionLevel[];
  totalVolume: number;
}

export function ExecutionLevels({ timeRange, minSize, exchange, currentPrice }: ExecutionLevelsProps) {
  const { data, isLoading } = useQuery<FilledOrderAnalysis>({
    queryKey: ['/api/filled-order-analysis', timeRange, minSize, exchange],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeRange,
        minSize: minSize.toString(),
        exchange,
      });
      const response = await fetch(`/api/filled-order-analysis?${params}`);
      if (!response.ok) throw new Error('Failed to fetch execution levels');
      return response.json();
    },
    refetchInterval: 10000,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Execution Levels
          </CardTitle>
          <CardDescription>
            Shows actual support/resistance where whales executed orders. High volume = strong level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            Loading execution levels...
          </div>
        </CardContent>
      </Card>
    );
  }

  const levels = data.executionLevels;
  const maxVolume = Math.max(...levels.map(l => l.totalVolume), 1);

  if (levels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Execution Levels
          </CardTitle>
          <CardDescription>
            Shows actual support/resistance where whales executed orders. High volume = strong level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            No filled orders in this time range
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-execution-levels">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Execution Levels
        </CardTitle>
        <CardDescription>
          Shows actual support/resistance where whales executed orders. High volume = strong level.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="flex justify-between text-sm text-muted-foreground pb-2 border-b">
          <span>{levels.length} price levels</span>
          <span>{data.totalVolume.toFixed(1)} BTC executed</span>
        </div>

        {/* Execution Levels List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {levels.map((level, index) => {
            const isNearCurrent = Math.abs(level.price - currentPrice) / currentPrice < 0.02; // Within 2%
            const intensity = (level.totalVolume / maxVolume) * 100;
            
            // Determine color based on dominant type
            let barColor = 'bg-blue-500/60 dark:bg-blue-600/60';
            if (level.dominantType === 'long') {
              barColor = 'bg-green-500/60 dark:bg-green-600/60';
            } else if (level.dominantType === 'short') {
              barColor = 'bg-red-500/60 dark:bg-red-600/60';
            }

            return (
              <div
                key={index}
                className={`space-y-1 p-2 rounded-md border transition-colors ${
                  isNearCurrent ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                data-testid={`level-${level.price}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">
                      ${level.price.toLocaleString()}
                    </span>
                    {isNearCurrent && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Current
                      </Badge>
                    )}
                    <Badge 
                      variant={level.dominantType === 'long' ? 'default' : level.dominantType === 'short' ? 'destructive' : 'secondary'}
                      className="text-xs px-1.5 py-0"
                    >
                      {level.dominantType.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium">
                      {level.totalVolume.toFixed(1)} BTC
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({level.orderCount} orders)
                    </span>
                  </div>
                </div>

                {/* Volume breakdown */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                    <span className="font-mono">{level.longVolume.toFixed(1)}</span>
                  </div>
                  <span>/</span>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
                    <span className="font-mono">{level.shortVolume.toFixed(1)}</span>
                  </div>
                </div>

                {/* Intensity bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} transition-all`}
                    style={{ width: `${intensity}%` }}
                    data-testid={`intensity-bar-${level.price}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-500/60" />
            <span>Long-dominant</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-red-500/60" />
            <span>Short-dominant</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-blue-500/60" />
            <span>Mixed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
