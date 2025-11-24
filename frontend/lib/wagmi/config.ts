import { http, createConfig } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// WalletConnect Project ID - Get yours at https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

export const config = getDefaultConfig({
  appName: 'Paimon Yield Protocol',
  projectId,
  chains: [bsc, bscTestnet],
  transports: {
    [bsc.id]: http('https://bsc-dataseed.binance.org'),
    [bscTestnet.id]: http('https://data-seed-prebsc-1-s1.binance.org:8545'),
  },
  ssr: true,
});

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
