import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, TrendingUp, TrendingDown } from "lucide-react";

interface SummaryStatsProps {
  longCount: number;
  shortCount: number;
}

export function SummaryStats({ longCount, shortCount }: SummaryStatsProps) {
  const total = longCount + shortCount;
  const longPercentage = total > 0 ? (longCount / total) * 100 : 0;
  const shortPercentage = total > 0 ? (shortCount / total) * 100 : 0;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <Card data-testid="card-long-short-ratio">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Long vs Short
          </CardTitle>
          <Scale className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="text-lg font-mono font-semibold text-long" data-testid="text-long-percentage">
              {longPercentage.toFixed(1)}%
            </div>
            <span className="text-muted-foreground">/</span>
            <div className="text-lg font-mono font-semibold text-short" data-testid="text-short-percentage">
              {shortPercentage.toFixed(1)}%
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Based on current filters
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
