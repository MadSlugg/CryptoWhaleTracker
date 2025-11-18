import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, TrendingUp, TrendingDown } from "lucide-react";
import type { BitcoinOrder } from "@shared/schema";

interface OrderBookImbalanceProps {
  orders: BitcoinOrder[];
  currentPrice: number;
}

export function OrderBookImbalance({ orders, currentPrice }: OrderBookImbalanceProps) {
  // Calculate order book imbalance
  const calculateImbalance = () => {
    const activeOrders = orders.filter(o => o.status === 'active');

    // Calculate bid (long) and ask (short) liquidity
    const bidOrders = activeOrders.filter(o => o.type === 'long');
    const askOrders = activeOrders.filter(o => o.type === 'short');

    const bidVolumeBTC = bidOrders.reduce((sum, o) => sum + o.size, 0);
    const askVolumeBTC = askOrders.reduce((sum, o) => sum + o.size, 0);

    const bidVolumeUSD = bidOrders.reduce((sum, o) => sum + (o.size * o.price), 0);
    const askVolumeUSD = askOrders.reduce((sum, o) => sum + (o.size * o.price), 0);

    const totalVolumeBTC = bidVolumeBTC + askVolumeBTC;
    const totalVolumeUSD = bidVolumeUSD + askVolumeUSD;

    // Calculate imbalance ratio (-100 to +100)
    // Positive = more bid pressure (bullish), Negative = more ask pressure (bearish)
    let imbalanceRatio = 0;
    if (totalVolumeBTC > 0) {
      imbalanceRatio = ((bidVolumeBTC - askVolumeBTC) / totalVolumeBTC) * 100;
    }

    // Determine pressure level
    // Imbalance thresholds:
    // ±50% = 75/25 split or more extreme (STRONG)
    // ±30% = 65/35 split (MODERATE)
    // ±15% = 57.5/42.5 split (SLIGHT)
    // <±15% = relatively balanced
    let pressureLevel: string;
    let pressureColor: string;
    let pressureDescription: string;

    if (imbalanceRatio >= 50) {
      pressureLevel = 'STRONG BUY';
      pressureColor = 'bg-green-600 text-white';
      pressureDescription = 'Heavy buying pressure from whales';
    } else if (imbalanceRatio >= 30) {
      pressureLevel = 'MODERATE BUY';
      pressureColor = 'bg-green-500 text-white';
      pressureDescription = 'More buyers than sellers';
    } else if (imbalanceRatio >= 15) {
      pressureLevel = 'SLIGHT BUY';
      pressureColor = 'bg-green-400 text-black';
      pressureDescription = 'Slightly more buying interest';
    } else if (imbalanceRatio > -15) {
      pressureLevel = 'BALANCED';
      pressureColor = 'bg-muted';
      pressureDescription = 'Equal buying and selling pressure';
    } else if (imbalanceRatio > -30) {
      pressureLevel = 'SLIGHT SELL';
      pressureColor = 'bg-red-400 text-black';
      pressureDescription = 'Slightly more selling interest';
    } else if (imbalanceRatio > -50) {
      pressureLevel = 'MODERATE SELL';
      pressureColor = 'bg-red-500 text-white';
      pressureDescription = 'More sellers than buyers';
    } else {
      pressureLevel = 'STRONG SELL';
      pressureColor = 'bg-red-600 text-white';
      pressureDescription = 'Heavy selling pressure from whales';
    }

    return {
      bidVolumeBTC,
      askVolumeBTC,
      bidVolumeUSD,
      askVolumeUSD,
      totalVolumeBTC,
      totalVolumeUSD,
      imbalanceRatio,
      pressureLevel,
      pressureColor,
      pressureDescription,
      bidCount: bidOrders.length,
      askCount: askOrders.length,
    };
  };

  const imbalance = calculateImbalance();

  // Format large numbers
  const formatUSD = (value: number) => {
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(2)}B`;
    } else if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-primary" data-testid="icon-imbalance" />
          Order Book Imbalance
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Real-time supply and demand pressure from active whale orders. Shows market depth imbalance.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Pressure Indicator */}
          <div className="flex flex-col items-center gap-3 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <Badge 
                className={imbalance.pressureColor}
                data-testid="badge-pressure-level"
              >
                {imbalance.pressureLevel}
              </Badge>
              
              {imbalance.imbalanceRatio > 5 ? (
                <TrendingUp className="h-6 w-6 text-green-600" data-testid="icon-pressure-up" />
              ) : imbalance.imbalanceRatio < -5 ? (
                <TrendingDown className="h-6 w-6 text-red-600" data-testid="icon-pressure-down" />
              ) : (
                <Scale className="h-6 w-6 text-muted-foreground" data-testid="icon-pressure-balanced" />
              )}
            </div>

            <p className="text-sm text-center text-muted-foreground">
              {imbalance.pressureDescription}
            </p>

            {/* Imbalance ratio display */}
            <div className="text-center">
              <div className="text-3xl font-bold font-mono" data-testid="text-imbalance-ratio">
                {imbalance.imbalanceRatio > 0 ? '+' : ''}{imbalance.imbalanceRatio.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Imbalance Ratio</div>
            </div>

            {/* Visual balance bar */}
            <div className="w-full space-y-1">
              <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex">
                <div 
                  className="bg-green-600 transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, imbalance.imbalanceRatio + 50))}%` }}
                  data-testid="bar-bid-pressure"
                />
                <div 
                  className="bg-red-600 transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, 50 - imbalance.imbalanceRatio))}%` }}
                  data-testid="bar-ask-pressure"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400 font-semibold">Buy Pressure</span>
                <span className="text-red-600 dark:text-red-400 font-semibold">Sell Pressure</span>
              </div>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-2 gap-3">
            {/* Bid Side */}
            <div className="space-y-2 p-3 rounded-lg border bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                  Bid Side (Buy)
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Volume</span>
                  <span className="text-sm font-mono font-bold" data-testid="text-bid-volume-btc">
                    {imbalance.bidVolumeBTC.toFixed(2)} BTC
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Notional</span>
                  <span className="text-sm font-mono font-bold" data-testid="text-bid-volume-usd">
                    {formatUSD(imbalance.bidVolumeUSD)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Orders</span>
                  <Badge variant="secondary" className="text-xs" data-testid="badge-bid-count">
                    {imbalance.bidCount}
                  </Badge>
                </div>
                {imbalance.totalVolumeBTC > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Share</span>
                    <span className="text-sm font-bold text-green-600">
                      {((imbalance.bidVolumeBTC / imbalance.totalVolumeBTC) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Ask Side */}
            <div className="space-y-2 p-3 rounded-lg border bg-red-50 dark:bg-red-950/20">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                  Ask Side (Sell)
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Volume</span>
                  <span className="text-sm font-mono font-bold" data-testid="text-ask-volume-btc">
                    {imbalance.askVolumeBTC.toFixed(2)} BTC
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Notional</span>
                  <span className="text-sm font-mono font-bold" data-testid="text-ask-volume-usd">
                    {formatUSD(imbalance.askVolumeUSD)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Orders</span>
                  <Badge variant="secondary" className="text-xs" data-testid="badge-ask-count">
                    {imbalance.askCount}
                  </Badge>
                </div>
                {imbalance.totalVolumeBTC > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Share</span>
                    <span className="text-sm font-bold text-red-600">
                      {((imbalance.askVolumeBTC / imbalance.totalVolumeBTC) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Total Liquidity */}
          {imbalance.totalVolumeBTC > 0 && (
            <div className="p-3 rounded-lg border bg-muted/50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Total Active Liquidity</span>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold" data-testid="text-total-volume-btc">
                    {imbalance.totalVolumeBTC.toFixed(2)} BTC
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-total-volume-usd">
                    {formatUSD(imbalance.totalVolumeUSD)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
