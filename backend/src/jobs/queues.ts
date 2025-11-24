import { Queue, QueueEvents } from 'bullmq';
import { getRedisOptions } from '../config/redis.js';

// =============================================================================
// Queue Definitions
// =============================================================================

const connection = getRedisOptions();

// Net Value Sync Queue - Syncs vault NAV from blockchain
export const netValueSyncQueue = new Queue('net-value-sync', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  },
});

// Transaction Sync Queue - Indexes deposit/withdraw events
export const transactionSyncQueue = new Queue('transaction-sync', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 500,
    },
    removeOnFail: {
      count: 100,
    },
  },
});

// Rebalance Queue - Triggers portfolio rebalancing calculations
export const rebalanceQueue = new Queue('rebalance', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
    removeOnComplete: {
      count: 50,
    },
    removeOnFail: {
      count: 20,
    },
  },
});

// Notification Queue - Sends alerts and notifications
export const notificationQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 200,
    },
    removeOnFail: {
      count: 50,
    },
  },
});

// =============================================================================
// Queue Events (for monitoring)
// =============================================================================

export const netValueSyncEvents = new QueueEvents('net-value-sync', { connection });
export const transactionSyncEvents = new QueueEvents('transaction-sync', { connection });
export const rebalanceEvents = new QueueEvents('rebalance', { connection });
export const notificationEvents = new QueueEvents('notifications', { connection });

// =============================================================================
// Job Types
// =============================================================================

export interface NetValueSyncJobData {
  blockNumber?: bigint;
  force?: boolean;
}

export interface TransactionSyncJobData {
  fromBlock: bigint;
  toBlock: bigint;
  eventType?: 'Deposit' | 'Withdraw' | 'all';
}

export interface RebalanceJobData {
  reason: 'scheduled' | 'threshold' | 'manual';
  targetAllocations?: Record<string, number>;
}

export interface NotificationJobData {
  type: 'deposit' | 'withdraw' | 'rebalance' | 'alert';
  userAddress?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Helper Functions
// =============================================================================

export async function addNetValueSyncJob(data: NetValueSyncJobData = {}) {
  return netValueSyncQueue.add('sync', data, {
    jobId: `nav-sync-${Date.now()}`,
  });
}

export async function addTransactionSyncJob(data: TransactionSyncJobData) {
  return transactionSyncQueue.add('sync', {
    ...data,
    fromBlock: data.fromBlock.toString(),
    toBlock: data.toBlock.toString(),
  });
}

export async function addRebalanceJob(data: RebalanceJobData) {
  return rebalanceQueue.add('calculate', data, {
    jobId: `rebalance-${Date.now()}`,
  });
}

export async function addNotificationJob(data: NotificationJobData) {
  return notificationQueue.add('send', data);
}

// =============================================================================
// Scheduled Jobs (Repeatable)
// =============================================================================

export async function setupScheduledJobs() {
  // Sync NAV every hour
  await netValueSyncQueue.add(
    'scheduled-sync',
    { force: false },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour at minute 0
      },
      jobId: 'hourly-nav-sync',
    }
  );

  // Check rebalance thresholds every 6 hours
  await rebalanceQueue.add(
    'scheduled-check',
    { reason: 'scheduled' },
    {
      repeat: {
        pattern: '0 */6 * * *', // Every 6 hours
      },
      jobId: 'rebalance-check',
    }
  );

  console.warn('[Queues] Scheduled jobs configured');
}

// =============================================================================
// Cleanup
// =============================================================================

export async function closeQueues() {
  await Promise.all([
    netValueSyncQueue.close(),
    transactionSyncQueue.close(),
    rebalanceQueue.close(),
    notificationQueue.close(),
    netValueSyncEvents.close(),
    transactionSyncEvents.close(),
    rebalanceEvents.close(),
    notificationEvents.close(),
  ]);
}
