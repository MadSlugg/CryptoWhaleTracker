import type { BitcoinOrder } from "@shared/schema";
import { getLeverageRiskLevel } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeverageIndicator } from "./leverage-indicator";
import { TrendingUp, TrendingDown, Clock, DollarSign, Wallet, Copy, Check, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface OrderCardProps {
  order: BitcoinOrder;
}

export function OrderCard({ order }: OrderCardProps) {
  const isLong = order.type === 'long';
  const isClosed = order.status === 'closed';
  const riskLevel = getLeverageRiskLevel(order.leverage);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const formattedTime = formatDistanceToNow(new Date(order.timestamp), {
    addSuffix: true,
  });

  const formattedCloseTime = order.closedAt ? formatDistanceToNow(new Date(order.closedAt), {
    addSuffix: true,
  }) : null;

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(order.walletAddress);
      setCopied(true);
      toast({
        title: "Wallet address copied",
        description: "Address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy wallet address",
        variant: "destructive",
      });
    }
  };

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
                  variant={isClosed ? "secondary" : "outline"}
                  className="text-xs"
                  data-testid={`badge-status-${order.id}`}
                >
                  {isClosed ? 'CLOSED' : 'OPEN'}
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
                  {isClosed && order.closePrice && (
                    <>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-mono" data-testid={`text-close-price-${order.id}`}>
                        ${order.closePrice.toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span data-testid={`text-time-${order.id}`}>{isClosed && formattedCloseTime ? `Closed ${formattedCloseTime}` : `Opened ${formattedTime}`}</span>
                </div>

                {isClosed && order.profitLoss !== undefined && (
                  <Badge 
                    variant={order.profitLoss >= 0 ? "default" : "destructive"}
                    className="font-mono text-xs"
                    data-testid={`badge-profit-loss-${order.id}`}
                  >
                    {order.profitLoss >= 0 ? '+' : ''}{order.profitLoss.toFixed(2)}%
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-1 mt-1">
                <Wallet className="h-3 w-3 text-muted-foreground" />
                <span 
                  className="text-xs font-mono text-muted-foreground"
                  data-testid={`text-wallet-${order.id}`}
                >
                  {truncateAddress(order.walletAddress)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 ml-1"
                  onClick={copyAddress}
                  data-testid={`button-copy-wallet-${order.id}`}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
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
