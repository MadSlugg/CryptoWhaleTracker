import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Exchange } from "@shared/schema";
import { PriceClusters } from "@/components/price-clusters";
import { BuyEntryPoints, SellEntryPoints } from "@/components/buy-sell-entry-points";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { SiBitcoin } from "react-icons/si";
import { format } from "date-fns";

export default function Dashboard() {
  const [exchange, setExchange] = useState<Exchange>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  // Connect to WebSocket for real-time updates
  useWebSocket();

  // Fetch consolidated dashboard data (simplified - no filters needed, exchange handled by entry points)
  const { data: dashboardData, isLoading, refetch, error} = useQuery<{
    priceSnapshot: number;
    allActiveOrders: any[];
  }>({
    queryKey: ['/api/dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch dashboard data' }));
        throw new Error(errorData.error || 'Failed to fetch dashboard data');
      }
      return response.json();
    },
    refetchInterval: autoRefresh ? 20000 : false,
    staleTime: 5000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Show toast notification for errors (only once per error)
  useEffect(() => {
    if (error) {
      toast({
        title: "Dashboard Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error?.message, toast]);

  // Extract data from consolidated response (with defaults)
  const currentBtcPrice = dashboardData?.priceSnapshot || 93000;
  const allActiveOrders = dashboardData?.allActiveOrders || [];

  const handleRefresh = async () => {
    await refetch();
  };

  // Format current date
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                  Bitcoin Liquidity Monitor
                </h1>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2 w-2 rounded-full bg-primary animate-pulse" 
                    data-testid="indicator-live-status"
                  />
                  <span className="text-sm text-muted-foreground">Live</span>
                </div>
              </div>
              
              {/* Date Display */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border">
                <Calendar className="h-4 w-4 text-muted-foreground" data-testid="icon-calendar" />
                <span className="text-sm font-medium" data-testid="text-current-date">
                  {currentDate}
                </span>
              </div>
              
              {/* BTC Price Display */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border">
                <SiBitcoin className="h-5 w-5 text-orange-500" data-testid="icon-bitcoin" />
                <span className="text-lg font-mono font-bold" data-testid="text-btc-price">
                  ${Math.round(currentBtcPrice).toLocaleString()}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Badge
                variant={autoRefresh ? "default" : "secondary"}
                className="cursor-pointer hover-elevate active-elevate-2"
                onClick={() => setAutoRefresh(!autoRefresh)}
                data-testid="badge-auto-refresh"
              >
                Auto-refresh: {autoRefresh ? 'On' : 'Off'}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="space-y-6">
          {/* Exchange Filter */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Exchange Filter:</label>
              <Select value={exchange} onValueChange={(value) => setExchange(value as Exchange)}>
                <SelectTrigger className="w-48" data-testid="select-exchange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exchanges</SelectItem>
                  <SelectItem value="binance">Binance</SelectItem>
                  <SelectItem value="bybit">Bybit</SelectItem>
                  <SelectItem value="kraken">Kraken</SelectItem>
                  <SelectItem value="bitfinex">Bitfinex</SelectItem>
                  <SelectItem value="coinbase">Coinbase</SelectItem>
                  <SelectItem value="okx">OKX</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="bitstamp">Bitstamp</SelectItem>
                  <SelectItem value="kucoin">KuCoin</SelectItem>
                  <SelectItem value="htx">HTX</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                Filter entry points by exchange
              </span>
            </div>
          </Card>

          {/* Smart Entry Points - Separate BUY and SELL recommendations */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            <BuyEntryPoints exchange={exchange} />
            <SellEntryPoints exchange={exchange} />
          </div>

          {/* Price Clusters - Pattern detection and accumulation zones */}
          <PriceClusters 
            orders={allActiveOrders}
            currentPrice={currentBtcPrice}
          />
        </div>
      </main>
    </div>
  );
}
