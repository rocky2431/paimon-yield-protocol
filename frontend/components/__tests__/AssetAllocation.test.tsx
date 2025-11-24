/**
 * AssetAllocation Component Tests
 * Task #47 - 实现 RWA 资产配置展示
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssetAllocation } from '../AssetAllocation';

// Mock Recharts components (they don't render well in JSDOM)
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ data }: { data: unknown[] }) => (
    <div data-testid="pie" data-count={data?.length || 0} />
  ),
  Cell: () => <div data-testid="pie-cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

// Mock data
const mockAssetData = [
  {
    id: 'asset-1',
    name: 'US Treasury Bond Token',
    symbol: 'USTB',
    currentAllocation: 40,
    targetAllocation: 40,
    apy: 5.2,
    qualityRating: 'AAA',
    holdingValue: 4000000,
    lastRebalance: '2024-01-15T10:30:00Z',
  },
  {
    id: 'asset-2',
    name: 'Corporate Bond Token',
    symbol: 'CORP',
    currentAllocation: 35,
    targetAllocation: 35,
    apy: 6.8,
    qualityRating: 'AA',
    holdingValue: 3500000,
    lastRebalance: '2024-01-15T10:30:00Z',
  },
  {
    id: 'asset-3',
    name: 'Real Estate Token',
    symbol: 'REIT',
    currentAllocation: 25,
    targetAllocation: 25,
    apy: 8.5,
    qualityRating: 'A',
    holdingValue: 2500000,
    lastRebalance: '2024-01-15T10:30:00Z',
  },
];

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AssetAllocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        assets: mockAssetData,
        totalValue: 10000000,
        lastRebalance: '2024-01-15T10:30:00Z',
      }),
    });
  });

  describe('rendering', () => {
    it('renders the component with title', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText('Asset Allocation')).toBeInTheDocument();
      });
    });

    it('renders pie chart after data loads', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      });
    });

    it('renders asset list after data loads', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText('US Treasury Bond Token')).toBeInTheDocument();
        expect(screen.getByText('Corporate Bond Token')).toBeInTheDocument();
        expect(screen.getByText('Real Estate Token')).toBeInTheDocument();
      });
    });
  });

  describe('asset details display', () => {
    it('displays asset symbols', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText('USTB')).toBeInTheDocument();
        expect(screen.getByText('CORP')).toBeInTheDocument();
        expect(screen.getByText('REIT')).toBeInTheDocument();
      });
    });

    it('displays allocation percentages', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText('40%')).toBeInTheDocument();
        expect(screen.getByText('35%')).toBeInTheDocument();
        expect(screen.getByText('25%')).toBeInTheDocument();
      });
    });

    it('displays APY values', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText('5.20%')).toBeInTheDocument();
        expect(screen.getByText('6.80%')).toBeInTheDocument();
        expect(screen.getByText('8.50%')).toBeInTheDocument();
      });
    });

    it('displays quality ratings', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText('AAA')).toBeInTheDocument();
        expect(screen.getByText('AA')).toBeInTheDocument();
        expect(screen.getByText('A')).toBeInTheDocument();
      });
    });
  });

  describe('summary statistics', () => {
    it('displays total vault value', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByTestId('total-value')).toBeInTheDocument();
      });
    });

    it('displays weighted average APY', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByTestId('weighted-apy')).toBeInTheDocument();
      });
    });

    it('displays last rebalance time', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByTestId('last-rebalance')).toBeInTheDocument();
      });
    });

    it('displays number of assets', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByTestId('asset-count')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows loading state while fetching data', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<AssetAllocation />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading data/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('retries fetch when retry button clicked', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            assets: mockAssetData,
            totalValue: 10000000,
            lastRebalance: '2024-01-15T10:30:00Z',
          }),
        });

      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('US Treasury Bond Token')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty state when no assets', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          assets: [],
          totalValue: 0,
          lastRebalance: null,
        }),
      });

      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText(/No assets/i)).toBeInTheDocument();
      });
    });
  });

  describe('allocation deviation indicator', () => {
    it('shows deviation warning when allocation differs from target', async () => {
      const deviatedData = [
        {
          ...mockAssetData[0],
          currentAllocation: 45, // 5% deviation from target 40%
          targetAllocation: 40,
        },
        ...mockAssetData.slice(1),
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          assets: deviatedData,
          totalValue: 10000000,
          lastRebalance: '2024-01-15T10:30:00Z',
        }),
      });

      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByTestId('deviation-indicator')).toBeInTheDocument();
      });
    });
  });

  describe('view toggle', () => {
    it('renders view toggle buttons', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText('Chart')).toBeInTheDocument();
        expect(screen.getByText('List')).toBeInTheDocument();
      });
    });

    it('switches to list view when List button clicked', async () => {
      render(<AssetAllocation />);

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('List'));

      await waitFor(() => {
        expect(screen.getByTestId('asset-list-view')).toBeInTheDocument();
      });
    });
  });
});

describe('AssetAllocation - Exports', () => {
  it('exports AssetAllocation component', () => {
    expect(AssetAllocation).toBeDefined();
    expect(typeof AssetAllocation).toBe('function');
  });
});
