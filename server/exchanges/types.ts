// Shared types for all exchange services

export interface OrderBookEntry {
  price: number;
  quantity: number;
  type: 'bid' | 'ask';
  total: number;
  market: 'spot' | 'futures';
}

export interface ExchangeService {
  getWhaleOrders(minNotionalUSD: number, referencePrice: number): Promise<OrderBookEntry[]>;
}
