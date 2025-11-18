import { useEffect, useRef } from 'react';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, AlertTriangle } from 'lucide-react';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle large order alerts
            if (data.type === 'new_order' && data.order) {
              const order = data.order;
              const orderSizeBTC = order.size;
              
              // Alert for 1000+ BTC orders
              if (orderSizeBTC >= 1000) {
                toast({
                  title: "🐋 MEGA WHALE ALERT",
                  description: `${orderSizeBTC.toFixed(2)} BTC ${order.type.toUpperCase()} order at $${order.price.toLocaleString()} on ${order.exchange.toUpperCase()}`,
                  variant: "destructive",
                  duration: 10000,
                });
              }
              // Alert for 100+ BTC orders
              else if (orderSizeBTC >= 100) {
                toast({
                  title: "🐳 Large Whale Alert",
                  description: `${orderSizeBTC.toFixed(2)} BTC ${order.type.toUpperCase()} order at $${order.price.toLocaleString()} on ${order.exchange.toUpperCase()}`,
                  duration: 7000,
                });
              }
            }
            
            if (data.type === 'initial_data' || data.type === 'new_order' || data.type === 'order_filled') {
              // Invalidate all /api/orders queries regardless of filter parameters
              queryClient.invalidateQueries({ 
                predicate: (query) => {
                  const key = query.queryKey;
                  return Array.isArray(key) && key[0] === '/api/orders';
                },
                refetchType: 'active'
              });
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected, attempting to reconnect...');
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
}
