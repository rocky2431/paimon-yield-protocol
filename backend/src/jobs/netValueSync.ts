import cron from 'node-cron';
import { publicClient, contracts } from '../services/blockchain.js';
import { createNetValue, getLatestNetValue } from '../services/vault.service.js';
import { env } from '../config/env.js';

// =============================================================================
// Constants
// =============================================================================

// Schedule: Every hour at minute 0
const SCHEDULE = '0 * * * *';

// Default share price: 1e18 (1 USDT per share initially)
const DEFAULT_SHARE_PRICE = 10n ** 18n;

// =============================================================================
// ABI Definitions
// =============================================================================

const VAULT_ABI = [
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// =============================================================================
// Types
// =============================================================================

export interface NetValueRecord {
  timestamp: Date;
  totalAssets: bigint;
  totalShares: bigint;
  sharePrice: bigint;
  blockNumber: bigint;
}

export interface NetValueSyncResult {
  success: boolean;
  record?: NetValueRecord;
  error?: string;
  duration: number;
}

// =============================================================================
// Job State
// =============================================================================

let isRunning = false;
let lastRun: Date | null = null;
let lastError: string | null = null;

// =============================================================================
// Core Logic
// =============================================================================

/**
 * Calculate share price from total assets and total shares
 * NAV = totalAssets / totalShares (with 1e18 precision)
 */
export function calculateSharePrice(totalAssets: bigint, totalShares: bigint): bigint {
  if (totalShares === 0n) {
    return DEFAULT_SHARE_PRICE;
  }
  // Calculate NAV with 1e18 precision: (totalAssets * 1e18) / totalShares
  return (totalAssets * (10n ** 18n)) / totalShares;
}

/**
 * Fetch vault data from blockchain
 */
export async function fetchVaultData(): Promise<{
  totalAssets: bigint;
  totalShares: bigint;
  blockNumber: bigint;
}> {
  const vaultAddress = contracts.pngyVault;

  if (!vaultAddress) {
    throw new Error('PNGY_VAULT_ADDRESS not configured');
  }

  // Fetch data in parallel
  const [totalAssets, totalShares, blockNumber] = await Promise.all([
    publicClient.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'totalAssets',
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'totalSupply',
    }),
    publicClient.getBlockNumber(),
  ]);

  return {
    totalAssets: totalAssets as bigint,
    totalShares: totalShares as bigint,
    blockNumber,
  };
}

/**
 * Main sync function - fetches vault data, calculates NAV, stores in database
 */
export async function syncNetValue(): Promise<NetValueSyncResult> {
  if (isRunning) {
    console.log('[NetValueSync] Job already running, skipping...');
    return {
      success: false,
      error: 'Job already running',
      duration: 0,
    };
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log('[NetValueSync] Starting net value sync...');

    // Check if vault address is configured
    if (!contracts.pngyVault) {
      console.log('[NetValueSync] Vault address not configured, using mock data');
      const blockNumber = await publicClient.getBlockNumber();

      const record: NetValueRecord = {
        timestamp: new Date(),
        totalAssets: 0n,
        totalShares: 0n,
        sharePrice: DEFAULT_SHARE_PRICE,
        blockNumber,
      };

      // Save mock record to database
      await createNetValue({
        timestamp: record.timestamp,
        totalAssets: record.totalAssets,
        totalShares: record.totalShares,
        sharePrice: record.sharePrice,
        blockNumber: record.blockNumber,
      });

      lastRun = new Date();
      lastError = null;
      const duration = Date.now() - startTime;
      console.log(`[NetValueSync] Completed (mock) in ${duration}ms`);

      return { success: true, record, duration };
    }

    // Fetch actual data from vault contract
    const { totalAssets, totalShares, blockNumber } = await fetchVaultData();

    // Calculate share price (NAV)
    const sharePrice = calculateSharePrice(totalAssets, totalShares);

    const record: NetValueRecord = {
      timestamp: new Date(),
      totalAssets,
      totalShares,
      sharePrice,
      blockNumber,
    };

    // Store in database
    await createNetValue({
      timestamp: record.timestamp,
      totalAssets: record.totalAssets,
      totalShares: record.totalShares,
      sharePrice: record.sharePrice,
      blockNumber: record.blockNumber,
    });

    lastRun = new Date();
    lastError = null;
    const duration = Date.now() - startTime;

    console.log(
      `[NetValueSync] Completed in ${duration}ms at block ${blockNumber}`,
      `| totalAssets: ${totalAssets}`,
      `| totalShares: ${totalShares}`,
      `| sharePrice: ${sharePrice}`
    );

    return { success: true, record, duration };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    lastError = errorMessage;
    const duration = Date.now() - startTime;

    console.error('[NetValueSync] Error:', errorMessage);

    return {
      success: false,
      error: errorMessage,
      duration,
    };
  } finally {
    isRunning = false;
  }
}

// =============================================================================
// Job Management
// =============================================================================

let cronTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * Start the cron job
 */
export function startNetValueSyncJob(): void {
  if (cronTask) {
    console.log('[NetValueSync] Job already started');
    return;
  }

  console.log(`[NetValueSync] Scheduling job with pattern: ${SCHEDULE}`);

  cronTask = cron.schedule(SCHEDULE, () => {
    syncNetValue().catch(console.error);
  });

  // Run immediately on start (unless in test environment)
  if (env.NODE_ENV !== 'test') {
    syncNetValue().catch(console.error);
  }
}

/**
 * Stop the cron job
 */
export function stopNetValueSyncJob(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[NetValueSync] Job stopped');
  }
}

/**
 * Get job status
 */
export function getJobStatus() {
  return {
    isRunning,
    lastRun,
    lastError,
    schedule: SCHEDULE,
    vaultConfigured: !!contracts.pngyVault,
  };
}

/**
 * Get latest net value from database
 */
export async function getLatestNetValueRecord() {
  return getLatestNetValue();
}
