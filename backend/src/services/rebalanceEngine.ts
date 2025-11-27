/**
 * Rebalance Engine - Off-chain rebalancing service
 * Task #60 - 实现链下再平衡引擎
 *
 * This service:
 * - Periodically checks RWA asset APY changes (daily)
 * - Calculates optimal allocation using RebalanceStrategy contract
 * - Generates rebalance transactions if deviation > 5%
 * - Submits transactions to Gnosis Safe for multi-sig approval
 */

import { createPublicClient, createWalletClient, http, formatUnits, parseUnits, encodeFunctionData, type Address, type Hex } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { prisma } from './database.js';
import { addBroadcastNotificationJob } from '../jobs/notificationQueue.js';

// =============================================================================
// Types
// =============================================================================

export interface AssetData {
  token: Address;
  currentAllocation: bigint; // basis points (0-10000)
  currentValue: bigint; // USD value (18 decimals)
  apy: bigint; // basis points (e.g., 500 = 5%)
}

export interface AllocationResult {
  token: Address;
  targetAllocation: bigint; // basis points
  allocationDelta: bigint; // change needed (can be negative)
}

export interface RebalanceTx {
  token: Address;
  isBuy: boolean;
  amount: bigint;
  usdValue: bigint;
}

export interface RebalanceProposal {
  sellAssets: Address[];
  sellAmounts: bigint[];
  buyAssets: Address[];
  buyAmounts: bigint[];
  newAllocations: bigint[];
  totalValue: bigint;
  maxDeviation: number;
  estimatedGas: bigint;
}

// =============================================================================
// Constants
// =============================================================================

const DEVIATION_THRESHOLD = 500; // 5% in basis points
const BASIS_POINTS = 10000n;
const PRECISION = 10n ** 18n;

// Contract ABIs (minimal for rebalancing)
const REBALANCE_STRATEGY_ABI = [
  {
    name: 'calculateOptimalAllocation',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      {
        name: 'assets',
        type: 'tuple[]',
        components: [
          { name: 'token', type: 'address' },
          { name: 'currentAllocation', type: 'uint256' },
          { name: 'currentValue', type: 'uint256' },
          { name: 'apy', type: 'uint256' },
        ],
      },
    ],
    outputs: [
      {
        name: 'allocations',
        type: 'tuple[]',
        components: [
          { name: 'token', type: 'address' },
          { name: 'targetAllocation', type: 'uint256' },
          { name: 'allocationDelta', type: 'int256' },
        ],
      },
    ],
  },
  {
    name: 'isRebalanceNeeded',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      {
        name: 'assets',
        type: 'tuple[]',
        components: [
          { name: 'token', type: 'address' },
          { name: 'currentAllocation', type: 'uint256' },
          { name: 'currentValue', type: 'uint256' },
          { name: 'apy', type: 'uint256' },
        ],
      },
      { name: 'targetAllocations', type: 'uint256[]' },
    ],
    outputs: [
      { name: 'needed', type: 'bool' },
      { name: 'maxDeviation', type: 'uint256' },
    ],
  },
  {
    name: 'generateRebalanceTx',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      {
        name: 'assets',
        type: 'tuple[]',
        components: [
          { name: 'token', type: 'address' },
          { name: 'currentAllocation', type: 'uint256' },
          { name: 'currentValue', type: 'uint256' },
          { name: 'apy', type: 'uint256' },
        ],
      },
      { name: 'targetAllocations', type: 'uint256[]' },
      { name: 'totalValue', type: 'uint256' },
    ],
    outputs: [
      {
        name: 'txs',
        type: 'tuple[]',
        components: [
          { name: 'token', type: 'address' },
          { name: 'isBuy', type: 'bool' },
          { name: 'amount', type: 'uint256' },
          { name: 'usdValue', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

const PNGY_VAULT_ABI = [
  {
    name: 'rebalanceWithNewAllocations',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sellAssets', type: 'address[]' },
      { name: 'sellAmounts', type: 'uint256[]' },
      { name: 'buyAssets', type: 'address[]' },
      { name: 'buyAmounts', type: 'uint256[]' },
      { name: 'newAllocations', type: 'uint256[]' },
    ],
    outputs: [
      { name: 'sellReceived', type: 'uint256[]' },
      { name: 'buyReceived', type: 'uint256[]' },
    ],
  },
] as const;

// =============================================================================
// Client Setup
// =============================================================================

const chain = process.env.NODE_ENV === 'production' ? bsc : bscTestnet;

const publicClient = createPublicClient({
  chain,
  transport: http(
    process.env.NODE_ENV === 'production'
      ? process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org'
      : process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545'
  ),
});

// Contract addresses
const getContractAddresses = () => ({
  pngyVault: process.env.PNGY_VAULT_ADDRESS as Address | undefined,
  rebalanceStrategy: process.env.REBALANCE_STRATEGY_ADDRESS as Address | undefined,
  gnosisSafe: process.env.GNOSIS_SAFE_ADDRESS as Address | undefined,
});

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Fetch current asset data from database and blockchain
 */
export async function fetchAssetData(): Promise<AssetData[]> {
  const allocations = await prisma.assetAllocation.findMany({
    where: { isActive: true },
  });

  return allocations.map((alloc) => ({
    token: alloc.tokenAddress as Address,
    currentAllocation: BigInt(Math.round(Number(alloc.allocation) * 10000)), // Convert to basis points
    currentValue: BigInt(alloc.valueUsd.toString()),
    apy: BigInt(Math.round(Number(alloc.apy) * 100)), // Convert to basis points (5.26% -> 526)
  }));
}

/**
 * Calculate optimal allocations using the RebalanceStrategy contract
 */
export async function calculateOptimalAllocations(
  assets: AssetData[]
): Promise<AllocationResult[]> {
  const addresses = getContractAddresses();

  if (!addresses.rebalanceStrategy) {
    throw new Error('RebalanceStrategy contract address not configured');
  }

  const result = await publicClient.readContract({
    address: addresses.rebalanceStrategy,
    abi: REBALANCE_STRATEGY_ABI,
    functionName: 'calculateOptimalAllocation',
    args: [assets],
  });

  return result.map((r) => ({
    token: r.token,
    targetAllocation: r.targetAllocation,
    allocationDelta: r.allocationDelta,
  }));
}

/**
 * Check if rebalancing is needed based on deviation threshold
 */
export async function checkRebalanceNeeded(
  assets: AssetData[],
  targetAllocations: bigint[]
): Promise<{ needed: boolean; maxDeviation: number }> {
  const addresses = getContractAddresses();

  if (!addresses.rebalanceStrategy) {
    throw new Error('RebalanceStrategy contract address not configured');
  }

  const [needed, maxDeviation] = await publicClient.readContract({
    address: addresses.rebalanceStrategy,
    abi: REBALANCE_STRATEGY_ABI,
    functionName: 'isRebalanceNeeded',
    args: [assets, targetAllocations],
  });

  return {
    needed,
    maxDeviation: Number(maxDeviation) / 100, // Convert basis points to percentage
  };
}

/**
 * Generate rebalance transaction parameters
 */
export async function generateRebalanceTransactions(
  assets: AssetData[],
  targetAllocations: bigint[],
  totalValue: bigint
): Promise<RebalanceTx[]> {
  const addresses = getContractAddresses();

  if (!addresses.rebalanceStrategy) {
    throw new Error('RebalanceStrategy contract address not configured');
  }

  const txs = await publicClient.readContract({
    address: addresses.rebalanceStrategy,
    abi: REBALANCE_STRATEGY_ABI,
    functionName: 'generateRebalanceTx',
    args: [assets, targetAllocations, totalValue],
  });

  return txs.map((tx) => ({
    token: tx.token,
    isBuy: tx.isBuy,
    amount: tx.amount,
    usdValue: tx.usdValue,
  }));
}

/**
 * Create a rebalance proposal with all necessary data
 */
export async function createRebalanceProposal(): Promise<RebalanceProposal | null> {
  const addresses = getContractAddresses();

  if (!addresses.pngyVault) {
    throw new Error('PNGYVault contract address not configured');
  }

  // Fetch current asset data
  const assets = await fetchAssetData();

  if (assets.length === 0) {
    console.log('No active assets found, skipping rebalance check');
    return null;
  }

  // Calculate optimal allocations
  const optimalAllocations = await calculateOptimalAllocations(assets);
  const targetAllocations = optimalAllocations.map((a) => a.targetAllocation);

  // Check if rebalancing is needed
  const { needed, maxDeviation } = await checkRebalanceNeeded(assets, targetAllocations);

  if (!needed) {
    console.log(`Rebalance not needed. Max deviation: ${maxDeviation}% (threshold: 5%)`);
    return null;
  }

  console.log(`Rebalance needed! Max deviation: ${maxDeviation}%`);

  // Calculate total value
  const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0n);

  // Generate rebalance transactions
  const txs = await generateRebalanceTransactions(assets, targetAllocations, totalValue);

  // Separate buy and sell transactions
  const sellTxs = txs.filter((tx) => !tx.isBuy);
  const buyTxs = txs.filter((tx) => tx.isBuy);

  // Encode the transaction data for gas estimation
  const callData = encodeFunctionData({
    abi: PNGY_VAULT_ABI,
    functionName: 'rebalanceWithNewAllocations',
    args: [
      sellTxs.map((tx) => tx.token),
      sellTxs.map((tx) => tx.amount),
      buyTxs.map((tx) => tx.token),
      buyTxs.map((tx) => tx.amount),
      targetAllocations,
    ],
  });

  // Estimate gas
  let estimatedGas = 500000n; // Default estimate
  try {
    estimatedGas = await publicClient.estimateGas({
      to: addresses.pngyVault,
      data: callData,
    });
  } catch (error) {
    console.warn('Gas estimation failed, using default:', error);
  }

  return {
    sellAssets: sellTxs.map((tx) => tx.token),
    sellAmounts: sellTxs.map((tx) => tx.amount),
    buyAssets: buyTxs.map((tx) => tx.token),
    buyAmounts: buyTxs.map((tx) => tx.amount),
    newAllocations: targetAllocations,
    totalValue,
    maxDeviation,
    estimatedGas,
  };
}

/**
 * Encode rebalance transaction for Gnosis Safe
 */
export function encodeRebalanceTransaction(proposal: RebalanceProposal): Hex {
  return encodeFunctionData({
    abi: PNGY_VAULT_ABI,
    functionName: 'rebalanceWithNewAllocations',
    args: [
      proposal.sellAssets,
      proposal.sellAmounts,
      proposal.buyAssets,
      proposal.buyAmounts,
      proposal.newAllocations,
    ],
  });
}

/**
 * Submit rebalance proposal to Gnosis Safe
 * Note: This creates the transaction data for manual submission via Gnosis Safe UI
 * For automated submission, Gnosis Safe Transaction Service API integration is needed
 */
export async function submitToGnosisSafe(
  proposal: RebalanceProposal
): Promise<{ transactionData: Hex; to: Address; value: bigint; safeTxGas: bigint }> {
  const addresses = getContractAddresses();

  if (!addresses.pngyVault) {
    throw new Error('PNGYVault contract address not configured');
  }

  const transactionData = encodeRebalanceTransaction(proposal);

  // Log the proposal for manual submission
  console.log('=== Gnosis Safe Rebalance Transaction ===');
  console.log(`To: ${addresses.pngyVault}`);
  console.log(`Value: 0`);
  console.log(`Data: ${transactionData}`);
  console.log(`Safe Tx Gas: ${proposal.estimatedGas}`);
  console.log('==========================================');

  // Store the proposal in database for tracking
  await prisma.rebalanceHistory.create({
    data: {
      txHash: `pending-${Date.now()}`, // Placeholder until executed
      type: 'REBALANCE',
      fromAsset: proposal.sellAssets[0] || '0x0000000000000000000000000000000000000000',
      toAsset: proposal.buyAssets[0] || '0x0000000000000000000000000000000000000000',
      fromAmount: proposal.sellAmounts[0]?.toString() || '0',
      toAmount: proposal.buyAmounts[0]?.toString() || '0',
      blockNumber: BigInt(0), // Will be updated after execution
      timestamp: new Date(),
    },
  });

  return {
    transactionData,
    to: addresses.pngyVault,
    value: 0n,
    safeTxGas: proposal.estimatedGas,
  };
}

/**
 * Execute the full rebalance check and proposal flow
 * Called by the cron job daily
 */
export async function executeRebalanceCheck(): Promise<{
  checked: boolean;
  proposalCreated: boolean;
  proposal: RebalanceProposal | null;
  error?: string;
}> {
  try {
    console.log('Starting daily rebalance check...');

    // Check if contracts are configured
    const addresses = getContractAddresses();
    if (!addresses.pngyVault || !addresses.rebalanceStrategy) {
      console.log('Contracts not configured, skipping rebalance check');
      return {
        checked: false,
        proposalCreated: false,
        proposal: null,
        error: 'Contracts not configured',
      };
    }

    // Create rebalance proposal if needed
    const proposal = await createRebalanceProposal();

    if (!proposal) {
      console.log('No rebalance needed');
      return {
        checked: true,
        proposalCreated: false,
        proposal: null,
      };
    }

    // Submit to Gnosis Safe
    await submitToGnosisSafe(proposal);

    // Send notification about rebalance proposal
    try {
      await addBroadcastNotificationJob(
        'REBALANCE_EXECUTED',
        {
          type: 'proposal',
          maxDeviation: proposal.maxDeviation,
          totalValue: formatUnits(proposal.totalValue, 18),
          sellCount: proposal.sellAssets.length,
          buyCount: proposal.buyAssets.length,
        },
        'high'
      );
    } catch (notifyError) {
      console.warn('Failed to send rebalance notification:', notifyError);
    }

    console.log('Rebalance proposal created and submitted to Gnosis Safe');

    return {
      checked: true,
      proposalCreated: true,
      proposal,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Rebalance check failed:', errorMessage);

    return {
      checked: false,
      proposalCreated: false,
      proposal: null,
      error: errorMessage,
    };
  }
}

/**
 * Get rebalance status and history
 */
export async function getRebalanceStatus(): Promise<{
  lastCheck: Date | null;
  pendingProposals: number;
  recentRebalances: Array<{
    id: string;
    type: string;
    fromAsset: string;
    toAsset: string;
    fromAmount: string;
    toAmount: string;
    timestamp: Date;
  }>;
}> {
  const recentRebalances = await prisma.rebalanceHistory.findMany({
    take: 10,
    orderBy: { timestamp: 'desc' },
  });

  const pendingProposals = recentRebalances.filter(
    (r) => r.txHash.startsWith('pending-')
  ).length;

  return {
    lastCheck: recentRebalances[0]?.timestamp || null,
    pendingProposals,
    recentRebalances: recentRebalances.map((r) => ({
      id: r.id,
      type: r.type,
      fromAsset: r.fromAsset,
      toAsset: r.toAsset,
      fromAmount: r.fromAmount.toString(),
      toAmount: r.toAmount.toString(),
      timestamp: r.timestamp,
    })),
  };
}

export default {
  fetchAssetData,
  calculateOptimalAllocations,
  checkRebalanceNeeded,
  generateRebalanceTransactions,
  createRebalanceProposal,
  submitToGnosisSafe,
  executeRebalanceCheck,
  getRebalanceStatus,
};
