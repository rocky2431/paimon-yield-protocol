/**
 * WalletConnect Component Tests
 */

import { render, screen } from '@testing-library/react';
import { WalletConnect, WalletConnectCompact, useWallet } from '../WalletConnect';

// Mock the Reown AppKit hooks
jest.mock('@reown/appkit/react', () => ({
  useAppKit: () => ({
    open: jest.fn(),
    close: jest.fn(),
  }),
  useAppKitAccount: () => ({
    address: undefined,
    isConnected: false,
    status: 'disconnected',
  }),
  useAppKitNetwork: () => ({
    chainId: undefined,
  }),
}));

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useBalance: () => ({
    data: undefined,
    isLoading: false,
  }),
  useChainId: () => undefined,
  useSwitchChain: () => ({
    switchChain: jest.fn(),
  }),
}));

// Mock the config
jest.mock('@/lib/wagmi/config', () => ({
  contracts: {
    56: {
      pngyVault: '0x0000000000000000000000000000000000000000',
      usdt: '0x55d398326f99059fF775485246999027B3197955',
    },
    97: {
      pngyVault: '0x0000000000000000000000000000000000000000',
      usdt: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    },
  },
  supportedChains: {
    bsc: { id: 56 },
    bscTestnet: { id: 97 },
  },
}));

describe('WalletConnect', () => {
  describe('when disconnected', () => {
    it('renders connect button when wallet is not connected', () => {
      render(<WalletConnect />);
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    it('renders connect button with custom className', () => {
      render(<WalletConnect className="custom-class" />);
      const button = screen.getByText('Connect Wallet');
      expect(button).toHaveClass('custom-class');
    });
  });
});

describe('WalletConnectCompact', () => {
  describe('when disconnected', () => {
    it('renders connect icon button when wallet is not connected', () => {
      render(<WalletConnectCompact />);
      const button = screen.getByRole('button', { name: /connect wallet/i });
      expect(button).toBeInTheDocument();
    });
  });
});

describe('useWallet hook', () => {
  it('should be exported and callable', () => {
    expect(useWallet).toBeDefined();
    expect(typeof useWallet).toBe('function');
  });
});
