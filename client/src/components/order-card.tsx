import type { BitcoinOrder } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock, DollarSign, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OrderCardProps {
  order: BitcoinOrder;
}

export function OrderCard({ order }: OrderCardProps) {
  const isLong = order.type === 'long';
  const isFilled = order.status === 'filled';
  
  const formattedTime = formatDistanceToNow(new Date(order.timestamp), {
    addSuffix: true,
  });

  const formattedFillTime = order.filledAt ? formatDistanceToNow(new Date(order.filledAt), {
    addSuffix: true,
  }) : null;

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
                <Badge 
                  variant="secondary"
                  className="text-xs uppercase"
                  data-testid={`badge-exchange-${order.id}`}
                >
                  {order.exchange}
                </Badge>
                <Badge 
                  variant={isFilled ? "secondary" : "outline"}
                  className="text-xs"
                  data-testid={`badge-status-${order.id}`}
                >
                  {isFilled ? 'FILLED' : 'ACTIVE'}
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
                    ${Math.round(order.price).toLocaleString()}
                  </span>
                  {isFilled && order.fillPrice && (
                    <>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-mono" data-testid={`text-fill-price-${order.id}`}>
                        ${Math.round(order.fillPrice).toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span data-testid={`text-time-${order.id}`}>
                    {isFilled && formattedFillTime ? `Filled ${formattedFillTime}` : `Opened ${formattedTime}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
