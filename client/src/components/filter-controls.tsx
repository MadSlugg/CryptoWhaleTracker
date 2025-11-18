import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { OrderType, TimeRange, PositionStatus, Exchange } from "@shared/schema";

interface FilterControlsProps {
  minSize: number;
  setMinSize: (value: number) => void;
  orderType: OrderType;
  setOrderType: (value: OrderType) => void;
  exchange: Exchange;
  setExchange: (value: Exchange) => void;
  timeRange: TimeRange;
  setTimeRange: (value: TimeRange) => void;
  status: PositionStatus;
  setStatus: (value: PositionStatus) => void;
}

export function FilterControls({
  minSize,
  setMinSize,
  orderType,
  setOrderType,
  exchange,
  setExchange,
  timeRange,
  setTimeRange,
  status,
  setStatus,
}: FilterControlsProps) {
  return (
    <Card data-testid="card-filters">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="min-size" className="text-sm font-medium">
              Minimum Size
            </Label>
            <Select
              value={minSize.toString()}
              onValueChange={(value) => setMinSize(Number(value))}
            >
              <SelectTrigger id="min-size" data-testid="select-min-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">≥ 1 BTC</SelectItem>
                <SelectItem value="5">≥ 5 BTC</SelectItem>
                <SelectItem value="10">≥ 10 BTC</SelectItem>
                <SelectItem value="25">≥ 25 BTC</SelectItem>
                <SelectItem value="50">≥ 50 BTC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exchange" className="text-sm font-medium">
              Exchange
            </Label>
            <Select
              value={exchange}
              onValueChange={(value) => setExchange(value as Exchange)}
            >
              <SelectTrigger id="exchange" data-testid="select-exchange">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exchanges</SelectItem>
                <SelectItem value="binance">Binance</SelectItem>
                <SelectItem value="kraken">Kraken</SelectItem>
                <SelectItem value="coinbase">Coinbase</SelectItem>
                <SelectItem value="okx">OKX</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="order-type" className="text-sm font-medium">
              Position Type
            </Label>
            <Select
              value={orderType}
              onValueChange={(value) => setOrderType(value as OrderType)}
            >
              <SelectTrigger id="order-type" data-testid="select-order-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                <SelectItem value="long">Long Only</SelectItem>
                <SelectItem value="short">Short Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time-range" className="text-sm font-medium">
              Time Range
            </Label>
            <Select
              value={timeRange}
              onValueChange={(value) => setTimeRange(value as TimeRange)}
            >
              <SelectTrigger id="time-range" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="4h">Last 4 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium">
              Status
            </Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as PositionStatus)}
            >
              <SelectTrigger id="status" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="active">Active Orders</SelectItem>
                <SelectItem value="filled">Filled Orders</SelectItem>
                <SelectItem value="disappeared">Disappeared Orders</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
