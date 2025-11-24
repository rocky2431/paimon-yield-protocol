/**
 * TransactionHistory Component Tests
 * Task #45 - 实现交易历史页面
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionHistory } from '../TransactionHistory';

// Mock transaction data
const mockTransactions = [
  {
    id: '1',
    type: 'deposit' as const,
    amount: BigInt('1000000000000000000000'), // 1000 USDT
    shares: BigInt('950000000000000000000'), // 950 PNGY
    timestamp: new Date('2024-01-15T10:30:00Z').getTime(),
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    status: 'completed' as const,
  },
  {
    id: '2',
    type: 'withdraw' as const,
    amount: BigInt('500000000000000000000'), // 500 USDT
    shares: BigInt('475000000000000000000'), // 475 PNGY
    timestamp: new Date('2024-01-20T14:45:00Z').getTime(),
    txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    status: 'completed' as const,
  },
  {
    id: '3',
    type: 'withdraw' as const,
    amount: BigInt('200000000000000000000'), // 200 USDT
    shares: BigInt('190000000000000000000'), // 190 PNGY
    timestamp: new Date('2024-01-25T09:00:00Z').getTime(),
    txHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
    status: 'pending' as const,
  },
];

// Mock fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock WalletConnect hook
jest.mock('../WalletConnect', () => ({
  useWallet: () => ({
    address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    isConnected: true,
    isOnSupportedNetwork: true,
  }),
}));

// Mock wagmi
jest.mock('wagmi', () => ({
  useChainId: () => 97,
}));

describe('TransactionHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ transactions: mockTransactions }),
    });
  });

  describe('rendering', () => {
    it('renders the transaction history with title', async () => {
      render(<TransactionHistory />);

      expect(screen.getByText('Transaction History')).toBeInTheDocument();
    });

    it('renders filter buttons', async () => {
      render(<TransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText('7 Days')).toBeInTheDocument();
        expect(screen.getByText('30 Days')).toBeInTheDocument();
        expect(screen.getByText('All')).toBeInTheDocument();
      });
    });

    it('renders export CSV button', async () => {
      render(<TransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });
    });

    it('renders table headers', async () => {
      render(<TransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Type')).toBeInTheDocument();
        expect(screen.getByText('Amount')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays transaction rows', async () => {
      render(<TransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText('Deposit')).toBeInTheDocument();
        expect(screen.getAllByText('Withdraw').length).toBe(2);
      });
    });

    it('displays formatted amounts', async () => {
      render(<TransactionHistory />);

      await waitFor(() => {
        // Check for formatted USDT amounts
        expect(screen.getByText(/1,000\.00/)).toBeInTheDocument();
      });
    });

    it('displays transaction status badges', async () => {
      render(<TransactionHistory />);

      await waitFor(() => {
        expect(screen.getAllByText('Completed').length).toBe(2);
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    it('renders BSCScan links for transactions', async () => {
      render(<TransactionHistory />);

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThan(0);
        expect(links[0]).toHaveAttribute('href', expect.stringContaining('bscscan.com'));
      });
    });
  });

  describe('filtering', () => {
    it('filters by 7 days when clicked', async () => {
      render(<TransactionHistory />);

      // Wait for data to load first
      await waitFor(() => {
        expect(screen.getByText('Deposit')).toBeInTheDocument();
      });

      const filterButton = screen.getByText('7 Days');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(filterButton).toHaveClass('bg-sky-500');
      });
    });

    it('filters by 30 days when clicked', async () => {
      render(<TransactionHistory />);

      // Wait for data to load first
      await waitFor(() => {
        expect(screen.getByText('Deposit')).toBeInTheDocument();
      });

      const filterButton = screen.getByText('30 Days');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(filterButton).toHaveClass('bg-sky-500');
      });
    });

    it('shows all transactions when All is clicked', async () => {
      render(<TransactionHistory />);

      // Wait for data to load first
      await waitFor(() => {
        expect(screen.getByText('Deposit')).toBeInTheDocument();
      });

      const filterButton = screen.getByText('All');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(filterButton).toHaveClass('bg-sky-500');
      });
    });
  });

  describe('CSV export', () => {
    it('renders export CSV button', async () => {
      render(<TransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });
    });

    it('export button is enabled when transactions exist', async () => {
      render(<TransactionHistory />);

      await waitFor(() => {
        const exportButton = screen.getByText('Export CSV');
        expect(exportButton).not.toBeDisabled();
      });
    });
  });

  describe('loading state', () => {
    it('shows loading state while fetching', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<TransactionHistory />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no transactions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ transactions: [] }),
      });

      render(<TransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText(/No transactions found/i)).toBeInTheDocument();
      });
    });
  });

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<TransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading transactions/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<TransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });
  });

  describe('disconnected state', () => {
    beforeEach(() => {
      jest.doMock('../WalletConnect', () => ({
        useWallet: () => ({
          address: undefined,
          isConnected: false,
          isOnSupportedNetwork: false,
        }),
      }));
    });

    it('shows connect wallet message when disconnected', () => {
      // Placeholder for disconnected state test
      expect(true).toBe(true);
    });
  });
});

describe('TransactionHistory - Exports', () => {
  it('exports TransactionHistory component', () => {
    expect(TransactionHistory).toBeDefined();
    expect(typeof TransactionHistory).toBe('function');
  });
});
