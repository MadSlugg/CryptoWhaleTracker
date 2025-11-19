import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BitcoinOrder, OrderType, TimeRange, PositionStatus, Exchange } from "@shared/schema";
import { OrderFeed } from "@/components/order-feed";
import { FilterControls } from "@/components/filter-controls";
import { DepthChart } from "@/components/depth-chart";
import { MajorWhales } from "@/components/major-whales";
import { PriceClusters } from "@/components/price-clusters";
import { PriceHeatmap } from "@/components/price-heatmap";
import { OrderBookImbalance } from "@/components/order-book-imbalance";
import { SummaryStats } from "@/components/summary-stats";
import { FilledOrderFlow } from "@/components/filled-order-flow";
import { ExecutionLevels } from "@/components/execution-levels";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiBitcoin } from "react-icons/si";
import { format } from "date-fns";

export default function Dashboard() {
  const [minSize, setMinSize] = useState<number>(5);
  const [orderType, setOrderType] = useState<OrderType>('all');
  const [exchange, setExchange] = useState<Exchange>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [status, setStatus] = useState<PositionStatus>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  // Connect to WebSocket for real-time updates
  useWebSocket();

  // Fetch orders filtered by user's selections
  // Always include exchange in query key to prevent stale cache when switching
  const { data: orders = [], isLoading, refetch, error } = useQuery<BitcoinOrder[]>({
    queryKey: ['/api/orders', minSize, orderType, exchange, timeRange, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (minSize > 5) params.append('minSize', minSize.toString());
      if (orderType !== 'all') params.append('orderType', orderType);
      if (exchange !== 'all') params.append('exchange', exchange);
      if (status !== 'all') params.append('status', status);
      params.append('timeRange', timeRange);
      
      const response = await fetch(`/api/orders?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch orders' }));
        throw new Error(errorData.error || 'Failed to fetch orders');
      }
      return response.json();
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Show toast notification for errors (only once per error)
  useEffect(() => {
    if (error) {
      toast({
        title: "Filter Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error?.message, toast]);

  // Fetch time-range-only orders for accurate price calculation (separate cache key)
  const { data: timeRangeOrders = [] } = useQuery<BitcoinOrder[]>({
    queryKey: ['price-calculation-orders', timeRange],
    queryFn: async () => {
      // Fetch with ONLY timeRange filter (no size/type filters)
      const params = new URLSearchParams();
      params.append('timeRange', timeRange);
      // Don't send minSize/orderType - backend defaults will not filter these
      
      const response = await fetch(`/api/orders?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Fetch major whale orders (100+ BTC) - independent of user filters
  const { data: majorWhaleOrders = [] } = useQuery<BitcoinOrder[]>({
    queryKey: ['major-whales', timeRange],
    queryFn: async () => {
      // Always fetch 100+ BTC orders regardless of user's filter settings
      const params = new URLSearchParams();
      params.append('minSize', '100');
      params.append('timeRange', timeRange);
      params.append('status', 'all'); // Show both active AND filled major whales
      // No orderType or exchange filters - show ALL major whales
      
      const response = await fetch(`/api/orders?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch major whale orders');
      return response.json();
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Orders are already filtered by the backend
  const filteredOrders = orders;

  // Calculate current BTC price from time-range-only orders
  // Sort by timestamp to get newest order
  const sortedTimeRangeOrders = [...timeRangeOrders].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  // Current price: most recent order in the time range
  const newestOrder = sortedTimeRangeOrders[0];
  const currentBtcPrice = newestOrder ? newestOrder.price : 93000;

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
                  ${currentBtcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

          {/* Summary Stats - Long vs Short ratio based on active orders only */}
          <SummaryStats 
            longCount={filteredOrders.filter(o => o.status === 'active' && o.type === 'long').length}
            shortCount={filteredOrders.filter(o => o.status === 'active' && o.type === 'short').length}
            longVolume={filteredOrders.filter(o => o.status === 'active' && o.type === 'long').reduce((sum, o) => sum + o.size, 0)}
            shortVolume={filteredOrders.filter(o => o.status === 'active' && o.type === 'short').reduce((sum, o) => sum + o.size, 0)}
          />

          {/* Filled Order Flow - Predicts price direction based on whale execution patterns */}
          <FilledOrderFlow
            timeRange={timeRange}
            minSize={minSize}
            exchange={exchange}
          />

          {/* Execution Levels - Shows actual support/resistance where whales executed */}
          <ExecutionLevels
            timeRange={timeRange}
            minSize={minSize}
            exchange={exchange}
            currentPrice={currentBtcPrice}
          />

          {/* Major Whales Box - Highlight 100+ BTC orders (independent of filters) */}
          <MajorWhales orders={majorWhaleOrders} />

          {/* Large Price Level Heatmap - Visual map of whale concentration (50+ BTC) */}
          <PriceHeatmap 
            orders={filteredOrders} 
            currentPrice={currentBtcPrice}
          />

          {/* Order Book Imbalance - Supply/Demand pressure */}
          <OrderBookImbalance 
            orders={filteredOrders} 
            currentPrice={currentBtcPrice}
          />

          {/* Price Clusters - Pattern detection and accumulation zones */}
          <PriceClusters 
            orders={filteredOrders}
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
