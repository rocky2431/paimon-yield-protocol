import { cookieStorage, createStorage } from '@wagmi/core';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { bsc, bscTestnet } from '@reown/appkit/networks';

// WalletConnect Project ID - Get yours at https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '';

if (!projectId) {
  console.warn('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set. Wallet connection may not work properly.');
}

// Supported networks
export const networks = [bsc, bscTestnet] as const;

// Create Wagmi Adapter for Reown AppKit
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks: [...networks],
});

// Export the wagmi config for use with wagmi hooks
export const config = wagmiAdapter.wagmiConfig;

// Export chain configurations for easy access
export const supportedChains = {
  bsc,
  bscTestnet,
} as const;

// Contract addresses (to be updated after deployment)
export const contracts = {
  [bsc.id]: {
    pngyVault: '0x0000000000000000000000000000000000000000' as const,
    usdt: '0x55d398326f99059fF775485246999027B3197955' as const, // BSC USDT
  },
  [bscTestnet.id]: {
    pngyVault: '0x0000000000000000000000000000000000000000' as const,
    usdt: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd' as const, // Testnet USDT
  },
} as const;

// App metadata for Reown AppKit
export const metadata = {
  name: 'Paimon Yield Protocol',
  description: 'RWA Yield Aggregator on BSC',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://paimon.finance',
  icons: ['/logo.png'],
};
