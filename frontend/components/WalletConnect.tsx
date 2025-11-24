'use client';

import { useAppKit, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { useBalance, useChainId, useSwitchChain } from 'wagmi';
import { formatUnits } from 'viem';
import { contracts, supportedChains } from '@/lib/wagmi/config';

// USDT ABI - only balanceOf function needed
const USDT_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface WalletConnectProps {
  className?: string;
  showBalance?: boolean;
  showNetwork?: boolean;
}

export function WalletConnect({
  className = '',
  showBalance = true,
  showNetwork = true
}: WalletConnectProps) {
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();
  const { chainId: appKitChainId } = useAppKitNetwork();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Get USDT contract address for current chain
  const getUsdtAddress = (): `0x${string}` | undefined => {
    if (!chainId) return undefined;
    const contractsForChain = contracts[chainId as keyof typeof contracts];
    return contractsForChain?.usdt;
  };
  const usdtAddress = getUsdtAddress();

  // Fetch USDT balance
  const { data: usdtBalance, isLoading: isBalanceLoading } = useBalance({
    address: address as `0x${string}` | undefined,
    token: usdtAddress,
    query: {
      enabled: isConnected && !!address && !!usdtAddress,
    },
  });

  // Check if on supported network
  const isOnSupportedNetwork = chainId === supportedChains.bsc.id ||
                               chainId === supportedChains.bscTestnet.id;

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Format balance for display
  const formatBalance = (balance: bigint | undefined, decimals: number = 18) => {
    if (!balance) return '0.00';
    const formatted = formatUnits(balance, decimals);
    return parseFloat(formatted).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Get network name
  const getNetworkName = () => {
    if (chainId === supportedChains.bsc.id) return 'BSC Mainnet';
    if (chainId === supportedChains.bscTestnet.id) return 'BSC Testnet';
    return 'Unsupported Network';
  };

  // Handle network switch
  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: supportedChains.bsc.id });
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <button
        onClick={() => open()}
        className={`px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition-colors ${className}`}
      >
        Connect Wallet
      </button>
    );
  }

  // Wrong network warning
  if (!isOnSupportedNetwork) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm">
          Wrong Network
        </div>
        <button
          onClick={handleSwitchNetwork}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Switch to BSC
        </button>
      </div>
    );
  }

  // Connected state
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* USDT Balance */}
      {showBalance && (
        <div className="px-3 py-2 bg-gray-100 rounded-lg">
          <span className="text-sm text-gray-600">USDT:</span>{' '}
          <span className="font-medium">
            {isBalanceLoading ? '...' : formatBalance(usdtBalance?.value, usdtBalance?.decimals)}
          </span>
        </div>
      )}

      {/* Network Badge */}
      {showNetwork && (
        <div className="px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
          {getNetworkName()}
        </div>
      )}

      {/* Wallet Button - Opens AppKit modal */}
      <button
        onClick={() => open()}
        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
      >
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        {formatAddress(address!)}
      </button>
    </div>
  );
}

// Compact version for mobile/smaller spaces
export function WalletConnectCompact({ className = '' }: { className?: string }) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  if (!isConnected) {
    return (
      <button
        onClick={() => open()}
        className={`p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors ${className}`}
        aria-label="Connect Wallet"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      className={`px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 ${className}`}
    >
      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
      {address?.slice(0, 6)}...{address?.slice(-4)}
    </button>
  );
}

// Hook for accessing wallet state in other components
export function useWallet() {
  const { address, isConnected, status } = useAppKitAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { open, close } = useAppKit();

  const isOnSupportedNetwork = chainId === supportedChains.bsc.id ||
                               chainId === supportedChains.bscTestnet.id;

  const getUsdtAddr = (): `0x${string}` | undefined => {
    if (!chainId) return undefined;
    const contractsForChain = contracts[chainId as keyof typeof contracts];
    return contractsForChain?.usdt;
  };
  const usdtAddress = getUsdtAddr();

  const { data: usdtBalance, isLoading: isBalanceLoading, refetch: refetchBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    token: usdtAddress,
    query: {
      enabled: isConnected && !!address && !!usdtAddress,
    },
  });

  return {
    address: address as `0x${string}` | undefined,
    isConnected,
    status,
    chainId,
    isOnSupportedNetwork,
    usdtBalance: usdtBalance?.value,
    usdtDecimals: usdtBalance?.decimals ?? 18,
    isBalanceLoading,
    refetchBalance,
    switchToBSC: () => switchChain({ chainId: supportedChains.bsc.id }),
    switchToBSCTestnet: () => switchChain({ chainId: supportedChains.bscTestnet.id }),
    openModal: open,
    closeModal: close,
  };
}

export default WalletConnect;
