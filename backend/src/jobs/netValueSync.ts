import cron from 'node-cron';
import { publicClient } from '../services/blockchain.js';
// Future use: import { contracts, formatTokenAmount } from '../services/blockchain.js';

// Schedule: Every hour at minute 0
const SCHEDULE = '0 * * * *';

interface NetValueRecord {
  timestamp: Date;
  totalAssets: string;
  sharePrice: string;
  blockNumber: bigint;
}

// Job state
let isRunning = false;
let lastRun: Date | null = null;

async function syncNetValue(): Promise<NetValueRecord | null> {
  if (isRunning) {
    console.warn('[NetValueSync] Job already running, skipping...');
    return null;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.warn('[NetValueSync] Starting net value sync...');

    const blockNumber = await publicClient.getBlockNumber();

    // TODO: Read from actual vault contract
    // const totalAssets = await publicClient.readContract({
    //   address: contracts.pngyVault!,
    //   abi: VAULT_ABI,
    //   functionName: 'totalAssets',
    // });

    const record: NetValueRecord = {
      timestamp: new Date(),
      totalAssets: '0',
      sharePrice: '1000000000000000000', // 1e18
      blockNumber,
    };

    // TODO: Save to database via Prisma

    lastRun = new Date();
    const duration = Date.now() - startTime;
    console.warn(`[NetValueSync] Completed in ${duration}ms at block ${blockNumber}`);

    return record;
  } catch (error) {
    console.error('[NetValueSync] Error:', error);
    return null;
  } finally {
    isRunning = false;
  }
}

// Start the cron job
export function startNetValueSyncJob(): void {
  console.warn(`[NetValueSync] Scheduling job with pattern: ${SCHEDULE}`);

  cron.schedule(SCHEDULE, () => {
    syncNetValue().catch(console.error);
  });

  // Run immediately on start
  syncNetValue().catch(console.error);
}

// Export for manual trigger
export { syncNetValue };

// Export status
export function getJobStatus() {
  return {
    isRunning,
    lastRun,
    schedule: SCHEDULE,
  };
}
