import type { BitcoinOrder } from "@shared/schema";
import { getLeverageRiskLevel } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeverageIndicator } from "./leverage-indicator";
import { TrendingUp, TrendingDown, Clock, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OrderCardProps {
  order: BitcoinOrder;
}

export function OrderCard({ order }: OrderCardProps) {
  const isLong = order.type === 'long';
  const riskLevel = getLeverageRiskLevel(order.leverage);
  
  const formattedTime = formatDistanceToNow(new Date(order.timestamp), {
    addSuffix: true,
  });

  return (
    <Card 
      className="hover-elevate transition-all" 
      data-testid={`card-order-${order.id}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left section: Position type and size */}
          <div className="flex items-center gap-3 flex-1">
            <div className={`flex items-center justify-center w-10 h-10 rounded-md ${
              isLong ? 'bg-long/10' : 'bg-short/10'
            }`}>
              {isLong ? (
                <TrendingUp className="h-5 w-5 text-long" data-testid="icon-long" />
              ) : (
                <TrendingDown className="h-5 w-5 text-short" data-testid="icon-short" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge 
                  variant={isLong ? "default" : "destructive"}
                  className="font-semibold"
                  data-testid={`badge-type-${order.id}`}
                >
                  {isLong ? 'LONG' : 'SHORT'}
                </Badge>
                <span 
                  className="text-lg font-mono font-semibold"
                  data-testid={`text-size-${order.id}`}
                >
                  {order.size.toFixed(2)} BTC
                </span>
              </div>
              
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <span className="font-mono" data-testid={`text-price-${order.id}`}>
                    ${order.price.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span data-testid={`text-time-${order.id}`}>{formattedTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right section: Leverage indicator */}
          <div className="flex items-center gap-3 sm:flex-shrink-0">
            <LeverageIndicator 
              leverage={order.leverage} 
              riskLevel={riskLevel}
              orderId={order.id}
            />
            
            {order.liquidationPrice && (
              <div className="text-right hidden sm:block">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Liquidation
                </div>
                <div 
                  className="text-sm font-mono font-semibold text-destructive"
                  data-testid={`text-liquidation-${order.id}`}
                >
                  ${order.liquidationPrice.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile liquidation price */}
        {order.liquidationPrice && (
          <div className="mt-3 pt-3 border-t sm:hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Liquidation Price
              </span>
              <span className="text-sm font-mono font-semibold text-destructive">
                ${order.liquidationPrice.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
