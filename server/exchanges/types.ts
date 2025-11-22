// Shared types for all exchange services

export interface OrderBookEntry {
  price: number;
  quantity: number;
  type: 'bid' | 'ask';
  total: number;
}

export interface ExchangeService {
  getWhaleOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]>;
}
