import { createPublicClient, http, formatUnits } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

// Select chain based on environment
const chain = process.env.NODE_ENV === 'production' ? bsc : bscTestnet;

// Create public client for read operations
export const publicClient = createPublicClient({
  chain,
  transport: http(
    process.env.NODE_ENV === 'production'
      ? process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org'
      : process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545'
  ),
});

// Contract addresses (to be updated after deployment)
export const contracts = {
  pngyVault: process.env.PNGY_VAULT_ADDRESS as `0x${string}` | undefined,
  usdt:
    process.env.NODE_ENV === 'production'
      ? ('0x55d398326f99059fF775485246999027B3197955' as const) // BSC USDT
      : ('0x337610d27c682E347C9cD60BD4b3b107C9d34dDd' as const), // Testnet USDT
};

// Helper to format BigInt to human-readable string
export function formatTokenAmount(amount: bigint, decimals = 18): string {
  return formatUnits(amount, decimals);
}

// Get current block number
export async function getCurrentBlock(): Promise<bigint> {
  return publicClient.getBlockNumber();
}
