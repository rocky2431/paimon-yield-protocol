/**
 * AssetDetails Component Tests
 * Task #48 - 实现 RWA 资产详情页面
 */

import { render, screen, waitFor } from '@testing-library/react';
import { AssetDetails } from '../AssetDetails';

// Mock data
const mockAssetDetails = [
  {
    id: 'asset-1',
    name: 'US Treasury Bond Token',
    symbol: 'USTB',
    description: 'Tokenized US Treasury bonds with daily yield distribution',
    assetType: 'Government Bond',
    issuer: 'TreasuryDAO',
    issuerUrl: 'https://treasurydao.com',
    currentAllocation: 40,
    targetAllocation: 40,
    apy: 5.2,
    holdingValue: 4000000,
    qualityRating: 'AAA',
    auditReport: 'https://audit.example.com/ustb',
    contractAddress: '0x1234567890123456789012345678901234567890',
    lastUpdated: '2024-01-15T10:30:00Z',
  },
  {
    id: 'asset-2',
    name: 'Corporate Bond Token',
    symbol: 'CORP',
    description: 'Diversified corporate bond portfolio',
    assetType: 'Corporate Bond',
    issuer: 'BondFi',
    issuerUrl: 'https://bondfi.io',
    currentAllocation: 35,
    targetAllocation: 35,
    apy: 6.8,
    holdingValue: 3500000,
    qualityRating: 'AA',
    auditReport: 'https://audit.example.com/corp',
    contractAddress: '0x2345678901234567890123456789012345678901',
    lastUpdated: '2024-01-15T10:30:00Z',
  },
  {
    id: 'asset-3',
    name: 'Real Estate Token',
    symbol: 'REIT',
    description: 'Commercial real estate investment trust',
    assetType: 'Real Estate',
    issuer: 'PropChain',
    issuerUrl: 'https://propchain.finance',
    currentAllocation: 25,
    targetAllocation: 25,
    apy: 8.5,
    holdingValue: 2500000,
    qualityRating: 'A',
    auditReport: 'https://audit.example.com/reit',
    contractAddress: '0x3456789012345678901234567890123456789012',
    lastUpdated: '2024-01-15T10:30:00Z',
  },
];

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AssetDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        assets: mockAssetDetails,
      }),
    });
  });

  describe('rendering', () => {
    it('renders the page with title', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText('RWA Assets')).toBeInTheDocument();
      });
    });

    it('renders asset cards after data loads', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText('US Treasury Bond Token')).toBeInTheDocument();
        expect(screen.getByText('Corporate Bond Token')).toBeInTheDocument();
        expect(screen.getByText('Real Estate Token')).toBeInTheDocument();
      });
    });
  });

  describe('asset information display', () => {
    it('displays asset symbols', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText('USTB')).toBeInTheDocument();
        expect(screen.getByText('CORP')).toBeInTheDocument();
        expect(screen.getByText('REIT')).toBeInTheDocument();
      });
    });

    it('displays asset types', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText('Government Bond')).toBeInTheDocument();
        expect(screen.getByText('Corporate Bond')).toBeInTheDocument();
        expect(screen.getByText('Real Estate')).toBeInTheDocument();
      });
    });

    it('displays issuer names', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        // Issuer names include arrow symbol (↗)
        expect(screen.getByText(/TreasuryDAO/)).toBeInTheDocument();
        expect(screen.getByText(/BondFi/)).toBeInTheDocument();
        expect(screen.getByText(/PropChain/)).toBeInTheDocument();
      });
    });

    it('displays APY values', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText('5.20%')).toBeInTheDocument();
        expect(screen.getByText('6.80%')).toBeInTheDocument();
        expect(screen.getByText('8.50%')).toBeInTheDocument();
      });
    });

    it('displays quality ratings', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText('AAA')).toBeInTheDocument();
        expect(screen.getByText('AA')).toBeInTheDocument();
        expect(screen.getByText('A')).toBeInTheDocument();
      });
    });

    it('displays holding values', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText('$4.00M')).toBeInTheDocument();
        expect(screen.getByText('$3.50M')).toBeInTheDocument();
        expect(screen.getByText('$2.50M')).toBeInTheDocument();
      });
    });
  });

  describe('allocation display', () => {
    it('displays current allocation percentages', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText('40%')).toBeInTheDocument();
        expect(screen.getByText('35%')).toBeInTheDocument();
        expect(screen.getByText('25%')).toBeInTheDocument();
      });
    });

    it('displays target allocation percentages', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        // Target allocations should be displayed
        const targetElements = screen.getAllByText(/Target:/);
        expect(targetElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('external links', () => {
    it('renders issuer website links', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        const issuerLinks = links.filter(link =>
          link.getAttribute('href')?.includes('treasurydao') ||
          link.getAttribute('href')?.includes('bondfi') ||
          link.getAttribute('href')?.includes('propchain')
        );
        expect(issuerLinks.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('renders audit report links', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        const auditLinks = screen.getAllByText('View Audit');
        expect(auditLinks.length).toBe(3);
      });
    });

    it('renders contract address with BSCScan link', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-link-asset-1')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows loading state while fetching data', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<AssetDetails />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading data/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty state when no assets', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          assets: [],
        }),
      });

      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByText(/No assets/i)).toBeInTheDocument();
      });
    });
  });

  describe('summary statistics', () => {
    it('displays total assets count', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByTestId('total-assets')).toBeInTheDocument();
      });
    });

    it('displays total value locked', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByTestId('total-tvl')).toBeInTheDocument();
      });
    });

    it('displays weighted average APY', async () => {
      render(<AssetDetails />);

      await waitFor(() => {
        expect(screen.getByTestId('weighted-apy')).toBeInTheDocument();
      });
    });
  });
});

describe('AssetDetails - Exports', () => {
  it('exports AssetDetails component', () => {
    expect(AssetDetails).toBeDefined();
    expect(typeof AssetDetails).toBe('function');
  });
});
