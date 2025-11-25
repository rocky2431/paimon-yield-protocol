import { Worker, Job } from 'bullmq';
import { getRedisOptions } from '../config/redis.js';
import { sendNotification, broadcastNotification } from '../services/emailService.js';
import type { NotificationType } from '@prisma/client';
import type {
  NetValueSyncJobData,
  TransactionSyncJobData,
  RebalanceJobData,
  NotificationJobData,
} from './queues.js';

const connection = getRedisOptions();

// =============================================================================
// Net Value Sync Worker
// =============================================================================

export const netValueSyncWorker = new Worker<NetValueSyncJobData>(
  'net-value-sync',
  async (job: Job<NetValueSyncJobData>) => {
    console.warn(`[NetValueSync] Processing job ${job.id}`);

    try {
      // TODO: Implement actual NAV sync logic
      // 1. Read totalAssets from vault contract
      // 2. Read totalShares from vault contract
      // 3. Calculate share price
      // 4. Save to database via Prisma

      await job.updateProgress(50);

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 100));

      await job.updateProgress(100);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        message: 'NAV sync completed',
      };
    } catch (error) {
      console.error(`[NetValueSync] Job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Only one NAV sync at a time
  }
);

// =============================================================================
// Transaction Sync Worker
// =============================================================================

export const transactionSyncWorker = new Worker<TransactionSyncJobData>(
  'transaction-sync',
  async (job: Job<TransactionSyncJobData>) => {
    const { fromBlock, toBlock, eventType } = job.data;
    console.warn(`[TransactionSync] Processing blocks ${fromBlock}-${toBlock}, type: ${eventType || 'all'}`);

    try {
      // TODO: Implement actual transaction indexing
      // 1. Query Deposit/Withdraw events from vault contract
      // 2. Parse event data
      // 3. Create/update user records
      // 4. Save transactions to database

      await job.updateProgress(100);

      return {
        success: true,
        blocksProcessed: Number(BigInt(toBlock) - BigInt(fromBlock)),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[TransactionSync] Job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 3, // Can process multiple block ranges in parallel
  }
);

// =============================================================================
// Rebalance Worker
// =============================================================================

export const rebalanceWorker = new Worker<RebalanceJobData>(
  'rebalance',
  async (job: Job<RebalanceJobData>) => {
    const { reason, targetAllocations } = job.data;
    console.warn(`[Rebalance] Processing rebalance request, reason: ${reason}`);

    try {
      // TODO: Implement rebalance calculation
      // 1. Get current asset allocations
      // 2. Get target allocations
      // 3. Calculate required trades
      // 4. If manual trigger with multisig, prepare transaction

      await job.updateProgress(100);

      return {
        success: true,
        reason,
        hasTargets: !!targetAllocations,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[Rebalance] Job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Only one rebalance calculation at a time
  }
);

// =============================================================================
// Notification Worker
// =============================================================================

export const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  async (job: Job<NotificationJobData>) => {
    const { type, userAddress, data, priority } = job.data;
    const attemptNumber = job.attemptsMade + 1;

    console.log(
      `[Notification] Processing job ${job.id} (attempt ${attemptNumber}/${job.opts.attempts || 3})`,
      { type, userAddress: userAddress || 'broadcast', priority }
    );

    try {
      await job.updateProgress(10);

      let result;

      if (userAddress) {
        // Send to specific user
        console.log(`[Notification] Sending ${type} notification to user ${userAddress}`);
        result = await sendNotification({
          userAddress,
          type: type as NotificationType,
          data,
        });
      } else {
        // Broadcast to all subscribed users
        console.log(`[Notification] Broadcasting ${type} notification to all subscribers`);
        result = await broadcastNotification(type as NotificationType, data);
      }

      await job.updateProgress(100);

      const response = {
        success: true,
        type,
        recipient: userAddress || 'broadcast',
        timestamp: new Date().toISOString(),
        ...(userAddress
          ? { messageId: result.messageId, error: result.error }
          : { sent: (result as { sent: number; failed: number }).sent, failed: (result as { sent: number; failed: number }).failed }),
      };

      console.log(`[Notification] Job ${job.id} completed:`, response);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Notification] Job ${job.id} failed (attempt ${attemptNumber}):`, errorMessage);

      // Re-throw to trigger retry
      throw error;
    }
  },
  {
    connection,
    concurrency: 10, // Can send many notifications in parallel
    limiter: {
      max: 50, // Max 50 jobs per time window
      duration: 60000, // 1 minute window (rate limit protection)
    },
  }
);

// =============================================================================
// Worker Event Handlers
// =============================================================================

const workers = [netValueSyncWorker, transactionSyncWorker, rebalanceWorker, notificationWorker];

workers.forEach((worker) => {
  worker.on('completed', (job) => {
    console.warn(`[${worker.name}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[${worker.name}] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[${worker.name}] Worker error:`, err.message);
  });
});

// =============================================================================
// Start/Stop Workers
// =============================================================================

export function startWorkers(): void {
  console.warn('[Workers] Starting all workers...');
  // Workers start automatically when created
  // This function is for explicit initialization if needed
}

export async function stopWorkers() {
  console.warn('[Workers] Stopping all workers...');
  await Promise.all(workers.map((worker) => worker.close()));
}
