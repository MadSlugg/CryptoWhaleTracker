import type { BitcoinOrder } from "@shared/schema";
import { OrderCard } from "./order-card";
import { Card, CardContent } from "@/components/ui/card";
import { InboxIcon } from "lucide-react";

interface OrderFeedProps {
  orders: BitcoinOrder[];
  isLoading: boolean;
  title?: string;
}

export function OrderFeed({ orders, isLoading, title = "Recent Orders" }: OrderFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <InboxIcon className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-lg">No orders found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters to see more results
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground" data-testid="text-order-count">
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="space-y-3">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}
