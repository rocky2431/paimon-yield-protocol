/**
 * PerformanceChart Component Tests
 * Task #46 - 实现历史收益曲线图表
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceChart } from '../PerformanceChart';

// Mock Recharts components (they don't render well in JSDOM)
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="chart-line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ReferenceLine: ({ label }: { label: string | { value: string } }) => (
    <div data-testid="reference-line">
      {typeof label === 'object' ? label.value : label}
    </div>
  ),
}));

// Mock data
const mockNetValueData = [
  { date: '2024-01-01', netValue: 1.0, apy: 5.0 },
  { date: '2024-01-08', netValue: 1.02, apy: 5.2 },
  { date: '2024-01-15', netValue: 1.04, apy: 5.1 },
  { date: '2024-01-22', netValue: 1.05, apy: 5.3 },
  { date: '2024-01-29', netValue: 1.06, apy: 5.4 },
];

const mockRebalanceEvents = [
  { date: '2024-01-15', label: 'Rebalance' },
];

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PerformanceChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: mockNetValueData,
        events: mockRebalanceEvents,
      }),
    });
  });

  describe('rendering', () => {
    it('renders the chart with title', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByText('Performance History')).toBeInTheDocument();
      });
    });

    it('renders time period filter buttons after data loads', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByText('7D')).toBeInTheDocument();
        expect(screen.getByText('30D')).toBeInTheDocument();
        expect(screen.getByText('90D')).toBeInTheDocument();
      });
    });

    it('renders export button after data loads', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });
    });

    it('renders chart components after data loads', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });
  });

  describe('time period filtering', () => {
    it('fetches 7 day data when 7D is clicked', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByText('7D')).toBeInTheDocument();
      });

      const button = screen.getByText('7D');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveClass('bg-sky-500');
      });
    });

    it('fetches 30 day data when 30D is clicked', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByText('30D')).toBeInTheDocument();
      });

      const button = screen.getByText('30D');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveClass('bg-sky-500');
      });
    });

    it('fetches 90 day data when 90D is clicked', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByText('90D')).toBeInTheDocument();
      });

      const button = screen.getByText('90D');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveClass('bg-sky-500');
      });
    });
  });

  describe('chart display', () => {
    it('displays net value and APY lines', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        // Chart has 2 lines: Net Value and APY
        const lines = screen.getAllByTestId('chart-line');
        expect(lines).toHaveLength(2);
      });
    });

    it('displays axes', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByTestId('x-axis')).toBeInTheDocument();
        // Chart has 2 Y-axes: left (Net Value) and right (APY)
        const yAxes = screen.getAllByTestId('y-axis');
        expect(yAxes).toHaveLength(2);
      });
    });
  });

  describe('summary stats', () => {
    it('displays current net value', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByTestId('current-net-value')).toBeInTheDocument();
      });
    });

    it('displays period return', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByTestId('period-return')).toBeInTheDocument();
      });
    });

    it('displays current APY', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByTestId('current-apy')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows loading state while fetching data', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<PerformanceChart />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading data/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<PerformanceChart />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });
  });

  describe('data export', () => {
    it('renders export button', async () => {
      render(<PerformanceChart />);

      await waitFor(() => {
        const exportButton = screen.getByText('Export');
        expect(exportButton).toBeInTheDocument();
      });
    });
  });
});

describe('PerformanceChart - Exports', () => {
  it('exports PerformanceChart component', () => {
    expect(PerformanceChart).toBeDefined();
    expect(typeof PerformanceChart).toBe('function');
  });
});
