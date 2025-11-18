import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BitcoinOrder, OrderType, TimeRange } from "@shared/schema";
import { SummaryStats } from "@/components/summary-stats";
import { HighRiskAlert } from "@/components/high-risk-alert";
import { OrderFeed } from "@/components/order-feed";
import { FilterControls } from "@/components/filter-controls";
import { useWebSocket } from "@/hooks/use-websocket";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [minSize, setMinSize] = useState<number>(1);
  const [minLeverage, setMinLeverage] = useState<number>(1);
  const [orderType, setOrderType] = useState<OrderType>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Connect to WebSocket for real-time updates
  useWebSocket();

  const { data: orders = [], isLoading, refetch } = useQuery<BitcoinOrder[]>({
    queryKey: ['/api/orders', { minSize, minLeverage, orderType, timeRange }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (minSize > 1) params.append('minSize', minSize.toString());
      if (minLeverage > 1) params.append('minLeverage', minLeverage.toString());
      if (orderType !== 'all') params.append('orderType', orderType);
      params.append('timeRange', timeRange);
      
      const response = await fetch(`/api/orders?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Orders are already filtered by the backend
  const filteredOrders = orders;

  const highRiskOrders = filteredOrders.filter(order => order.leverage >= 25);
  const longOrders = filteredOrders.filter(order => order.type === 'long');
  const shortOrders = filteredOrders.filter(order => order.type === 'short');
  
  const totalVolume = filteredOrders.reduce((sum, order) => sum + order.size, 0);
  const avgLeverage = filteredOrders.length > 0
    ? filteredOrders.reduce((sum, order) => sum + order.leverage, 0) / filteredOrders.length
    : 0;

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          {/* Summary Statistics */}
          <SummaryStats
            totalVolume={totalVolume}
            longCount={longOrders.length}
            shortCount={shortOrders.length}
            avgLeverage={avgLeverage}
          />

          {/* High Risk Alert */}
          {highRiskOrders.length > 0 && (
            <HighRiskAlert count={highRiskOrders.length} />
          )}

          {/* Filters */}
          <FilterControls
            minSize={minSize}
            setMinSize={setMinSize}
            minLeverage={minLeverage}
            setMinLeverage={setMinLeverage}
            orderType={orderType}
            setOrderType={setOrderType}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
          />

          {/* Order Feed */}
          <OrderFeed orders={filteredOrders} isLoading={isLoading} />
        </div>
      </main>
    </div>
  );
}
