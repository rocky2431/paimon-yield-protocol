'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// Data types
interface RWAAssetDetail {
  id: string;
  name: string;
  symbol: string;
  description: string;
  assetType: string;
  issuer: string;
  issuerUrl: string;
  currentAllocation: number;
  targetAllocation: number;
  apy: number;
  holdingValue: number;
  qualityRating: string;
  auditReport: string;
  contractAddress: string;
  lastUpdated: string;
}

interface AssetsData {
  assets: RWAAssetDetail[];
}

// Quality rating colors
const RATING_COLORS: Record<string, string> = {
  AAA: 'text-green-600 bg-green-100',
  AA: 'text-green-500 bg-green-50',
  A: 'text-blue-600 bg-blue-100',
  BBB: 'text-yellow-600 bg-yellow-100',
  BB: 'text-orange-600 bg-orange-100',
  B: 'text-red-600 bg-red-100',
};

// Asset type icons
const ASSET_TYPE_ICONS: Record<string, string> = {
  'Government Bond': '🏛️',
  'Corporate Bond': '🏢',
  'Real Estate': '🏠',
  'Commodity': '📦',
  'Equity': '📈',
};

interface AssetDetailsProps {
  className?: string;
}

export function AssetDetails({ className = '' }: AssetDetailsProps) {
  const [data, setData] = useState<AssetsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch asset details
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assets/details');

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!data?.assets || data.assets.length === 0) {
      return {
        totalAssets: 0,
        totalTvl: 0,
        weightedApy: 0,
      };
    }

    const totalAssets = data.assets.length;
    const totalTvl = data.assets.reduce((sum, asset) => sum + asset.holdingValue, 0);
    const weightedApy = data.assets.reduce((sum, asset) => {
      return sum + (asset.apy * asset.currentAllocation) / 100;
    }, 0);

    return { totalAssets, totalTvl, weightedApy };
  }, [data]);

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  // Truncate address
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <h1 className="text-3xl font-bold mb-6">RWA Assets</h1>
        <div data-testid="loading-state" className="animate-pulse space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <h1 className="text-3xl font-bold mb-6">RWA Assets</h1>
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">Error loading data. Please try again.</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data?.assets || data.assets.length === 0) {
    return (
      <div className={`p-6 ${className}`}>
        <h1 className="text-3xl font-bold mb-6">RWA Assets</h1>
        <div className="text-center py-12">
          <p className="text-gray-500">No assets in the vault yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <h1 className="text-3xl font-bold mb-6">RWA Assets</h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Assets"
          value={summaryStats.totalAssets.toString()}
          testId="total-assets"
        />
        <StatCard
          label="Total Value Locked"
          value={formatCurrency(summaryStats.totalTvl)}
          testId="total-tvl"
        />
        <StatCard
          label="Weighted APY"
          value={`${summaryStats.weightedApy.toFixed(2)}%`}
          valueColor="text-green-600"
          testId="weighted-apy"
        />
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            formatCurrency={formatCurrency}
            truncateAddress={truncateAddress}
          />
        ))}
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
  valueColor?: string;
  testId: string;
}

function StatCard({ label, value, valueColor = 'text-gray-900', testId }: StatCardProps) {
  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p data-testid={testId} className={`text-2xl font-bold ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}

// Asset Card Component
interface AssetCardProps {
  asset: RWAAssetDetail;
  formatCurrency: (value: number) => string;
  truncateAddress: (address: string) => string;
}

function AssetCard({ asset, formatCurrency, truncateAddress }: AssetCardProps) {
  const deviation = asset.currentAllocation - asset.targetAllocation;
  const hasDeviation = Math.abs(deviation) > 2;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {ASSET_TYPE_ICONS[asset.assetType] || '📊'}
            </span>
            <div>
              <h3 className="font-bold text-gray-900">{asset.name}</h3>
              <p className="text-sm text-gray-500">{asset.symbol}</p>
            </div>
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              RATING_COLORS[asset.qualityRating] || 'text-gray-600 bg-gray-100'
            }`}
          >
            {asset.qualityRating}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2">{asset.description}</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Asset Type</p>
            <p className="text-sm font-medium">{asset.assetType}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">APY</p>
            <p className="text-sm font-medium text-green-600">{asset.apy.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Allocation</p>
            <p className="text-sm font-medium">
              {asset.currentAllocation}%
              {hasDeviation && (
                <span className={deviation > 0 ? 'text-red-500' : 'text-green-500'}>
                  {' '}({deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Target: {asset.targetAllocation}%</p>
            <p className="text-sm font-medium">{formatCurrency(asset.holdingValue)}</p>
          </div>
        </div>

        {/* Issuer */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Issuer</p>
          <a
            href={asset.issuerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline"
          >
            {asset.issuer} ↗
          </a>
        </div>

        {/* Links */}
        <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
          <a
            href={asset.auditReport}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <ShieldIcon className="w-3 h-3" />
            View Audit
          </a>
          <a
            href={`https://bscscan.com/address/${asset.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`contract-link-${asset.id}`}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <LinkIcon className="w-3 h-3" />
            {truncateAddress(asset.contractAddress)}
          </a>
        </div>
      </div>
    </div>
  );
}

// Icons
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

export default AssetDetails;
