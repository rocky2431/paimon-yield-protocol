/**
 * Rebalance Cron Job
 * Task #60 - Daily rebalancing check
 *
 * Runs daily at 00:00 UTC to check if portfolio rebalancing is needed
 * based on RWA asset APY changes and allocation deviations.
 */

import * as cron from 'node-cron';
import { executeRebalanceCheck, getRebalanceStatus } from '../services/rebalanceEngine.js';

// =============================================================================
// Configuration
// =============================================================================

// Daily at 00:00 UTC
const REBALANCE_CRON_SCHEDULE = process.env.REBALANCE_CRON_SCHEDULE || '0 0 * * *';

// Enable/disable the job
const REBALANCE_JOB_ENABLED = process.env.REBALANCE_JOB_ENABLED !== 'false';

// =============================================================================
// Job State
// =============================================================================

let scheduledTask: cron.ScheduledTask | null = null;
let lastRunResult: {
  timestamp: Date;
  checked: boolean;
  proposalCreated: boolean;
  error?: string;
} | null = null;

// =============================================================================
// Job Functions
// =============================================================================

/**
 * Execute the rebalance check
 * This is the main job function called by the cron scheduler
 */
async function runRebalanceJob(): Promise<void> {
  console.log(`[RebalanceJob] Starting rebalance check at ${new Date().toISOString()}`);

  try {
    const result = await executeRebalanceCheck();

    lastRunResult = {
      timestamp: new Date(),
      checked: result.checked,
      proposalCreated: result.proposalCreated,
      error: result.error,
    };

    if (result.proposalCreated && result.proposal) {
      console.log(`[RebalanceJob] Rebalance proposal created!`);
      console.log(`  - Max deviation: ${result.proposal.maxDeviation}%`);
      console.log(`  - Sells: ${result.proposal.sellAssets.length} assets`);
      console.log(`  - Buys: ${result.proposal.buyAssets.length} assets`);
    } else if (result.checked) {
      console.log('[RebalanceJob] Check completed, no rebalance needed');
    } else {
      console.log(`[RebalanceJob] Check skipped: ${result.error}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[RebalanceJob] Failed:`, errorMessage);

    lastRunResult = {
      timestamp: new Date(),
      checked: false,
      proposalCreated: false,
      error: errorMessage,
    };
  }
}

/**
 * Start the rebalance cron job
 */
export function startRebalanceJob(): void {
  if (!REBALANCE_JOB_ENABLED) {
    console.log('[RebalanceJob] Job is disabled via REBALANCE_JOB_ENABLED=false');
    return;
  }

  if (scheduledTask) {
    console.log('[RebalanceJob] Job already running, skipping start');
    return;
  }

  console.log(`[RebalanceJob] Starting with schedule: ${REBALANCE_CRON_SCHEDULE}`);

  scheduledTask = cron.schedule(
    REBALANCE_CRON_SCHEDULE,
    async () => {
      await runRebalanceJob();
    },
    {
      scheduled: true,
      timezone: 'UTC',
    }
  );

  console.log('[RebalanceJob] Cron job started successfully');
}

/**
 * Stop the rebalance cron job
 */
export function stopRebalanceJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[RebalanceJob] Cron job stopped');
  }
}

/**
 * Manually trigger a rebalance check
 * Useful for testing or emergency rebalancing
 */
export async function triggerRebalanceCheck(): Promise<{
  checked: boolean;
  proposalCreated: boolean;
  error?: string;
}> {
  console.log('[RebalanceJob] Manual trigger requested');
  await runRebalanceJob();

  return lastRunResult || {
    checked: false,
    proposalCreated: false,
    error: 'Job not executed',
  };
}

/**
 * Get the current job status
 */
export function getJobStatus(): {
  enabled: boolean;
  running: boolean;
  schedule: string;
  lastRun: {
    timestamp: Date;
    checked: boolean;
    proposalCreated: boolean;
    error?: string;
  } | null;
} {
  return {
    enabled: REBALANCE_JOB_ENABLED,
    running: scheduledTask !== null,
    schedule: REBALANCE_CRON_SCHEDULE,
    lastRun: lastRunResult,
  };
}

/**
 * Get rebalance history and status
 */
export async function getRebalanceHistory() {
  return getRebalanceStatus();
}

export default {
  startRebalanceJob,
  stopRebalanceJob,
  triggerRebalanceCheck,
  getJobStatus,
  getRebalanceHistory,
};
