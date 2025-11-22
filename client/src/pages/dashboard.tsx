import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BitcoinOrder, OrderType, TimeRange, PositionStatus, Exchange } from "@shared/schema";
import { OrderFeed } from "@/components/order-feed";
import { FilterControls } from "@/components/filter-controls";
import { DepthChart } from "@/components/depth-chart";
import { MajorWhales } from "@/components/major-whales";
import { PriceClusters } from "@/components/price-clusters";
import { FilledOrderFlow } from "@/components/filled-order-flow";
import { LongEntryPoints, ShortEntryPoints } from "@/components/long-short-entry-points";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiBitcoin } from "react-icons/si";
import { format } from "date-fns";

export default function Dashboard() {
  const [minSize, setMinSize] = useState<number>(100);
  const [orderType, setOrderType] = useState<OrderType>('all');
  const [exchange, setExchange] = useState<Exchange>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [status, setStatus] = useState<PositionStatus>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  // Connect to WebSocket for real-time updates
  useWebSocket();

  // Fetch consolidated dashboard data (single API call replaces 3 separate calls)
  const { data: dashboardData, isLoading, refetch, error } = useQuery<{
    filteredOrders: BitcoinOrder[];
    priceSnapshot: number;
    majorWhales: BitcoinOrder[];
    allActiveOrders: BitcoinOrder[];
  }>({
    queryKey: ['/api/dashboard', minSize, orderType, exchange, timeRange, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (minSize > 0) params.append('minSize', minSize.toString());
      if (orderType !== 'all') params.append('orderType', orderType);
      if (exchange !== 'all') params.append('exchange', exchange);
      if (status !== 'all') params.append('status', status);
      params.append('timeRange', timeRange);
      
      const response = await fetch(`/api/dashboard?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch dashboard data' }));
        throw new Error(errorData.error || 'Failed to fetch dashboard data');
      }
      return response.json();
    },
    refetchInterval: autoRefresh ? 20000 : false, // Increased from 10s to 20s
    staleTime: 5000, // Data considered fresh for 5 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
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
  const filteredOrders = dashboardData?.filteredOrders || [];
  const currentBtcPrice = dashboardData?.priceSnapshot || 93000;
  const majorWhaleOrders = dashboardData?.majorWhales || [];
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
                  Bitcoin Whale Tracker
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
          {/* Filters - Control what data you see */}
          <FilterControls
            minSize={minSize}
            setMinSize={setMinSize}
            orderType={orderType}
            setOrderType={setOrderType}
            exchange={exchange}
            setExchange={setExchange}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            status={status}
            setStatus={setStatus}
          />

          {/* Major Whales Box - Highlight 100+ BTC orders (independent of filters) */}
          <MajorWhales orders={majorWhaleOrders} />

          {/* Smart Entry Points - Separate BUY and SELL recommendations */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            <LongEntryPoints exchange={exchange} />
            <ShortEntryPoints exchange={exchange} />
          </div>

          {/* Filled Order Flow - Predicts price direction based on whale execution patterns (Last 30 Minutes) */}
          <FilledOrderFlow
            minSize={minSize}
            exchange={exchange}
          />

          {/* Price Clusters - Pattern detection and accumulation zones */}
          <PriceClusters 
            orders={allActiveOrders}
            currentPrice={currentBtcPrice}
          />

          {/* Depth Chart - Shows concentration of orders at different price levels */}
          <DepthChart 
            orders={filteredOrders.filter(o => o.status === 'active')} 
            currentPrice={currentBtcPrice}
            title="Order Book Depth - Active Whale Orders"
          />

          {/* Two-column layout: Active vs Filled Orders */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Active Orders Column */}
            <OrderFeed 
              orders={filteredOrders.filter(o => o.status === 'active')} 
              isLoading={isLoading}
              title="Active Orders (Waiting)"
            />

            {/* Filled Orders Column */}
            <OrderFeed 
              orders={filteredOrders.filter(o => o.status === 'filled')} 
              isLoading={isLoading}
              title="Filled Orders (Executed)"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
