/**
 * Notification Queue Service
 * Task #57 - 实现通知系统 - Bull Queue 后台任务
 *
 * Provides helper functions for queuing different types of notifications
 * with appropriate priorities and retry configurations.
 */

import {
  notificationQueue,
  notificationEvents,
  addNotificationJob,
  addUserNotificationJob,
  addBroadcastNotificationJob,
  type NotificationJobData,
} from './queues.js';

// Re-export queue and helper functions
export {
  notificationQueue,
  notificationEvents,
  addNotificationJob,
  addUserNotificationJob,
  addBroadcastNotificationJob,
};
export type { NotificationJobData };

// =============================================================================
// Emergency Notification Functions
// =============================================================================

/**
 * Queue an emergency pause notification to all users
 * Uses critical priority for immediate processing
 */
export async function notifyEmergencyPause(reason: string): Promise<void> {
  console.log('[NotificationQueue] Queuing emergency pause notification');

  await addBroadcastNotificationJob(
    'EMERGENCY_PAUSE',
    {
      reason,
      timestamp: new Date().toISOString(),
    },
    'critical'
  );
}

/**
 * Queue a circuit breaker notification to all users
 * Uses critical priority for immediate processing
 */
export async function notifyCircuitBreaker(
  trigger: string,
  maxWithdrawal: string
): Promise<void> {
  console.log('[NotificationQueue] Queuing circuit breaker notification');

  await addBroadcastNotificationJob(
    'CIRCUIT_BREAKER',
    {
      trigger,
      maxWithdrawal,
      timestamp: new Date().toISOString(),
    },
    'critical'
  );
}

/**
 * Queue a withdrawal completion notification for a specific user
 */
export async function notifyWithdrawalComplete(
  userAddress: string,
  amount: string,
  shares: string,
  txHash: string
): Promise<void> {
  console.log(`[NotificationQueue] Queuing withdrawal notification for ${userAddress}`);

  await addUserNotificationJob(
    userAddress,
    'WITHDRAWAL_COMPLETE',
    {
      amount,
      shares,
      txHash,
    },
    'normal'
  );
}

/**
 * Queue a rebalance notification to all users
 */
export async function notifyRebalanceExecuted(
  fromAsset: string,
  toAsset: string,
  amount: string,
  txHash: string
): Promise<void> {
  console.log('[NotificationQueue] Queuing rebalance notification');

  await addBroadcastNotificationJob(
    'REBALANCE_EXECUTED',
    {
      fromAsset,
      toAsset,
      amount,
      txHash,
    },
    'normal'
  );
}

// =============================================================================
// Queue Monitoring
// =============================================================================

/**
 * Get queue statistics for monitoring
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
    notificationQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Get recent failed jobs for debugging
 */
export async function getRecentFailedJobs(limit = 10) {
  return notificationQueue.getFailed(0, limit - 1);
}

/**
 * Retry all failed jobs
 */
export async function retryAllFailedJobs(): Promise<number> {
  const failedJobs = await notificationQueue.getFailed(0, 100);
  let retried = 0;

  for (const job of failedJobs) {
    await job.retry();
    retried++;
  }

  console.log(`[NotificationQueue] Retried ${retried} failed jobs`);
  return retried;
}

/**
 * Clean old completed and failed jobs
 */
export async function cleanOldJobs(olderThanMs = 24 * 60 * 60 * 1000): Promise<void> {
  const grace = olderThanMs;

  await Promise.all([
    notificationQueue.clean(grace, 1000, 'completed'),
    notificationQueue.clean(grace, 100, 'failed'),
  ]);

  console.log(`[NotificationQueue] Cleaned jobs older than ${olderThanMs}ms`);
}

// =============================================================================
// Queue Event Listeners
// =============================================================================

/**
 * Setup queue event listeners for monitoring
 */
export function setupQueueMonitoring(): void {
  notificationEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`[NotificationQueue] Job ${jobId} completed:`, returnvalue);
  });

  notificationEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[NotificationQueue] Job ${jobId} failed:`, failedReason);
  });

  notificationEvents.on('stalled', ({ jobId }) => {
    console.warn(`[NotificationQueue] Job ${jobId} stalled`);
  });

  notificationEvents.on('progress', ({ jobId, data }) => {
    console.log(`[NotificationQueue] Job ${jobId} progress:`, data);
  });

  console.log('[NotificationQueue] Queue monitoring enabled');
}
