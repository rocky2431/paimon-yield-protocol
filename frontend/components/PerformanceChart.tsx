'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// Data types
interface NetValueDataPoint {
  date: string;
  netValue: number;
  apy: number;
}

interface RebalanceEvent {
  date: string;
  label: string;
}

interface ChartData {
  data: NetValueDataPoint[];
  events: RebalanceEvent[];
}

// Time period options
type TimePeriod = '7d' | '30d' | '90d';

interface PerformanceChartProps {
  className?: string;
}

export function PerformanceChart({ className = '' }: PerformanceChartProps) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d');

  // Fetch chart data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/netvalue?days=${getDaysFromPeriod(timePeriod)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      setChartData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setIsLoading(false);
    }
  }, [timePeriod]);

  // Fetch on mount and when period changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper to convert period to days
  function getDaysFromPeriod(period: TimePeriod): number {
    switch (period) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      default:
        return 30;
    }
  }

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!chartData?.data || chartData.data.length === 0) {
      return { currentNetValue: 0, periodReturn: 0, currentApy: 0 };
    }

    const data = chartData.data;
    const currentNetValue = data[data.length - 1].netValue;
    const startNetValue = data[0].netValue;
    const periodReturn = ((currentNetValue - startNetValue) / startNetValue) * 100;
    const currentApy = data[data.length - 1].apy;

    return { currentNetValue, periodReturn, currentApy };
  }, [chartData]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Export data to CSV
  const exportToCSV = () => {
    if (!chartData?.data) return;

    const headers = ['Date', 'Net Value', 'APY (%)'];
    const rows = chartData.data.map((d) => [d.date, d.netValue.toFixed(4), d.apy.toFixed(2)]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `performance_${timePeriod}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Performance History</h2>
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
        <h2 className="text-2xl font-bold mb-6">Performance History</h2>
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

  return (
    <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold">Performance History</h2>

        <div className="flex items-center gap-3">
          {/* Time Period Filter */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <PeriodButton
              active={timePeriod === '7d'}
              onClick={() => setTimePeriod('7d')}
            >
              7D
            </PeriodButton>
            <PeriodButton
              active={timePeriod === '30d'}
              onClick={() => setTimePeriod('30d')}
            >
              30D
            </PeriodButton>
            <PeriodButton
              active={timePeriod === '90d'}
              onClick={() => setTimePeriod('90d')}
            >
              90D
            </PeriodButton>
          </div>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            disabled={!chartData?.data}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg transition-colors"
          >
            <DownloadIcon className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Current Net Value"
          value={`$${summaryStats.currentNetValue.toFixed(4)}`}
          testId="current-net-value"
        />
        <StatCard
          label={`${getDaysFromPeriod(timePeriod)}D Return`}
          value={`${summaryStats.periodReturn >= 0 ? '+' : ''}${summaryStats.periodReturn.toFixed(2)}%`}
          valueColor={summaryStats.periodReturn >= 0 ? 'text-green-600' : 'text-red-600'}
          testId="period-return"
        />
        <StatCard
          label="Current APY"
          value={`${summaryStats.currentApy.toFixed(2)}%`}
          valueColor="text-sky-600"
          testId="current-apy"
        />
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData?.data || []}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              stroke="#d1d5db"
            />
            <YAxis
              yAxisId="left"
              domain={['auto', 'auto']}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              stroke="#d1d5db"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={['auto', 'auto']}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              stroke="#d1d5db"
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'netValue') return [`$${value.toFixed(4)}`, 'Net Value'];
                if (name === 'apy') return [`${value.toFixed(2)}%`, 'APY'];
                return [value, name];
              }}
              labelFormatter={(label) => formatDate(label)}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="netValue"
              name="Net Value"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="apy"
              name="APY"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              strokeDasharray="5 5"
            />
            {/* Rebalance event markers */}
            {chartData?.events?.map((event, index) => (
              <ReferenceLine
                key={index}
                x={event.date}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                label={{
                  value: event.label,
                  position: 'top',
                  fill: '#f59e0b',
                  fontSize: 10,
                }}
                yAxisId="left"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Note */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-sky-500"></div>
          <span>Net Value (USDT)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-green-500" style={{ borderStyle: 'dashed' }}></div>
          <span>APY (%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }}></div>
          <span>Rebalance Event</span>
        </div>
      </div>
    </div>
  );
}

// Period Button Component
interface PeriodButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function PeriodButton({ active, onClick, children }: PeriodButtonProps) {
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

export default PerformanceChart;
