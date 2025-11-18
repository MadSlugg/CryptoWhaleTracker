import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bitcoin, TrendingUp, TrendingDown } from "lucide-react";

interface SummaryStatsProps {
  totalVolume: number;
  longCount: number;
  shortCount: number;
}

export function SummaryStats({ totalVolume, longCount, shortCount }: SummaryStatsProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <Card data-testid="card-total-volume">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            24h Volume
          </CardTitle>
          <Bitcoin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-mono font-semibold" data-testid="text-total-volume">
            {totalVolume.toFixed(2)} BTC
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Total trading volume
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-long-positions">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Active Longs
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-long" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-mono font-semibold text-long" data-testid="text-long-count">
            {longCount}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Long positions
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-short-positions">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Active Shorts
          </CardTitle>
          <TrendingDown className="h-4 w-4 text-short" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-mono font-semibold text-short" data-testid="text-short-count">
            {shortCount}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Short positions
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
