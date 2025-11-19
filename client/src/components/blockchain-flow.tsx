import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ArrowDownToLine, ArrowUpFromLine, Activity } from "lucide-react";

interface BlockchainTransaction {
  hash: string;
  timestamp: number;
  amountBTC: number;
  amountUSD: number;
  fromAddress: string;
  toAddress: string;
  fromExchange: string | null;
  toExchange: string | null;
  signal: 'deposit' | 'withdrawal' | 'transfer';
  sentiment: 'bearish' | 'bullish' | 'neutral';
}

interface ExchangeFlowStats {
  totalDeposits: number;
  totalWithdrawals: number;
  netFlow: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  depositsByExchange: Record<string, number>;
  withdrawalsByExchange: Record<string, number>;
}

interface BlockchainResponse {
  transactions: BlockchainTransaction[];
  flowStats: ExchangeFlowStats;
  btcPrice: number;
  lastUpdated: string;
}

export function BlockchainFlow() {
  const { data, isLoading } = useQuery<BlockchainResponse>({
    queryKey: ['/api/blockchain-transactions'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !data) {
    return (
      <Card data-testid="card-blockchain-flow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Blockchain Whale Flow
          </CardTitle>
          <CardDescription>
            Live BTC movements to/from exchanges (100+ BTC). Independent of filters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading blockchain data...</div>
        </CardContent>
      </Card>
    );
  }

  const { transactions, flowStats } = data;
  const recentTransactions = transactions.slice(0, 10); // Show top 10

  // Calculate sentiment color
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'text-green-500 dark:text-green-400';
      case 'bearish': return 'text-red-500 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getSentimentBadgeVariant = (sentiment: string): 'default' | 'destructive' | 'secondary' => {
    switch (sentiment) {
      case 'bullish': return 'default';
      case 'bearish': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatBTC = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const shortenHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <Card data-testid="card-blockchain-flow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Blockchain Whale Flow
        </CardTitle>
        <CardDescription>
          Live BTC movements to/from exchanges (100+ BTC). Independent of filters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Exchange Flow Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Total Deposits</div>
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4 text-red-500" />
              <div className="font-mono font-semibold text-sm">
                {formatBTC(flowStats.totalDeposits)} BTC
              </div>
            </div>
            <div className="text-xs text-red-500">🔴 Bearish</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Total Withdrawals</div>
            <div className="flex items-center gap-2">
              <ArrowUpFromLine className="w-4 h-4 text-green-500" />
              <div className="font-mono font-semibold text-sm">
                {formatBTC(flowStats.totalWithdrawals)} BTC
              </div>
            </div>
            <div className="text-xs text-green-500">🟢 Bullish</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Net Flow</div>
            <div className={`font-mono font-semibold text-sm ${getSentimentColor(flowStats.sentiment)}`}>
              {flowStats.netFlow > 0 ? '+' : ''}{formatBTC(flowStats.netFlow)} BTC
            </div>
            <Badge 
              variant={getSentimentBadgeVariant(flowStats.sentiment)}
              className="text-xs"
              data-testid={`badge-sentiment-${flowStats.sentiment}`}
            >
              {flowStats.sentiment.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Recent Whale Movements</div>
          
          {recentTransactions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No whale transactions detected in mempool
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentTransactions.map((tx) => (
                <div 
                  key={tx.hash}
                  className="border rounded-md p-3 hover-elevate"
                  data-testid={`tx-${tx.hash.slice(0, 8)}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      {tx.signal === 'deposit' && (
                        <>
                          <ArrowDownToLine className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="font-medium">Deposit to {tx.toExchange?.toUpperCase()}</span>
                            <Badge variant="destructive" className="ml-2 text-xs">Bearish</Badge>
                          </div>
                        </>
                      )}
                      {tx.signal === 'withdrawal' && (
                        <>
                          <ArrowUpFromLine className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="font-medium">Withdrawal from {tx.fromExchange?.toUpperCase()}</span>
                            <Badge variant="default" className="ml-2 text-xs">Bullish</Badge>
                          </div>
                        </>
                      )}
                      {tx.signal === 'transfer' && (
                        <>
                          <Activity className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="text-sm">
                            <span className="font-medium">Wallet Transfer</span>
                            <Badge variant="secondary" className="ml-2 text-xs">Neutral</Badge>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Amount:</div>
                      <div className="font-mono text-sm font-semibold" data-testid={`tx-amount-${tx.hash.slice(0, 8)}`}>
                        {formatBTC(tx.amountBTC)} BTC
                        <span className="text-xs text-muted-foreground ml-2">
                          ({formatUSD(tx.amountUSD)})
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Hash:</div>
                      <a 
                        href={`https://blockchain.com/btc/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-500 hover:underline"
                        data-testid={`link-explorer-${tx.hash.slice(0, 8)}`}
                      >
                        {shortenHash(tx.hash)}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          Data from blockchain mempool • Updates every 30s • Independent of dashboard filters
        </div>
      </CardContent>
    </Card>
  );
}
