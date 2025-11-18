import WebSocket from 'ws';
import { storage } from './storage';
import { binanceService } from './binance';
import type { LiquidationOrder } from './binance';

const BINANCE_LIQUIDATION_STREAM = 'wss://fstream.binance.com/ws/!forceOrder@arr';

export class LiquidationService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  
  start() {
    this.connect();
  }
  
  private connect() {
    try {
      console.log('[Liquidation] Connecting to Binance liquidation WebSocket...');
      
      this.ws = new WebSocket(BINANCE_LIQUIDATION_STREAM);
      
      this.ws.on('open', () => {
        console.log('[Liquidation] Connected to Binance liquidation stream');
        this.isConnected = true;
      });
      
      this.ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          // WebSocket sends liquidation orders in this format
          if (message.e === 'forceOrder') {
            await this.handleLiquidation(message.o);
          }
        } catch (error) {
          console.error('[Liquidation] Error processing message:', error);
        }
      });
      
      this.ws.on('error', (error) => {
        console.error('[Liquidation] WebSocket error:', error);
      });
      
      this.ws.on('close', () => {
        console.log('[Liquidation] WebSocket closed, will reconnect...');
        this.isConnected = false;
        
        // Reconnect after 5 seconds
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
        }
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, 5000);
      });
    } catch (error) {
      console.error('[Liquidation] Connection error:', error);
      
      // Retry connection after 5 seconds
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, 5000);
    }
  }
  
  private async handleLiquidation(liquidationOrder: LiquidationOrder) {
    try {
      // Only track BTC liquidations
      if (liquidationOrder.symbol !== 'BTCUSDT') {
        return;
      }
      
      const price = parseFloat(liquidationOrder.price);
      const quantity = parseFloat(liquidationOrder.quantity);
      const currentBtcPrice = await binanceService.getCurrentPrice();
      const totalUSD = price * quantity;
      
      // Only track significant liquidations ($100k+)
      if (totalUSD < 100000) {
        return;
      }
      
      await storage.addLiquidation({
        symbol: liquidationOrder.symbol,
        side: liquidationOrder.side,
        price,
        quantity,
        timestamp: new Date(liquidationOrder.tradeTime).toISOString(),
        totalUSD,
      });
      
      console.log(
        `[Liquidation] ${liquidationOrder.side} ${quantity.toFixed(2)} BTC at $${price.toLocaleString()} (${totalUSD.toLocaleString()} USD)`
      );
    } catch (error) {
      console.error('[Liquidation] Error handling liquidation:', error);
    }
  }
  
  stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isConnected = false;
  }
}

export const liquidationService = new LiquidationService();
