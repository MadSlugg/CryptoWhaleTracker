import { useQuery } from "@tanstack/react-query";
import type { Liquidation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function LiquidationTracker() {
  const { data: liquidations = [], isLoading } = useQuery<Liquidation[]>({
    queryKey: ['/api/liquidations'],
    queryFn: async () => {
      const response = await fetch('/api/liquidations?hours=1');
      if (!response.ok) throw new Error('Failed to fetch liquidations');
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Sort by timestamp, most recent first
  const sortedLiquidations = [...liquidations].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  ).slice(0, 10); // Show top 10 most recent

  const totalLiquidatedBTC = liquidations.reduce((sum, liq) => sum + liq.quantity, 0);
  const totalLiquidatedUSD = liquidations.reduce((sum, liq) => sum + liq.totalUSD, 0);

  return (
    <Card className="border-2 border-destructive/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-destructive" data-testid="icon-liquidation" />
            <span className="text-base">Liquidations (1h)</span>
          </div>
          <Badge variant="outline" className="text-xs" data-testid="badge-liquidation-count">
            {liquidations.length} events
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Real-time liquidation events from Binance ($100k+ positions). High liquidations indicate forced position closures.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Loading liquidations...</p>
          </div>
        ) : liquidations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No liquidations in the last hour
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Liquidated</p>
                <p className="font-mono font-semibold text-sm" data-testid="text-total-btc">
                  {totalLiquidatedBTC.toFixed(2)} BTC
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Value</p>
                <p className="font-mono font-semibold text-sm" data-testid="text-total-usd">
                  ${(totalLiquidatedUSD / 1000000).toFixed(2)}M
                </p>
              </div>
            </div>

            {/* Liquidation Feed */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {sortedLiquidations.map((liq, idx) => {
                const isLongLiquidation = liq.side === 'BUY';
                const timeAgo = formatDistanceToNow(new Date(liq.timestamp), { addSuffix: true });
                
                return (
                  <div
                    key={liq.id}
                    className="flex items-center justify-between p-2 rounded-md border bg-card/50 hover-elevate"
                    data-testid={`liquidation-${idx}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge
                        variant={isLongLiquidation ? 'default' : 'destructive'}
                        className="shrink-0"
                        data-testid={`badge-side-${idx}`}
                      >
                        {isLongLiquidation ? (
                          <>
                            <TrendingUp className="h-3 w-3 mr-1" />
                            LONG
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-3 w-3 mr-1" />
                            SHORT
                          </>
                        )}
                      </Badge>

                      <div className="flex flex-col min-w-0">
                        <span className="font-mono font-semibold text-sm" data-testid={`text-quantity-${idx}`}>
                          {liq.quantity.toFixed(2)} BTC
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {timeAgo}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-mono text-sm" data-testid={`text-price-${idx}`}>
                        ${liq.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ${(liq.totalUSD / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
