                         import { drizzle } from 'drizzle-orm/postgres-js';
                         import postgres from 'postgres';
                         import { eq, and, gte, lt, desc, sql } from 'drizzle-orm';
                         import { randomUUID } from 'crypto';
                         import {
                           bitcoinOrders,
                           whaleMovements,
                           longShortRatios,
                           whaleCorrelations,
                           type BitcoinOrder,
                           type InsertBitcoinOrder,
                           type WhaleMovement,
                           type LongShortRatio,
                           type WhaleCorrelation,
                           type Exchange,
                         } from '@shared/schema';
                         import type { IStorage, OrderFilters } from './storage';

                         // Create postgres client connection with SSL for Render PostgreSQL
                         const client = postgres(process.env.DATABASE_URL!, {
                           ssl: 'require', // Render PostgreSQL requires SSL/TLS connections
                         });
                         const db = drizzle(client);

                         export class DatabaseStorage implements IStorage {
                           // Bitcoin orders
                           async getOrders(): Promise<BitcoinOrder[]> {
                             const orders = await db
                               .select()
                               .from(bitcoinOrders)
                               .orderBy(desc(bitcoinOrders.timestamp));

                             return orders.map(this.mapOrderFromDB);
                           }

                           async getFilteredOrders(filters: OrderFilters): Promise<BitcoinOrder[]> {
                             const conditions = [];

                             // Build WHERE conditions
                             if (filters.minSize && filters.minSize > 0) {
                               conditions.push(gte(bitcoinOrders.size, filters.minSize));
                             }

                             if (filters.orderType && filters.orderType !== 'all') {
                               conditions.push(eq(bitcoinOrders.type, filters.orderType));
                             }

                             if (filters.exchange && filters.exchange !== 'all') {
                               conditions.push(eq(bitcoinOrders.exchange, filters.exchange));
                             }

                             if (filters.status && filters.status !== 'all') {
                               conditions.push(eq(bitcoinOrders.status, filters.status));
                             }

                             if (filters.minPrice !== undefined) {
                               conditions.push(gte(bitcoinOrders.price, filters.minPrice));
                             }

                             if (filters.maxPrice !== undefined) {
                               conditions.push(sql`${bitcoinOrders.price} <= ${filters.maxPrice}`);
                             }

                             if (filters.timeRange) {
                               const now = new Date();
                               const timeRanges: Record<string, number> = {
                                 '30m': 30 * 60 * 1000,
                                 '1h': 60 * 60 * 1000,
                                 '4h': 4 * 60 * 60 * 1000,
                                 '24h': 24 * 60 * 60 * 1000,
                                 '7d': 7 * 24 * 60 * 60 * 1000,
                               };

                               const rangeMs = timeRanges[filters.timeRange];
                               if (rangeMs) {
                                 const cutoffTime = new Date(now.getTime() - rangeMs);
                                 conditions.push(gte(bitcoinOrders.timestamp, cutoffTime));
                               }
                             }

                             const query = db
                               .select()
                               .from(bitcoinOrders)
                               .orderBy(desc(bitcoinOrders.timestamp));

                             const orders = conditions.length > 0
                               ? await query.where(and(...conditions))
                               : await query;

                             return orders.map(this.mapOrderFromDB);
                           }

                           async createOrder(order: InsertBitcoinOrder): Promise<BitcoinOrder> {
                             const id = randomUUID();

                             const [newOrder] = await db
                               .insert(bitcoinOrders)
                               .values({
                                 id,
                                 type: order.type,
                                 size: order.size,
                                 price: order.price,
                                 exchange: order.exchange,
                                 timestamp: new Date(order.timestamp),
                                 status: order.status || 'active',
                                 filledAt: order.filledAt ? new Date(order.filledAt) : null,
                                 fillPrice: order.fillPrice || null,
                               })
                               .returning();

                             return this.mapOrderFromDB(newOrder);
                           }

                           async getOrder(id: string): Promise<BitcoinOrder | undefined> {
                             const [order] = await db
                               .select()
                               .from(bitcoinOrders)
                               .where(eq(bitcoinOrders.id, id));

                             return order ? this.mapOrderFromDB(order) : undefined;
                           }

                           async updateOrderStatus(
                             id: string,
                             status: 'active' | 'filled',
                             fillPrice?: number
                           ): Promise<BitcoinOrder | undefined> {
                             const updateData: any = {
                               status,
                             };

                             if (status === 'filled') {
                               updateData.filledAt = new Date();
                               updateData.fillPrice = fillPrice || null;
                             }

                             const [updatedOrder] = await db
                               .update(bitcoinOrders)
                               .set(updateData)
                               .where(eq(bitcoinOrders.id, id))
                               .returning();

                             return updatedOrder ? this.mapOrderFromDB(updatedOrder) : undefined;
                           }

                           async deleteOrder(id: string): Promise<BitcoinOrder | undefined> {
                             const [deletedOrder] = await db
                               .delete(bitcoinOrders)
                               .where(eq(bitcoinOrders.id, id))
                               .returning();

                             return deletedOrder ? this.mapOrderFromDB(deletedOrder) : undefined;
                           }

                           async getOpenOrders(): Promise<BitcoinOrder[]> {
                             const orders = await db
                               .select()
                               .from(bitcoinOrders)
                               .where(eq(bitcoinOrders.status, 'active'))
                               .orderBy(desc(bitcoinOrders.timestamp));

                             return orders.map(this.mapOrderFromDB);
                           }

                           async getActiveOrdersByExchange(
                             exchange: Exclude<Exchange, 'all'>
                           ): Promise<BitcoinOrder[]> {
                             const orders = await db
                               .select()
                               .from(bitcoinOrders)
                               .where(
                                 and(
                                   eq(bitcoinOrders.status, 'active'),
                                   eq(bitcoinOrders.exchange, exchange)
                                 )
                               );

                             return orders.map(this.mapOrderFromDB);
                           }

                           async clearOldOrders(hoursAgo: number): Promise<string[]> {
                             const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

                             const deletedOrders = await db
                               .delete(bitcoinOrders)
                               .where(lt(bitcoinOrders.timestamp, cutoffTime))
                               .returning({ id: bitcoinOrders.id });

                             return deletedOrders.map(o => o.id);
                           }

                           // Whale movements
                           async addWhaleMovement(
                             movement: Omit<WhaleMovement, 'id'>
                           ): Promise<WhaleMovement> {
                             const id = randomUUID();

                             const [newMovement] = await db
                               .insert(whaleMovements)
                               .values({
                                 id,
                                 amount: movement.amount,
                                 amountUSD: movement.amountUSD,
                                 from: movement.from,
                                 to: movement.to,
                                 hash: movement.hash,
                                 timestamp: new Date(movement.timestamp),
                                 isToExchange: movement.isToExchange,
                                 isFromExchange: movement.isFromExchange,
                               })
                               .returning();

                             return this.mapWhaleMovementFromDB(newMovement);
                           }

                           async getWhaleMovements(hoursAgo: number = 24): Promise<WhaleMovement[]> {
                             const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

                             const movements = await db
                               .select()
                               .from(whaleMovements)
                               .where(gte(whaleMovements.timestamp, cutoffTime))
                               .orderBy(desc(whaleMovements.timestamp));

                             return movements.map(this.mapWhaleMovementFromDB);
                           }

                           // Long/Short ratios
                           async addLongShortRatio(
                             ratio: Omit<LongShortRatio, 'id'>
                           ): Promise<LongShortRatio> {
                             const id = randomUUID();

                             const [newRatio] = await db
                               .insert(longShortRatios)
                               .values({
                                 id,
                                 timestamp: new Date(ratio.timestamp),
                                 symbol: ratio.symbol,
                                 longShortRatio: ratio.longShortRatio,
                                 longAccount: ratio.longAccount,
                                 shortAccount: ratio.shortAccount,
                                 period: ratio.period,
                                 isTopTrader: ratio.isTopTrader,
                               })
                               .returning();

                             return this.mapLongShortRatioFromDB(newRatio);
                           }

                           async getLongShortRatios(
                             period?: string,
                             limit: number = 100
                           ): Promise<LongShortRatio[]> {
                             let query = db
                               .select()
                               .from(longShortRatios)
                               .orderBy(desc(longShortRatios.timestamp))
                               .limit(limit);

                             if (period) {
                               query = query.where(eq(longShortRatios.period, period)) as any;
                             }

                             const ratios = await query;
                             return ratios.map(this.mapLongShortRatioFromDB);
                           }

                           async getLatestLongShortRatio(
                             isTopTrader: boolean = false
                           ): Promise<LongShortRatio | undefined> {
                             const [ratio] = await db
                               .select()
                               .from(longShortRatios)
                               .where(eq(longShortRatios.isTopTrader, isTopTrader))
                               .orderBy(desc(longShortRatios.timestamp))
                               .limit(1);

                             return ratio ? this.mapLongShortRatioFromDB(ratio) : undefined;
                           }

                           // Whale correlations
                           async addWhaleCorrelation(
                             correlation: Omit<WhaleCorrelation, 'id'>
                           ): Promise<WhaleCorrelation> {
                             const id = randomUUID();

                             const [newCorrelation] = await db
                               .insert(whaleCorrelations)
                               .values({
                                 id,
                                 whaleMovementId: correlation.whaleMovementId,
                                 timestamp: new Date(correlation.timestamp),
                                 btcAmount: correlation.btcAmount,
                                 initialLongShortRatio: correlation.initialLongShortRatio,
                                 currentLongShortRatio: correlation.currentLongShortRatio,
                                 ratioChange: correlation.ratioChange,
                                 shortSpike: correlation.shortSpike,
                                 likelyAction: correlation.likelyAction,
                                 confidence: correlation.confidence,
                               })
                               .returning();

                             return this.mapWhaleCorrelationFromDB(newCorrelation);
                           }

                           async getWhaleCorrelations(
                             hoursAgo: number = 24
                           ): Promise<WhaleCorrelation[]> {
                             const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

                             const correlations = await db
                               .select()
                               .from(whaleCorrelations)
                               .where(gte(whaleCorrelations.timestamp, cutoffTime))
                               .orderBy(desc(whaleCorrelations.timestamp));

                             return correlations.map(this.mapWhaleCorrelationFromDB);
                           }

                           // Helper methods to map database rows to app types
                           private mapOrderFromDB(dbOrder: any): BitcoinOrder {
                             return {
                               id: dbOrder.id,
                               type: dbOrder.type as 'long' | 'short',
                               size: dbOrder.size,
                               price: dbOrder.price,
                               exchange: dbOrder.exchange as 'binance' | 'kraken' | 'coinbase' | 'okx',
                               timestamp: dbOrder.timestamp.toISOString(),
                               status: dbOrder.status as 'active' | 'filled',
                               filledAt: dbOrder.filledAt?.toISOString(),
                               fillPrice: dbOrder.fillPrice || undefined,
                             };
                           }

                           private mapWhaleMovementFromDB(dbMovement: any): WhaleMovement {
                             return {
                               id: dbMovement.id,
                               amount: dbMovement.amount,
                               amountUSD: dbMovement.amountUSD,
                               from: dbMovement.from,
                               to: dbMovement.to,
                               hash: dbMovement.hash,
                               timestamp: dbMovement.timestamp.toISOString(),
                               isToExchange: dbMovement.isToExchange,
                               isFromExchange: dbMovement.isFromExchange,
                             };
                           }

                           private mapLongShortRatioFromDB(dbRatio: any): LongShortRatio {
                             return {
                               id: dbRatio.id,
                               timestamp: dbRatio.timestamp.toISOString(),
                               symbol: dbRatio.symbol,
                               longShortRatio: dbRatio.longShortRatio,
                               longAccount: dbRatio.longAccount,
                               shortAccount: dbRatio.shortAccount,
                               period: dbRatio.period as '5m' | '15m' | '30m' | '1h' | '2h' | '4h',
                               isTopTrader: dbRatio.isTopTrader,
                             };
                           }

                           private mapWhaleCorrelationFromDB(dbCorrelation: any): WhaleCorrelation {
                             return {
                               id: dbCorrelation.id,
                               whaleMovementId: dbCorrelation.whaleMovementId,
                               timestamp: dbCorrelation.timestamp.toISOString(),
                               btcAmount: dbCorrelation.btcAmount,
                               initialLongShortRatio: dbCorrelation.initialLongShortRatio,
                               currentLongShortRatio: dbCorrelation.currentLongShortRatio,
                               ratioChange: dbCorrelation.ratioChange,
                               shortSpike: dbCorrelation.shortSpike,
                               likelyAction: dbCorrelation.likelyAction as 'shorting' | 'longing' | 'neutral',
                               confidence: dbCorrelation.confidence as 'low' | 'medium' | 'high',
                             };
                           }
                         }

                         export const storage = new DatabaseStorage();