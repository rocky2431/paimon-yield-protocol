'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Data types
interface RWAAsset {
  id: string;
  name: string;
  symbol: string;
  currentAllocation: number;
  targetAllocation: number;
  apy: number;
  qualityRating: string;
  holdingValue: number;
  lastRebalance: string;
}

interface AllocationData {
  assets: RWAAsset[];
  totalValue: number;
  lastRebalance: string | null;
}

type ViewMode = 'chart' | 'list';

// Color palette for pie chart
const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Quality rating colors
const RATING_COLORS: Record<string, string> = {
  AAA: 'text-green-600 bg-green-100',
  AA: 'text-green-500 bg-green-50',
  A: 'text-blue-600 bg-blue-100',
  BBB: 'text-yellow-600 bg-yellow-100',
  BB: 'text-orange-600 bg-orange-100',
  B: 'text-red-600 bg-red-100',
};

interface AssetAllocationProps {
  className?: string;
}

export function AssetAllocation({ className = '' }: AssetAllocationProps) {
  const [data, setData] = useState<AllocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('chart');

  // Fetch allocation data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assets/allocation');

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
        totalValue: 0,
        weightedApy: 0,
        assetCount: 0,
        hasDeviation: false,
      };
    }

    const totalValue = data.totalValue;
    const assetCount = data.assets.length;

    // Calculate weighted average APY
    const weightedApy = data.assets.reduce((sum, asset) => {
      return sum + (asset.apy * asset.currentAllocation) / 100;
    }, 0);

    // Check for allocation deviations (>2% difference from target)
    const hasDeviation = data.assets.some(
      (asset) => Math.abs(asset.currentAllocation - asset.targetAllocation) > 2
    );

    return { totalValue, weightedApy, assetCount, hasDeviation };
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

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Prepare pie chart data
  const pieData = useMemo(() => {
    if (!data?.assets) return [];
    return data.assets.map((asset) => ({
      name: asset.symbol,
      value: asset.currentAllocation,
      fullName: asset.name,
    }));
  }, [data]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Asset Allocation</h2>
        <div data-testid="loading-state" className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Asset Allocation</h2>
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
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Asset Allocation</h2>
        <div className="text-center py-12">
          <p className="text-gray-500">No assets in the vault yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Asset Allocation</h2>
          {summaryStats.hasDeviation && (
            <span
              data-testid="deviation-indicator"
              className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full"
            >
              Rebalance Needed
            </span>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'chart'
                ? 'bg-sky-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-sky-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Value"
          value={formatCurrency(summaryStats.totalValue)}
          testId="total-value"
        />
        <StatCard
          label="Weighted APY"
          value={`${summaryStats.weightedApy.toFixed(2)}%`}
          valueColor="text-green-600"
          testId="weighted-apy"
        />
        <StatCard
          label="Assets"
          value={summaryStats.assetCount.toString()}
          testId="asset-count"
        />
        <StatCard
          label="Last Rebalance"
          value={formatDate(data.lastRebalance)}
          testId="last-rebalance"
        />
      </div>

      {/* Chart View */}
      {viewMode === 'chart' && (
        <div className="h-80 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name} ${value}%`}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value}%`, name]}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div data-testid="asset-list-view" className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Asset</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Allocation</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Target</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">APY</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Rating</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.assets.map((asset, index) => (
                  <tr key={asset.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{asset.name}</p>
                          <p className="text-sm text-gray-500">{asset.symbol}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-medium">{asset.currentAllocation}%</span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500">
                      {asset.targetAllocation}%
                    </td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">
                      {asset.apy.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          RATING_COLORS[asset.qualityRating] || 'text-gray-600 bg-gray-100'
                        }`}
                      >
                        {asset.qualityRating}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(asset.holdingValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Asset Cards (shown in both views) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.assets.map((asset, index) => (
          <AssetCard key={asset.id} asset={asset} color={COLORS[index % COLORS.length]} />
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
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p data-testid={testId} className={`text-xl font-bold ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}

// Asset Card Component
interface AssetCardProps {
  asset: RWAAsset;
  color: string;
}

function AssetCard({ asset, color }: AssetCardProps) {
  const deviation = asset.currentAllocation - asset.targetAllocation;
  const hasDeviation = Math.abs(deviation) > 2;

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-medium text-gray-900">{asset.symbol}</span>
        </div>
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded ${
            RATING_COLORS[asset.qualityRating] || 'text-gray-600 bg-gray-100'
          }`}
        >
          {asset.qualityRating}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-3 line-clamp-1">{asset.name}</p>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Allocation</span>
          <span className="font-medium">
            {asset.currentAllocation}%
            {hasDeviation && (
              <span className={deviation > 0 ? 'text-red-500' : 'text-green-500'}>
                {' '}({deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%)
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">APY</span>
          <span className="font-medium text-green-600">{asset.apy.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}

export default AssetAllocation;
