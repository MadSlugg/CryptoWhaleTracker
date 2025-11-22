import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface MajorWhalesProps {
  orders: BitcoinOrder[];
}

interface GroupedWhale {
  price: number;
  totalSize: number;
  orders: BitcoinOrder[];
  longCount: number;
  shortCount: number;
}

export function MajorWhales({ orders }: MajorWhalesProps) {
  // Filter for major whale orders (100+ BTC)
  const majorWhales = orders.filter(order => order.size >= 100);

  // Group by price
  const priceGroups = new Map<number, BitcoinOrder[]>();
  majorWhales.forEach(order => {
    const existing = priceGroups.get(order.price) || [];
    priceGroups.set(order.price, [...existing, order]);
  });

  // Convert to array and calculate totals
  const groupedWhales: GroupedWhale[] = Array.from(priceGroups.entries())
    .map(([price, orders]) => ({
      price,
      totalSize: orders.reduce((sum, o) => sum + o.size, 0),
      orders: orders.sort((a, b) => b.size - a.size), // Sort orders within group by size
      longCount: orders.filter(o => o.type === 'long').length,
      shortCount: orders.filter(o => o.type === 'short').length,
    }))
    .sort((a, b) => b.totalSize - a.totalSize) // Sort groups by total size
    .slice(0, 10); // Show top 10 price levels

  if (groupedWhales.length === 0) {
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

  const totalOrders = groupedWhales.reduce((sum, g) => sum + g.orders.length, 0);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" data-testid="icon-activity" />
            Major Whales (100+ BTC)
          </div>
          <Badge variant="secondary" data-testid="badge-major-whale-count">
            {totalOrders} {totalOrders === 1 ? 'order' : 'orders'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {groupedWhales.map((group) => (
            <WhaleGroup key={group.price} group={group} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WhaleGroup({ group }: { group: GroupedWhale }) {
  const [isOpen, setIsOpen] = useState(false);
  const isSingleOrder = group.orders.length === 1;
  const isMegaWhale = group.totalSize >= 1000;

  // Determine primary type for badge color
  const primaryType = group.longCount > group.shortCount ? 'long' : 
                      group.shortCount > group.longCount ? 'short' : 
                      group.orders[0].type;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={`rounded-lg border ${
          isMegaWhale 
            ? 'border-2 border-orange-500 bg-gradient-to-r from-orange-500/10 to-orange-500/5 shadow-lg shadow-orange-500/20' 
            : 'border bg-card'
        }`}
        data-testid={`whale-group-${group.price}`}
      >
        {/* Group Header - Always Visible */}
        <CollapsibleTrigger asChild>
          <div 
            className="flex items-center justify-between p-3 hover-elevate cursor-pointer"
            data-testid={`button-whale-group-toggle-${group.price}`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Type Badge */}
              <div className="flex flex-col gap-1 shrink-0">
                {group.longCount > 0 && group.shortCount > 0 ? (
                  <>
                    <Badge
                      variant="default"
                      className="text-xs"
                      data-testid={`badge-long-count-${group.price}`}
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {group.longCount} LONG
                    </Badge>
                    <Badge
                      variant="destructive"
                      className="text-xs"
                      data-testid={`badge-short-count-${group.price}`}
                    >
                      <TrendingDown className="h-3 w-3 mr-1" />
                      {group.shortCount} SHORT
                    </Badge>
                  </>
                ) : (
                  <Badge
                    variant={primaryType === 'long' ? 'default' : 'destructive'}
                    className="shrink-0"
                    data-testid={`badge-type-${group.price}`}
                  >
                    {primaryType === 'long' ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {primaryType.toUpperCase()}
                  </Badge>
                )}
              </div>

              {/* Combined Size */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold ${isMegaWhale ? 'text-2xl text-orange-600 dark:text-orange-400' : 'text-lg'}`} data-testid={`text-total-size-${group.price}`}>
                    {group.totalSize.toFixed(2)} BTC
                  </span>
                  {isMegaWhale && (
                    <Badge variant="destructive" className="text-xs animate-pulse bg-orange-600 hover:bg-orange-700">
                      MEGA WHALE
                    </Badge>
                  )}
                </div>
                {!isSingleOrder && (
                  <span className="text-xs text-muted-foreground">
                    {group.orders.length} orders
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="flex flex-col items-end ml-auto">
                <span className="font-mono text-sm" data-testid={`text-price-${group.price}`}>
                  ${group.price.toLocaleString()}
                </span>
                {!isSingleOrder && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {isOpen ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Hide details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Show details
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Expandable Details - Only for multiple orders */}
        {!isSingleOrder && (
          <CollapsibleContent>
            <div className="border-t px-3 pb-3 space-y-2">
              <div className="text-xs text-muted-foreground pt-2 pb-1">
                Individual Orders:
              </div>
              {group.orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
                  data-testid={`order-detail-${order.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={order.type === 'long' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {order.type === 'long' ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {order.type.toUpperCase()}
                    </Badge>
                    <span className="font-mono font-semibold">
                      {order.size.toFixed(2)} BTC
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {order.exchange.toUpperCase()}
                    </Badge>
                    <Badge 
                      variant={order.status === 'filled' ? 'secondary' : 'default'} 
                      className="text-xs"
                    >
                      {order.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        )}

        {/* Single Order - Show exchange and status inline */}
        {isSingleOrder && (
          <div className="border-t px-3 py-2">
            <div className="flex items-center gap-1 justify-end">
              <Badge variant="outline" className="text-xs">
                {group.orders[0].exchange.toUpperCase()}
              </Badge>
              <Badge 
                variant={group.orders[0].status === 'filled' ? 'secondary' : 'default'} 
                className="text-xs"
              >
                {group.orders[0].status.toUpperCase()}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </Collapsible>
  );
}
