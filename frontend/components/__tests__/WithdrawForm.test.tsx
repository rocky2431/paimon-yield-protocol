/**
 * WithdrawForm Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { WithdrawForm } from '../WithdrawForm';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useReadContract: jest.fn().mockImplementation(({ functionName }) => {
    if (functionName === 'balanceOf') {
      return {
        data: BigInt('5000000000000000000000'), // 5000 PNGY
        refetch: jest.fn(),
      };
    }
    if (functionName === 'getUserLockedShares') {
      return {
        data: BigInt(0),
      };
    }
    if (functionName === 'previewRedeem') {
      return {
        data: BigInt('5100000000000000000000'), // 5100 USDT
        isLoading: false,
      };
    }
    if (functionName === 'paused') {
      return { data: false };
    }
    if (functionName === 'getUserPendingRequests') {
      return {
        data: [],
        refetch: jest.fn(),
      };
    }
    return { data: undefined };
  }),
  useReadContracts: jest.fn().mockReturnValue({
    data: [],
  }),
  useWriteContract: jest.fn().mockReturnValue({
    data: undefined,
    writeContract: jest.fn(),
    isPending: false,
    error: null,
    reset: jest.fn(),
  }),
  useWaitForTransactionReceipt: jest.fn().mockReturnValue({
    isLoading: false,
    isSuccess: false,
    data: null,
  }),
  useChainId: () => 97, // BSC Testnet
  useBalance: () => ({
    data: { value: BigInt('10000000000000000000000'), decimals: 18 },
    isLoading: false,
  }),
  useSwitchChain: () => ({ switchChain: jest.fn() }),
}));

// Mock Reown AppKit hooks
jest.mock('@reown/appkit/react', () => ({
  useAppKit: () => ({
    open: jest.fn(),
    close: jest.fn(),
  }),
  useAppKitAccount: () => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
    status: 'connected',
  }),
  useAppKitNetwork: () => ({
    chainId: 97,
  }),
}));

// Mock config
jest.mock('@/lib/wagmi/config', () => ({
  contracts: {
    56: {
      pngyVault: '0x0000000000000000000000000000000000000001',
      usdt: '0x55d398326f99059fF775485246999027B3197955',
    },
    97: {
      pngyVault: '0x0000000000000000000000000000000000000001',
      usdt: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    },
  },
  supportedChains: {
    bsc: { id: 56 },
    bscTestnet: { id: 97 },
  },
}));

// Mock WalletConnect hook
jest.mock('../WalletConnect', () => ({
  useWallet: () => ({
    address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    isConnected: true,
    status: 'connected',
    chainId: 97,
    isOnSupportedNetwork: true,
    usdtBalance: BigInt('10000000000000000000000'),
    usdtDecimals: 18,
    isBalanceLoading: false,
    refetchBalance: jest.fn(),
    switchToBSC: jest.fn(),
    switchToBSCTestnet: jest.fn(),
    openModal: jest.fn(),
    closeModal: jest.fn(),
  }),
}));

describe('WithdrawForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the withdraw form with title', () => {
      render(<WithdrawForm />);
      expect(screen.getByText('Withdraw')).toBeInTheDocument();
    });

    it('renders PNGY amount input field', () => {
      render(<WithdrawForm />);
      expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    });

    it('displays maximum withdrawal limit', () => {
      render(<WithdrawForm />);
      expect(screen.getByText('Max: $100,000 USDT')).toBeInTheDocument();
    });

    it('displays user PNGY balance', () => {
      render(<WithdrawForm />);
      expect(screen.getByText(/Available:/)).toBeInTheDocument();
    });

    it('renders MAX button', () => {
      render(<WithdrawForm />);
      expect(screen.getByText('MAX')).toBeInTheDocument();
    });

    it('displays T+1 withdrawal notice', () => {
      render(<WithdrawForm />);
      expect(screen.getByText('T+1 Withdrawal')).toBeInTheDocument();
    });
  });

  describe('amount validation', () => {
    it('shows preview when valid amount entered', () => {
      render(<WithdrawForm />);
      const input = screen.getByPlaceholderText('0.00');
      fireEvent.change(input, { target: { value: '1000' } });
      expect(screen.getByText('You will receive')).toBeInTheDocument();
    });

    it('shows T+1 processing time in preview', () => {
      render(<WithdrawForm />);
      const input = screen.getByPlaceholderText('0.00');
      fireEvent.change(input, { target: { value: '1000' } });
      expect(screen.getByText('T+1 (24 hours)')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('renders request withdrawal button', () => {
      render(<WithdrawForm />);
      expect(screen.getByText('Request Withdrawal')).toBeInTheDocument();
    });

    it('request button is disabled when amount is empty', () => {
      render(<WithdrawForm />);
      const requestButton = screen.getByText('Request Withdrawal');
      expect(requestButton).toBeDisabled();
    });
  });

  describe('MAX button', () => {
    it('sets max amount when MAX is clicked', () => {
      render(<WithdrawForm />);
      const maxButton = screen.getByText('MAX');
      fireEvent.click(maxButton);
      const input = screen.getByPlaceholderText('0.00') as HTMLInputElement;
      expect(input.value).toBe('5000');
    });
  });

  describe('T+1 notice', () => {
    it('displays withdrawal waiting period info', () => {
      render(<WithdrawForm />);
      expect(screen.getByText(/24-hour waiting period/)).toBeInTheDocument();
    });
  });
});

describe('WithdrawForm - Exports', () => {
  it('exports WithdrawForm component', () => {
    expect(WithdrawForm).toBeDefined();
    expect(typeof WithdrawForm).toBe('function');
  });
});
