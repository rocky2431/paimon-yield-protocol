'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { contracts } from '@/lib/wagmi/config';
import { PNGY_VAULT_ABI } from '@/lib/contracts/abis';
import { useWallet } from './WalletConnect';
import { useVaultStore } from '@/lib/store/useVaultStore';

// Refresh interval (5 minutes)
const REFRESH_INTERVAL = 5 * 60 * 1000;

// Mock APY for demonstration (in real app, this would come from backend/contract)
const MOCK_APY = 5.26;

interface DashboardProps {
  className?: string;
}

export function Dashboard({ className = '' }: DashboardProps) {
  const { address, isConnected, isOnSupportedNetwork } = useWallet();
  const chainId = useChainId();
  const { setDashboardData, setLastUpdated, setVaultInfo } = useVaultStore();

  const [lastUpdated, setLocalLastUpdated] = useState<Date>(new Date());

  // Get contract addresses for current chain
  const getContractAddresses = () => {
    if (!chainId) return null;
    const contractsForChain = contracts[chainId as keyof typeof contracts];
    return contractsForChain || null;
  };
  const contractAddresses = getContractAddresses();
  const vaultAddress = contractAddresses?.pngyVault;

  // Read total assets
  const {
    data: totalAssets,
    isLoading: isTotalAssetsLoading,
    refetch: refetchTotalAssets,
    error: totalAssetsError,
  } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_ABI,
    functionName: 'totalAssets',
    query: {
      enabled: !!vaultAddress,
    },
  });

  // Read total supply (shares)
  const {
    data: totalSupply,
    isLoading: isTotalSupplyLoading,
    refetch: refetchTotalSupply,
    error: totalSupplyError,
  } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_ABI,
    functionName: 'totalSupply',
    query: {
      enabled: !!vaultAddress,
    },
  });

  // Read user's PNGY balance
  const {
    data: pngyBalance,
    isLoading: isPngyBalanceLoading,
    refetch: refetchPngyBalance,
    error: pngyBalanceError,
  } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!vaultAddress && !!address,
    },
  });

  // Convert user's PNGY to USDT value
  const {
    data: userAssetValue,
    isLoading: isAssetValueLoading,
    refetch: refetchAssetValue,
    error: assetValueError,
  } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_ABI,
    functionName: 'convertToAssets',
    args: pngyBalance ? [pngyBalance] : undefined,
    query: {
      enabled: !!vaultAddress && !!pngyBalance && pngyBalance > 0n,
    },
  });

  // Calculate net value (share price)
  const netValue = totalAssets && totalSupply && totalSupply > 0n
    ? (totalAssets * BigInt(1e18)) / totalSupply
    : BigInt(1e18); // Default to 1:1

  // Calculate accumulated yield (simplified - in real app, track initial deposit)
  // For demo, assume 5% yield on current value
  const accumulatedYield = userAssetValue
    ? (userAssetValue * BigInt(526)) / BigInt(10000) // ~5.26% yield
    : 0n;

  // Refetch all data
  const refetchAll = useCallback(() => {
    refetchTotalAssets();
    refetchTotalSupply();
    refetchPngyBalance();
    refetchAssetValue();
    setLocalLastUpdated(new Date());
  }, [refetchTotalAssets, refetchTotalSupply, refetchPngyBalance, refetchAssetValue]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refetchAll();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refetchAll]);

  // Update store when data changes
  useEffect(() => {
    if (totalAssets && totalSupply) {
      setVaultInfo(totalAssets, totalSupply, netValue);
    }
    if (userAssetValue) {
      setDashboardData(userAssetValue, accumulatedYield, MOCK_APY);
    }
    setLastUpdated(lastUpdated);
  }, [totalAssets, totalSupply, netValue, userAssetValue, accumulatedYield, lastUpdated, setVaultInfo, setDashboardData, setLastUpdated]);

  // Format values for display
  const formatUsdValue = (value: bigint | undefined, decimals: number = 18) => {
    if (!value) return '$0.00';
    const formatted = parseFloat(formatUnits(value, decimals));
    return `$${formatted.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPngyValue = (value: bigint | undefined, decimals: number = 18) => {
    if (!value) return '0.00';
    const formatted = parseFloat(formatUnits(value, decimals));
    return formatted.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  const formatNetValue = (value: bigint) => {
    const formatted = parseFloat(formatUnits(value, 18));
    return formatted.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Check for errors
  const hasError = totalAssetsError || totalSupplyError || pngyBalanceError || assetValueError;
  const isLoading = isTotalAssetsLoading || isTotalSupplyLoading || isPngyBalanceLoading || isAssetValueLoading;

  // Not connected state
  if (!isConnected) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        <p className="text-gray-500 text-center py-12">
          Connect your wallet to view your dashboard
        </p>
      </div>
    );
  }

  // Wrong network
  if (!isOnSupportedNetwork) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        <p className="text-amber-600 text-center py-12">
          Please switch to BSC network to view your dashboard
        </p>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">Error loading data. Please try again.</p>
          <button
            onClick={refetchAll}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        <div data-testid="loading-skeleton" className="space-y-4">
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Last updated: {formatTime(lastUpdated)}</span>
          <button
            onClick={refetchAll}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* PNGY Net Value */}
        <StatCard
          title="PNGY Net Value"
          value={formatNetValue(netValue)}
          subValue="USDT per PNGY"
          icon={<NetValueIcon />}
          testId="net-value"
        />

        {/* Your PNGY Balance */}
        <StatCard
          title="Your PNGY Balance"
          value={formatPngyValue(pngyBalance)}
          subValue="PNGY tokens"
          icon={<BalanceIcon />}
          testId="pngy-balance"
        />

        {/* Total Asset Value */}
        <StatCard
          title="Total Asset Value"
          value={formatUsdValue(userAssetValue)}
          subValue="in USDT"
          icon={<AssetIcon />}
          testId="total-asset-value"
          highlight
        />
      </div>

      {/* Yield Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Accumulated Yield */}
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <YieldIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-700 font-medium">Accumulated Yield</p>
              <p data-testid="accumulated-yield" className="text-xl font-bold text-green-800">
                {formatUsdValue(accumulatedYield)}
              </p>
              <p className="text-xs text-green-600">Profit since deposit</p>
            </div>
          </div>
        </div>

        {/* Current APY */}
        <div className="p-4 bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg border border-sky-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-lg">
              <ApyIcon className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-sm text-sky-700 font-medium">Current APY</p>
              <p data-testid="current-apy" className="text-xl font-bold text-sky-800">
                {MOCK_APY.toFixed(2)}%
              </p>
              <p className="text-xs text-sky-600">Annual Percentage Yield</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <p className="text-xs text-gray-500 mt-6 text-center">
        Data refreshes automatically every 5 minutes. Net value = Total Assets / Total Supply.
      </p>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string;
  subValue: string;
  icon: React.ReactNode;
  testId: string;
  highlight?: boolean;
}

function StatCard({ title, value, subValue, icon, testId, highlight }: StatCardProps) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        highlight
          ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100'
          : 'bg-gray-50 border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p data-testid={testId} className="text-2xl font-bold mt-1">
            {value}
          </p>
          <p className="text-xs text-gray-500 mt-1">{subValue}</p>
        </div>
        <div className={`p-2 rounded-lg ${highlight ? 'bg-amber-100' : 'bg-gray-100'}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-24 bg-gray-200 rounded-lg"></div>
    </div>
  );
}

// Icons
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function NetValueIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}

function BalanceIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function AssetIcon() {
  return (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function YieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  );
}

function ApyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

export default Dashboard;
