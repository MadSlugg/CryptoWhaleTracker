import { useEffect, useRef } from 'react';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
            
            // Handle new order alerts
            if (data.type === 'new_order' && data.order) {
              const order = data.order;
              const orderSizeBTC = order.size;
              
              // Alert for 1000+ BTC new orders
              if (orderSizeBTC >= 1000) {
                toast({
                  title: "MEGA WHALE ALERT - ACTIVE",
                  description: `${orderSizeBTC.toFixed(2)} BTC ${order.type.toUpperCase()} at $${order.price.toLocaleString()} on ${order.exchange.toUpperCase()} | Status: ACTIVE`,
                  variant: "destructive",
                  duration: 10000,
                });
              }
              // Alert for 100+ BTC new orders
              else if (orderSizeBTC >= 100) {
                toast({
                  title: "Large Whale Alert - ACTIVE",
                  description: `${orderSizeBTC.toFixed(2)} BTC ${order.type.toUpperCase()} at $${order.price.toLocaleString()} on ${order.exchange.toUpperCase()} | Status: ACTIVE`,
                  duration: 7000,
                });
              }
            }
            
            // Handle filled order alerts
            if (data.type === 'order_filled' && data.order) {
              const order = data.order;
              const orderSizeBTC = order.size;
              const fillPrice = order.fillPrice || order.price;
              
              // Alert for 1000+ BTC filled orders
              if (orderSizeBTC >= 1000) {
                toast({
                  title: "MEGA WHALE - FILLED",
                  description: `${orderSizeBTC.toFixed(2)} BTC ${order.type.toUpperCase()} at $${fillPrice.toLocaleString()} on ${order.exchange.toUpperCase()} | Status: FILLED`,
                  variant: "destructive",
                  duration: 10000,
                });
              }
              // Alert for 100+ BTC filled orders
              else if (orderSizeBTC >= 100) {
                toast({
                  title: "Large Whale - FILLED",
                  description: `${orderSizeBTC.toFixed(2)} BTC ${order.type.toUpperCase()} at $${fillPrice.toLocaleString()} on ${order.exchange.toUpperCase()} | Status: FILLED`,
                  duration: 7000,
                });
              }
            }
            
            // Handle disappeared order events (orders that vanished from order book)
            if (data.type === 'order_disappeared' && data.order) {
              // Silently update - don't spam toasts for disappeared orders
              // Just invalidate cache to refresh the UI
            }
            
            if (data.type === 'initial_data' || data.type === 'new_order' || data.type === 'order_filled' || data.type === 'order_disappeared') {
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
