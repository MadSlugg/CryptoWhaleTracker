import { z } from "zod";
import { pgTable, varchar, doublePrecision, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const bitcoinOrderSchema = z.object({
  id: z.string(),
  type: z.enum(['long', 'short']),
  size: z.number().positive(),
  price: z.number().positive(),
  exchange: z.enum(['binance', 'kraken', 'coinbase', 'okx']),
  timestamp: z.string(),
  status: z.enum(['active', 'filled']),
  filledAt: z.string().optional(),
  fillPrice: z.number().positive().optional(),
});

export const insertBitcoinOrderSchema = bitcoinOrderSchema.omit({ id: true });

export type BitcoinOrder = z.infer<typeof bitcoinOrderSchema>;
export type InsertBitcoinOrder = z.infer<typeof insertBitcoinOrderSchema>;

export type OrderType = 'long' | 'short' | 'all';
export type TimeRange = '1h' | '4h' | '24h' | '7d';
export type PositionStatus = 'active' | 'filled' | 'all';
export type Exchange = 'binance' | 'kraken' | 'coinbase' | 'okx' | 'all';

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

// Drizzle ORM Database Tables
export const bitcoinOrders = pgTable("bitcoin_orders", {
  id: varchar("id").primaryKey(),
  type: varchar("type", { length: 10 }).notNull(),
  size: doublePrecision("size").notNull(),
  price: doublePrecision("price").notNull(),
  exchange: varchar("exchange", { length: 20 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  status: varchar("status", { length: 10 }).notNull(),
  filledAt: timestamp("filled_at"),
  fillPrice: doublePrecision("fill_price"),
});

export const whaleMovements = pgTable("whale_movements", {
  id: varchar("id").primaryKey(),
  amount: doublePrecision("amount").notNull(),
  amountUSD: doublePrecision("amount_usd").notNull(),
  from: varchar("from", { length: 255 }).notNull(),
  to: varchar("to", { length: 255 }).notNull(),
  hash: varchar("hash", { length: 255 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  isToExchange: boolean("is_to_exchange").notNull(),
  isFromExchange: boolean("is_from_exchange").notNull(),
});

export const longShortRatios = pgTable("long_short_ratios", {
  id: varchar("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  longShortRatio: doublePrecision("long_short_ratio").notNull(),
  longAccount: doublePrecision("long_account").notNull(),
  shortAccount: doublePrecision("short_account").notNull(),
  period: varchar("period", { length: 10 }).notNull(),
  isTopTrader: boolean("is_top_trader").notNull(),
});

export const whaleCorrelations = pgTable("whale_correlations", {
  id: varchar("id").primaryKey(),
  whaleMovementId: varchar("whale_movement_id", { length: 255 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  btcAmount: doublePrecision("btc_amount").notNull(),
  initialLongShortRatio: doublePrecision("initial_long_short_ratio").notNull(),
  currentLongShortRatio: doublePrecision("current_long_short_ratio").notNull(),
  ratioChange: doublePrecision("ratio_change").notNull(),
  shortSpike: boolean("short_spike").notNull(),
  likelyAction: varchar("likely_action", { length: 20 }).notNull(),
  confidence: varchar("confidence", { length: 10 }).notNull(),
});

// Drizzle insert schemas
export const insertBitcoinOrderSchemaDB = createInsertSchema(bitcoinOrders).omit({ id: true });
export const insertWhaleMovementSchemaDB = createInsertSchema(whaleMovements).omit({ id: true });
export const insertLongShortRatioSchemaDB = createInsertSchema(longShortRatios).omit({ id: true });
export const insertWhaleCorrelationSchemaDB = createInsertSchema(whaleCorrelations).omit({ id: true });
