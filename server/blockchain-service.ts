// Blockchain whale transaction monitoring service
// Tracks large BTC movements to/from exchanges

/**
 * EXCHANGE WALLET ADDRESSES DATABASE
 * 
 * These addresses are known exchange cold/hot wallets tracked by the crypto community.
 * 
 * ⚠️ IMPORTANT: Exchange addresses change frequently as exchanges rotate wallets for security.
 * 
 * UPDATE SOURCES (Check monthly for updates):
 * 1. Whale Alert Database: https://whale-alert.io/
 * 2. BitInfoCharts Exchange Wallets: https://bitinfocharts.com/top-100-richest-bitcoin-addresses.html
 * 3. Glassnode Exchange Addresses: https://studio.glassnode.com/
 * 4. Community tracking: https://github.com/blockchain/exchange-addresses (if available)
 * 5. CryptoQuant Exchange Flow: https://cryptoquant.com/
 * 
 * HOW TO UPDATE:
 * 1. Check the sources above for new/changed exchange addresses
 * 2. Add new addresses to the appropriate exchange array
 * 3. Remove old addresses that are no longer active
 * 4. Restart the application
 * 
 * VERIFICATION:
 * - Cross-reference addresses across multiple sources
 * - Verify with blockchain explorer (https://blockchain.com) for high transaction volume
 * - Check if address appears in exchange's proof-of-reserves
 * 
 * Last Updated: January 2025
 */
const EXCHANGE_ADDRESSES = {
  binance: [
    "bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h", // Cold wallet
    "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", // Hot wallet
    "3LCGsSmfr24demGvriN4e3ft8wEcDuHFqh", // Hot wallet
    "bc1qr4dl5wa7kl8yu792dceg9z5knl2gkn220lk7a9", // Cold wallet
    "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s" // Legacy wallet
  ],
  coinbase: [
    "3D2oetdNuZUqQHPJmcMDDHYoqkyNVsFk9r", // Cold storage
    "3LYJfcfHPXYJreMsASk2jkn69LWEYKzexb", // Cold storage
    "36n452uGq1x4mK7bfyZR8wgE47AnBb2pzi", // Hot wallet
    "3Cbq7aT1tY8kMxWLbitaG7yT6bPbKChq64" // Hot wallet
  ],
  kraken: [
    "3FupZp77ySr7jwoLYEJ9mwzJpvoNBXmWi3", // Main cold wallet
    "35ULMyVnFoYaPaMxwHTRmaGdABpAThM4QR", // Cold wallet
    "3ML7Drqxg8gmXS4Qnbh3f9kKmPU7GbNrDX" // Hot wallet
  ],
  bitfinex: [
    "3D8ZWMjcUgG8KkNvmEVZV1FJCGxSjDRnLb", // Cold storage
    "1Kr6QSydW9bFQG1mXiPNNu6WpJGmUa9i1g" // Hot wallet
  ],
  huobi: [
    "3JZq4atUahhuA9rLhXLMhhTo133J9rF97j", // Cold wallet
    "38UmuUqPCrFmQo4khkomQwZ4VbY2nZMJ67" // Hot wallet
  ],
  okex: [
    "1J1F3U7gHrCjsEsRimDJ3oYBiV24wA8FuV", // Cold wallet
    "3MbYQMMmSkC3AgWkj9FMo5LsPTW1zBTwXL" // Hot wallet
  ],
  bitstamp: [
    "3E8ociqZa9mZUSwGdSmAEMAoAxBK3FNDcd", // Cold storage
    "3BMEX8A3vX4E5gBxFVqC1phPJaXkTmKjmQ" // Hot wallet
  ]
};

// Create reverse lookup map for O(1) searching
const addressToExchange = new Map<string, string>();
Object.entries(EXCHANGE_ADDRESSES).forEach(([exchange, addresses]) => {
  addresses.forEach(addr => {
    addressToExchange.set(addr, exchange);
  });
});

export interface BlockchainTransaction {
  hash: string;
  timestamp: number; // Unix timestamp in milliseconds
  amountBTC: number;
  amountUSD: number;
  fromAddress: string;
  toAddress: string;
  fromExchange: string | null;
  toExchange: string | null;
  signal: 'deposit' | 'withdrawal' | 'transfer'; // deposit=bearish, withdrawal=bullish, transfer=neutral
  sentiment: 'bearish' | 'bullish' | 'neutral';
}

export interface ExchangeFlowStats {
  totalDeposits: number; // Total BTC deposited to exchanges (bearish)
  totalWithdrawals: number; // Total BTC withdrawn from exchanges (bullish)
  netFlow: number; // Positive = net withdrawal (bullish), Negative = net deposit (bearish)
  sentiment: 'bullish' | 'bearish' | 'neutral';
  depositsByExchange: Record<string, number>;
  withdrawalsByExchange: Record<string, number>;
}

class BlockchainService {
  private readonly API_BASE = 'https://blockchain.info';
  
  /**
   * Check if an address belongs to a known exchange
   */
  private checkExchangeAddress(address: string): { isExchange: boolean; exchange: string | null } {
    const exchange = addressToExchange.get(address);
    return {
      isExchange: !!exchange,
      exchange: exchange || null
    };
  }

  /**
   * Fetch recent unconfirmed whale transactions (100+ BTC)
   * These are transactions that haven't been confirmed yet but are in the mempool
   */
  async fetchUnconfirmedWhaleTransactions(minBTC: number = 100, btcPrice: number = 93000): Promise<BlockchainTransaction[]> {
    try {
      const response = await fetch(`${this.API_BASE}/unconfirmed-transactions?format=json`);
      
      if (!response.ok) {
        throw new Error(`Blockchain API error: ${response.status}`);
      }

      const data = await response.json();
      const minSatoshis = minBTC * 100000000; // Convert BTC to satoshis
      
      const whaleTransactions: BlockchainTransaction[] = [];

      for (const tx of data.txs) {
        // Calculate total output in satoshis
        const totalOutput = tx.out.reduce((sum: number, output: any) => sum + output.value, 0);
        
        // Filter for whale-sized transactions
        if (totalOutput >= minSatoshis) {
          const amountBTC = totalOutput / 100000000;
          const amountUSD = amountBTC * btcPrice;
          
          // Get addresses
          const fromAddress = tx.inputs[0]?.prev_out?.addr || 'Unknown';
          const toAddress = tx.out[0]?.addr || 'Unknown';
          
          // Check if addresses belong to exchanges
          const fromCheck = this.checkExchangeAddress(fromAddress);
          const toCheck = this.checkExchangeAddress(toAddress);
          
          // Determine signal type
          let signal: 'deposit' | 'withdrawal' | 'transfer' = 'transfer';
          let sentiment: 'bearish' | 'bullish' | 'neutral' = 'neutral';
          
          if (toCheck.isExchange && !fromCheck.isExchange) {
            signal = 'deposit';
            sentiment = 'bearish'; // Deposit to exchange = potential sell pressure
          } else if (fromCheck.isExchange && !toCheck.isExchange) {
            signal = 'withdrawal';
            sentiment = 'bullish'; // Withdrawal from exchange = accumulation/holding
          }
          
          whaleTransactions.push({
            hash: tx.hash,
            timestamp: tx.time * 1000, // Convert to milliseconds
            amountBTC,
            amountUSD,
            fromAddress,
            toAddress,
            fromExchange: fromCheck.exchange,
            toExchange: toCheck.exchange,
            signal,
            sentiment
          });
        }
      }
      
      // Sort by timestamp descending (most recent first)
      return whaleTransactions.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error fetching blockchain whale transactions:', error);
      return [];
    }
  }

  /**
   * Calculate exchange flow statistics from transactions
   */
  calculateExchangeFlow(transactions: BlockchainTransaction[]): ExchangeFlowStats {
    const stats: ExchangeFlowStats = {
      totalDeposits: 0,
      totalWithdrawals: 0,
      netFlow: 0,
      sentiment: 'neutral',
      depositsByExchange: {},
      withdrawalsByExchange: {}
    };

    for (const tx of transactions) {
      if (tx.signal === 'deposit' && tx.toExchange) {
        stats.totalDeposits += tx.amountBTC;
        stats.depositsByExchange[tx.toExchange] = 
          (stats.depositsByExchange[tx.toExchange] || 0) + tx.amountBTC;
      } else if (tx.signal === 'withdrawal' && tx.fromExchange) {
        stats.totalWithdrawals += tx.amountBTC;
        stats.withdrawalsByExchange[tx.fromExchange] = 
          (stats.withdrawalsByExchange[tx.fromExchange] || 0) + tx.amountBTC;
      }
    }

    // Calculate net flow: positive = more withdrawals (bullish), negative = more deposits (bearish)
    stats.netFlow = stats.totalWithdrawals - stats.totalDeposits;

    // Determine sentiment based on net flow
    if (stats.netFlow > 100) {
      stats.sentiment = 'bullish'; // Significant net withdrawal
    } else if (stats.netFlow < -100) {
      stats.sentiment = 'bearish'; // Significant net deposit
    } else {
      stats.sentiment = 'neutral';
    }

    return stats;
  }
}

export const blockchainService = new BlockchainService();
