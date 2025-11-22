import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Exchange } from "@shared/schema";

interface EntryPointsProps {
  exchange: Exchange;
}

interface EntryPointData {
  recommendation: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  confidence: number;
  currentPrice: number;
  entryPrice: number;
  reasoning: string[];
  signals: {
    filledOrderFlow: {
      score: number;
      signal: 'bullish' | 'bearish' | 'neutral';
    };
    orderBookImbalance: {
      score: number;
      signal: 'buy_pressure' | 'sell_pressure' | 'balanced';
    };
  };
  support: number | null;
  resistance: number | null;
}

export function BuyEntryPoints({ exchange }: EntryPointsProps) {
  const { data, isLoading } = useQuery<EntryPointData>({
    queryKey: ['/api/entry-points', exchange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (exchange !== 'all') params.append('exchange', exchange);
      
      const response = await fetch(`/api/entry-points?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch entry points');
      }
      return response.json();
    },
    refetchInterval: 20000,
    staleTime: 5000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Buy Entry Points
              </CardTitle>
              <CardDescription>Buy signals from market liquidity</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const isBuySignal = data.recommendation === 'strong_buy' || data.recommendation === 'buy';
  
  if (!isBuySignal) {
    return (
      <Card className="border-2 border-muted" data-testid="card-buy-entry-points">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" data-testid="icon-trending-up" />
                Buy Entry Points
              </CardTitle>
              <CardDescription>
                Buy signals from market liquidity
              </CardDescription>
            </div>
            <Badge 
              className="bg-muted text-muted-foreground text-lg px-4 py-2 font-bold no-default-hover-elevate no-default-active-elevate"
              data-testid="badge-no-signal"
            >
              NO SIGNAL
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm" data-testid="text-no-buy-signal">No strong buy signals detected. Wait for accumulation.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = data.recommendation === 'strong_buy'
    ? {
        label: 'STRONG BUY',
        color: 'bg-emerald-500 hover:bg-emerald-500/90 dark:bg-emerald-600 dark:hover:bg-emerald-600/90',
        textColor: 'text-white',
        borderColor: 'border-emerald-500',
      }
    : {
        label: 'BUY',
        color: 'bg-green-500 hover:bg-green-500/90 dark:bg-green-600 dark:hover:bg-green-600/90',
        textColor: 'text-white',
        borderColor: 'border-green-500',
      };

  return (
    <Card className={`border-2 ${config.borderColor}`} data-testid="card-buy-entry-points">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" data-testid="icon-trending-up" />
              Buy Entry Points
            </CardTitle>
            <CardDescription>
              Buy signals from market liquidity
            </CardDescription>
          </div>
          <Badge 
            className={`${config.color} ${config.textColor} text-lg px-4 py-2 font-bold`}
            data-testid={`badge-recommendation-${data.recommendation}`}
          >
            <TrendingUp className="h-5 w-5 mr-2" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Entry Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <span className="text-sm text-muted-foreground">Entry Price</span>
                <span className="font-mono font-bold text-lg" data-testid="text-entry-price">
                  ${Math.round(data.entryPrice).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-sm font-semibold">Confidence</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${isNaN(data.confidence) ? 50 : Math.max(0, Math.min(100, data.confidence))}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-primary" data-testid="text-confidence">
                    {isNaN(data.confidence) ? '50' : data.confidence.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Key Price Levels</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                <span className="text-muted-foreground">Current Price</span>
                <span className="font-mono font-semibold" data-testid="text-current-price">
                  ${Math.round(data.currentPrice).toLocaleString()}
                </span>
              </div>
              {data.support && Math.round(data.support) !== Math.round(data.entryPrice) && (
                <div className="flex items-center justify-between p-2 rounded-md bg-emerald-500/10 text-sm border border-emerald-500/20">
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">Support</span>
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300" data-testid="text-support">
                    ${Math.round(data.support).toLocaleString()}
                  </span>
                </div>
              )}
              {data.resistance && Math.round(data.resistance) !== Math.round(data.entryPrice) && (
                <div className="flex items-center justify-between p-2 rounded-md bg-red-500/10 text-sm border border-red-500/20">
                  <span className="text-red-700 dark:text-red-300 font-medium">Resistance</span>
                  <span className="font-mono font-semibold text-red-700 dark:text-red-300" data-testid="text-resistance">
                    ${Math.round(data.resistance).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Market Analysis</h3>
            <div className="space-y-2">
              {data.reasoning.map((reason, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/30 text-sm"
                  data-testid={`text-reasoning-${index}`}
                >
                  <span className="text-primary mt-0.5">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SellEntryPoints({ exchange }: EntryPointsProps) {
  const { data, isLoading } = useQuery<EntryPointData>({
    queryKey: ['/api/entry-points', exchange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (exchange !== 'all') params.append('exchange', exchange);
      
      const response = await fetch(`/api/entry-points?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch entry points');
      }
      return response.json();
    },
    refetchInterval: 20000,
    staleTime: 5000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                Sell Entry Points
              </CardTitle>
              <CardDescription>Sell signals from market liquidity</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const isSellSignal = data.recommendation === 'strong_sell' || data.recommendation === 'sell';
  
  if (!isSellSignal) {
    return (
      <Card className="border-2 border-muted" data-testid="card-sell-entry-points">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" data-testid="icon-trending-down" />
                Sell Entry Points
              </CardTitle>
              <CardDescription>
                Sell signals from market liquidity
              </CardDescription>
            </div>
            <Badge 
              className="bg-muted text-muted-foreground text-lg px-4 py-2 font-bold no-default-hover-elevate no-default-active-elevate"
              data-testid="badge-no-signal"
            >
              NO SIGNAL
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground" data-testid="text-no-sell-signal">No strong sell signals detected</p>
            </div>

            {/* Show resistance levels even without sell signal */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Key Price Levels</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                  <span className="text-muted-foreground">Current Price</span>
                  <span className="font-mono font-semibold" data-testid="text-current-price">
                    ${Math.round(data.currentPrice).toLocaleString()}
                  </span>
                </div>
                {data.resistance && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-red-500/10 text-sm border border-red-500/20">
                    <span className="text-red-700 dark:text-red-300 font-medium">Nearest Resistance</span>
                    <span className="font-mono font-semibold text-red-700 dark:text-red-300" data-testid="text-resistance">
                      ${Math.round(data.resistance).toLocaleString()}
                    </span>
                  </div>
                )}
                {data.support && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-emerald-500/10 text-sm border border-emerald-500/20">
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">Nearest Support</span>
                    <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300" data-testid="text-support">
                      ${Math.round(data.support).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Show confidence and reasoning if available */}
            {data.reasoning && data.reasoning.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Market Status</h3>
                <div className="space-y-2">
                  {data.reasoning.slice(0, 3).map((reason, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-2 p-2 rounded-md bg-muted/30 text-sm"
                      data-testid={`text-reasoning-${index}`}
                    >
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <span className="text-muted-foreground">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = data.recommendation === 'strong_sell'
    ? {
        label: 'STRONG SELL',
        color: 'bg-rose-600 hover:bg-rose-600/90 dark:bg-rose-700 dark:hover:bg-rose-700/90',
        textColor: 'text-white',
        borderColor: 'border-rose-600',
      }
    : {
        label: 'SELL',
        color: 'bg-red-500 hover:bg-red-500/90 dark:bg-red-600 dark:hover:bg-red-600/90',
        textColor: 'text-white',
        borderColor: 'border-red-500',
      };

  return (
    <Card className={`border-2 ${config.borderColor}`} data-testid="card-sell-entry-points">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" data-testid="icon-trending-down" />
              Sell Entry Points
            </CardTitle>
            <CardDescription>
              Sell signals from market liquidity
            </CardDescription>
          </div>
          <Badge 
            className={`${config.color} ${config.textColor} text-lg px-4 py-2 font-bold`}
            data-testid={`badge-recommendation-${data.recommendation}`}
          >
            <TrendingDown className="h-5 w-5 mr-2" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Entry Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <span className="text-sm text-muted-foreground">Entry Price</span>
                <span className="font-mono font-bold text-lg" data-testid="text-entry-price">
                  ${Math.round(data.entryPrice).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-sm font-semibold">Confidence</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${isNaN(data.confidence) ? 50 : Math.max(0, Math.min(100, data.confidence))}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-primary" data-testid="text-confidence">
                    {isNaN(data.confidence) ? '50' : data.confidence.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Key Price Levels</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                <span className="text-muted-foreground">Current Price</span>
                <span className="font-mono font-semibold" data-testid="text-current-price">
                  ${Math.round(data.currentPrice).toLocaleString()}
                </span>
              </div>
              {data.support && Math.round(data.support) !== Math.round(data.entryPrice) && (
                <div className="flex items-center justify-between p-2 rounded-md bg-emerald-500/10 text-sm border border-emerald-500/20">
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">Support</span>
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300" data-testid="text-support">
                    ${Math.round(data.support).toLocaleString()}
                  </span>
                </div>
              )}
              {data.resistance && Math.round(data.resistance) !== Math.round(data.entryPrice) && (
                <div className="flex items-center justify-between p-2 rounded-md bg-red-500/10 text-sm border border-red-500/20">
                  <span className="text-red-700 dark:text-red-300 font-medium">Resistance</span>
                  <span className="font-mono font-semibold text-red-700 dark:text-red-300" data-testid="text-resistance">
                    ${Math.round(data.resistance).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Market Analysis</h3>
            <div className="space-y-2">
              {data.reasoning.map((reason, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/30 text-sm"
                  data-testid={`text-reasoning-${index}`}
                >
                  <span className="text-primary mt-0.5">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
