import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { format } from "date-fns";

interface MajorWhalesProps {
  orders: BitcoinOrder[];
}

export function MajorWhales({ orders }: MajorWhalesProps) {
  // Filter for major whale orders (100+ BTC)
  const majorWhales = orders
    .filter(order => order.size >= 100)
    .sort((a, b) => b.size - a.size) // Sort by size, largest first
    .slice(0, 10); // Show top 10

  if (majorWhales.length === 0) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" data-testid="icon-activity" />
            Major Whales (100+ BTC)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No major whale orders (100+ BTC) in current view
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" data-testid="icon-activity" />
            Major Whales (100+ BTC)
          </div>
          <Badge variant="secondary" data-testid="badge-major-whale-count">
            {majorWhales.length} {majorWhales.length === 1 ? 'order' : 'orders'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {majorWhales.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
              data-testid={`major-whale-${order.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Type Badge */}
                <Badge
                  variant={order.type === 'long' ? 'default' : 'destructive'}
                  className="shrink-0"
                  data-testid={`badge-type-${order.id}`}
                >
                  {order.type === 'long' ? (
                    <TrendingUp className="h-3 w-3 mr-1" data-testid={`icon-long-${order.id}`} />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" data-testid={`icon-short-${order.id}`} />
                  )}
                  {order.type.toUpperCase()}
                </Badge>

                {/* Size - Most Prominent */}
                <div className="flex flex-col">
                  <span className="font-mono font-bold text-lg" data-testid={`text-size-${order.id}`}>
                    {order.size.toFixed(2)} BTC
                  </span>
                  {order.size >= 1000 && (
                    <Badge variant="destructive" className="text-xs w-fit">
                      MEGA WHALE
                    </Badge>
                  )}
                </div>

                {/* Price */}
                <div className="flex flex-col items-end ml-auto">
                  <span className="font-mono text-sm" data-testid={`text-price-${order.id}`}>
                    ${order.price.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs" data-testid={`badge-exchange-${order.id}`}>
                      {order.exchange.toUpperCase()}
                    </Badge>
                    {order.status === 'filled' && (
                      <Badge variant="secondary" className="text-xs">
                        FILLED
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
