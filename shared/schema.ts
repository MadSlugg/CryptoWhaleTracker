import { z } from "zod";

export const bitcoinOrderSchema = z.object({
  id: z.string(),
  type: z.enum(['long', 'short']),
  size: z.number().positive(),
  price: z.number().positive(),
  leverage: z.number().min(1).max(100),
  timestamp: z.string(),
  liquidationPrice: z.number().positive().optional(),
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
export type LeverageRiskLevel = 'minimal' | 'moderate' | 'high' | 'extreme';
export type PositionStatus = 'open' | 'closed' | 'all';

export function getLeverageRiskLevel(leverage: number): LeverageRiskLevel {
  if (leverage < 5) return 'minimal';
  if (leverage < 10) return 'moderate';
  if (leverage < 25) return 'high';
  return 'extreme';
}

export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  type: 'long' | 'short'
): number {
  // Maintenance margin rate (typically 0.5-1% for crypto exchanges)
  const maintenanceMarginRate = 0.005;
  
  // Small epsilon to ensure liquidation is always meaningfully away from entry price
  const epsilon = 0.001; // 0.1% minimum distance
  
  // Calculate base price movement from leverage and maintenance margin
  // Formula: priceMovement = (1/leverage) - maintenanceMargin
  const basePriceMovement = (1 / leverage) - maintenanceMarginRate;
  
  // Ensure price movement is at least epsilon to guarantee meaningful liquidation distance
  // This handles extreme leverage cases where basePriceMovement might be very small or negative
  const effectivePriceMovement = Math.max(basePriceMovement, epsilon);
  
  let liquidationPrice: number;
  if (type === 'long') {
    // For longs, liquidation happens when price drops
    liquidationPrice = entryPrice * (1 - effectivePriceMovement);
  } else {
    // For shorts, liquidation happens when price rises
    liquidationPrice = entryPrice * (1 + effectivePriceMovement);
  }
  
  // Ensure liquidation price is never negative
  return Math.max(0, liquidationPrice);
}

export function calculateProfitLoss(
  entryPrice: number,
  exitPrice: number,
  leverage: number,
  type: 'long' | 'short'
): number {
  const priceChange = ((exitPrice - entryPrice) / entryPrice) * 100;
  
  if (type === 'long') {
    // For longs, profit when price goes up
    return priceChange * leverage;
  } else {
    // For shorts, profit when price goes down
    return -priceChange * leverage;
  }
}
