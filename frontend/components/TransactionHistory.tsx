'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { useWallet } from './WalletConnect';

// Transaction types
export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: bigint;
  shares: bigint;
  timestamp: number;
  txHash: string;
  status: 'pending' | 'completed' | 'failed';
}

// Filter options
type FilterPeriod = '7d' | '30d' | 'all';

// BSCScan base URLs
const BSCSCAN_TX_URL = {
  56: 'https://bscscan.com/tx/',
  97: 'https://testnet.bscscan.com/tx/',
};

interface TransactionHistoryProps {
  className?: string;
}

export function TransactionHistory({ className = '' }: TransactionHistoryProps) {
  const { address, isConnected, isOnSupportedNetwork } = useWallet();
  const chainId = useChainId();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');

  // Get BSCScan URL for current chain
  const getBscscanUrl = (txHash: string) => {
    const baseUrl = BSCSCAN_TX_URL[chainId as keyof typeof BSCSCAN_TX_URL] || BSCSCAN_TX_URL[97];
    return `${baseUrl}${txHash}`;
  };

  // Fetch transactions from API
  const fetchTransactions = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      // In real app, this would be an API call
      // For now, we'll use mock data or actual API endpoint
      const response = await fetch(`/api/transactions/${address}`);

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();

      // Convert amount strings to BigInt
      const txs: Transaction[] = data.transactions.map((tx: {
        id: string;
        type: 'deposit' | 'withdraw';
        amount: bigint | string;
        shares: bigint | string;
        timestamp: number;
        txHash: string;
        status: 'pending' | 'completed' | 'failed';
      }) => ({
        ...tx,
        amount: typeof tx.amount === 'string' ? BigInt(tx.amount) : tx.amount,
        shares: typeof tx.shares === 'string' ? BigInt(tx.shares) : tx.shares,
      }));

      setTransactions(txs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading transactions');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Fetch on mount and when address changes
  useEffect(() => {
    if (isConnected && address) {
      fetchTransactions();
    }
  }, [isConnected, address, fetchTransactions]);

  // Filter transactions by period
  const filteredTransactions = useMemo(() => {
    if (filterPeriod === 'all') return transactions;

    const now = Date.now();
    const days = filterPeriod === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    return transactions.filter((tx) => tx.timestamp >= cutoff);
  }, [transactions, filterPeriod]);

  // Format values
  const formatAmount = (amount: bigint, decimals: number = 18) => {
    const formatted = parseFloat(formatUnits(amount, decimals));
    return formatted.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Amount (USDT)', 'Shares (PNGY)', 'Status', 'Transaction Hash'];

    const rows = filteredTransactions.map((tx) => [
      formatDate(tx.timestamp),
      tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
      formatAmount(tx.amount),
      formatAmount(tx.shares),
      tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
      tx.txHash,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Transaction History</h2>
        <p className="text-gray-500 text-center py-12">
          Connect your wallet to view transaction history
        </p>
      </div>
    );
  }

  // Wrong network
  if (!isOnSupportedNetwork) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Transaction History</h2>
        <p className="text-amber-600 text-center py-12">
          Please switch to BSC network to view transaction history
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Transaction History</h2>
        <div data-testid="loading-state" className="space-y-4">
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Transaction History</h2>
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">Error loading transactions. Please try again.</p>
          <button
            onClick={fetchTransactions}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold">Transaction History</h2>

        <div className="flex items-center gap-3">
          {/* Filter Buttons */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <FilterButton
              active={filterPeriod === '7d'}
              onClick={() => setFilterPeriod('7d')}
            >
              7 Days
            </FilterButton>
            <FilterButton
              active={filterPeriod === '30d'}
              onClick={() => setFilterPeriod('30d')}
            >
              30 Days
            </FilterButton>
            <FilterButton
              active={filterPeriod === 'all'}
              onClick={() => setFilterPeriod('all')}
            >
              All
            </FilterButton>
          </div>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg transition-colors"
          >
            <DownloadIcon className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <EmptyIcon className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">No transactions found for this period</p>
        </div>
      ) : (
        /* Transaction Table */
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Type</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600">Amount</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-600">Status</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <span className="text-gray-900">{formatDate(tx.timestamp)}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <TypeIcon type={tx.type} />
                      <span className={tx.type === 'deposit' ? 'text-green-600' : 'text-orange-600'}>
                        {tx.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div>
                      <span className="font-medium">{formatAmount(tx.amount)} USDT</span>
                      <p className="text-sm text-gray-500">{formatAmount(tx.shares)} PNGY</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="py-4 px-4 text-right">
                    <a
                      href={getBscscanUrl(tx.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-500 hover:text-sky-600 font-mono text-sm"
                    >
                      {truncateHash(tx.txHash)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-gray-500 mt-4 text-center">
        Click on a transaction hash to view details on BSCScan
      </p>
    </div>
  );
}

// Filter Button Component
interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterButton({ active, onClick, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-sky-500 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: Transaction['status'] }) {
  const styles = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
  };

  const labels = {
    completed: 'Completed',
    pending: 'Pending',
    failed: 'Failed',
  };

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// Type Icon Component
function TypeIcon({ type }: { type: Transaction['type'] }) {
  if (type === 'deposit') {
    return (
      <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4" />
        </svg>
      </span>
    );
  }

  return (
    <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
      <svg className="w-3 h-3 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 16l4-4m-4 4l-4-4" />
      </svg>
    </span>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-4 p-4">
      <div className="h-10 w-32 bg-gray-200 rounded"></div>
      <div className="h-10 w-20 bg-gray-200 rounded"></div>
      <div className="h-10 w-24 bg-gray-200 rounded flex-1"></div>
      <div className="h-10 w-20 bg-gray-200 rounded"></div>
      <div className="h-10 w-28 bg-gray-200 rounded"></div>
    </div>
  );
}

// Icons
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function EmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export default TransactionHistory;
