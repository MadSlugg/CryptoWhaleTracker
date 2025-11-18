import { z } from "zod";

export const bitcoinOrderSchema = z.object({
  id: z.string(),
  type: z.enum(['long', 'short']),
  size: z.number().positive(),
  price: z.number().positive(),
  timestamp: z.string(),
  status: z.enum(['open', 'closed']),
  closedAt: z.string().optional(),
  closePrice: z.number().positive().optional(),
  profitLoss: z.number().optional(),
});

export const insertBitcoinOrderSchema = bitcoinOrderSchema.omit({ id: true });

export type BitcoinOrder = z.infer<typeof bitcoinOrderSchema>;
export type InsertBitcoinOrder = z.infer<typeof insertBitcoinOrderSchema>;

export type OrderType = 'long' | 'short' | 'all';
export type TimeRange = '1h' | '4h' | '24h' | '7d';
export type PositionStatus = 'open' | 'closed' | 'all';

// Whale Alert schema - large BTC transfers to/from exchanges
export const whaleMovementSchema = z.object({
  id: z.string(),
  amount: z.number().positive(), // BTC amount
  amountUSD: z.number().positive(), // USD value
  from: z.string(), // Source address or exchange name
  to: z.string(), // Destination address or exchange name
  hash: z.string(), // Transaction hash
  timestamp: z.string(),
  isToExchange: z.boolean(), // True if moving TO an exchange (potential sell pressure)
  isFromExchange: z.boolean(), // True if moving FROM an exchange (potential accumulation)
});

export type WhaleMovement = z.infer<typeof whaleMovementSchema>;

// Long/Short Ratio data from Binance
export const longShortRatioSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  symbol: z.string(),
  longShortRatio: z.number(), // Ratio of longs to shorts
  longAccount: z.number(), // Percentage of accounts that are long
  shortAccount: z.number(), // Percentage of accounts that are short
  period: z.enum(['5m', '15m', '30m', '1h', '2h', '4h']),
  isTopTrader: z.boolean(), // True if this is top trader data
});

export type LongShortRatio = z.infer<typeof longShortRatioSchema>;

// Liquidation event from Binance
export const liquidationSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']), // BUY = long liquidation, SELL = short liquidation
  price: z.number().positive(),
  quantity: z.number().positive(),
  timestamp: z.string(),
  totalUSD: z.number().positive(), // USD value of liquidation
});

export type Liquidation = z.infer<typeof liquidationSchema>;

// Whale correlation event - connects whale movement with trading pattern
export const whaleCorrelationSchema = z.object({
  id: z.string(),
  whaleMovementId: z.string(),
  timestamp: z.string(),
  btcAmount: z.number().positive(),
  initialLongShortRatio: z.number(),
  currentLongShortRatio: z.number(),
  ratioChange: z.number(), // Percentage change in ratio
  shortSpike: z.boolean(), // True if shorts spiked significantly
  likelyAction: z.enum(['shorting', 'longing', 'neutral']),
  confidence: z.enum(['low', 'medium', 'high']),
});

export type WhaleCorrelation = z.infer<typeof whaleCorrelationSchema>;

export function calculateProfitLoss(
  entryPrice: number,
  exitPrice: number,
  type: 'long' | 'short'
): number {
  const priceChange = ((exitPrice - entryPrice) / entryPrice) * 100;
  
  if (type === 'long') {
    // For longs, profit when price goes up
    return priceChange;
  } else {
    // For shorts, profit when price goes down
    return -priceChange;
  }
}
