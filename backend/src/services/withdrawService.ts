/**
 * Large Withdrawal Service
 * Task #59 - 实现大额赎回优先通道
 *
 * This service:
 * - Detects large withdrawals (≥$100K)
 * - Notifies protocol administrators via email/Telegram
 * - Records large withdrawal requests in PostgreSQL
 * - Provides priority processing (T+0.5 target)
 * - Exposes status for frontend display
 */

import { prisma } from './database.js';
import { addBroadcastNotificationJob } from '../jobs/notificationQueue.js';
import type { LargeWithdrawalStatus } from '@prisma/client';

// =============================================================================
// Configuration
// =============================================================================

// Large withdrawal threshold: $100,000 USD (in wei, 18 decimals)
export const LARGE_WITHDRAWAL_THRESHOLD = BigInt('100000000000000000000000'); // 100,000 * 1e18

// Admin notification channels
const ADMIN_EMAILS = (process.env.ADMIN_NOTIFICATION_EMAILS || '').split(',').filter(Boolean);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

// =============================================================================
// Types
// =============================================================================

export interface LargeWithdrawalRequest {
  userAddress: string;
  shares: bigint;
  estimatedAmount: bigint;
  requestTxHash?: string;
}

export interface LargeWithdrawalInfo {
  id: string;
  userAddress: string;
  shares: string;
  estimatedAmount: string;
  actualAmount: string | null;
  status: LargeWithdrawalStatus;
  priority: number;
  requestedAt: Date;
  processedAt: Date | null;
  completedAt: Date | null;
  estimatedCompletionTime: Date | null;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Check if a withdrawal amount qualifies as "large"
 */
export function isLargeWithdrawal(amountUsd: bigint): boolean {
  return amountUsd >= LARGE_WITHDRAWAL_THRESHOLD;
}

/**
 * Detect and process a large withdrawal request
 * Called when a withdrawal is detected that exceeds the threshold
 */
export async function processLargeWithdrawal(
  request: LargeWithdrawalRequest
): Promise<LargeWithdrawalInfo> {
  console.log(`[WithdrawService] Processing large withdrawal request from ${request.userAddress}`);
  console.log(`  - Shares: ${request.shares.toString()}`);
  console.log(`  - Estimated Amount: $${Number(request.estimatedAmount / BigInt(1e18)).toLocaleString()}`);

  // Create large withdrawal record
  const withdrawal = await prisma.largeWithdrawal.create({
    data: {
      userAddress: request.userAddress,
      shares: request.shares.toString(),
      estimatedAmount: request.estimatedAmount.toString(),
      requestTxHash: request.requestTxHash,
      status: 'PENDING',
      priority: calculatePriority(request.estimatedAmount),
    },
  });

  console.log(`[WithdrawService] Large withdrawal created: ${withdrawal.id}`);

  // Notify administrators
  await notifyAdminsOfLargeWithdrawal({
    id: withdrawal.id,
    userAddress: request.userAddress,
    shares: request.shares.toString(),
    estimatedAmount: request.estimatedAmount.toString(),
    priority: withdrawal.priority,
  });

  return formatWithdrawalInfo(withdrawal);
}

/**
 * Calculate priority based on withdrawal amount
 * Higher amounts get higher priority (lower number = higher priority)
 */
function calculatePriority(amountUsd: bigint): number {
  const amountNumber = Number(amountUsd / BigInt(1e18));

  if (amountNumber >= 1000000) return 1; // $1M+ - Highest priority
  if (amountNumber >= 500000) return 2;  // $500K-$1M
  if (amountNumber >= 250000) return 3;  // $250K-$500K
  if (amountNumber >= 100000) return 4;  // $100K-$250K (threshold)
  return 5; // Below threshold (shouldn't happen)
}

/**
 * Get large withdrawal status for a user
 */
export async function getUserLargeWithdrawals(
  userAddress: string
): Promise<LargeWithdrawalInfo[]> {
  const withdrawals = await prisma.largeWithdrawal.findMany({
    where: { userAddress },
    orderBy: { requestedAt: 'desc' },
    take: 10,
  });

  return withdrawals.map(formatWithdrawalInfo);
}

/**
 * Get a specific large withdrawal by ID
 */
export async function getLargeWithdrawalById(
  id: string
): Promise<LargeWithdrawalInfo | null> {
  const withdrawal = await prisma.largeWithdrawal.findUnique({
    where: { id },
  });

  if (!withdrawal) return null;
  return formatWithdrawalInfo(withdrawal);
}

/**
 * Get all pending large withdrawals (for admin dashboard)
 */
export async function getPendingLargeWithdrawals(): Promise<LargeWithdrawalInfo[]> {
  const withdrawals = await prisma.largeWithdrawal.findMany({
    where: {
      status: {
        in: ['PENDING', 'APPROVED', 'PROCESSING', 'READY'],
      },
    },
    orderBy: [
      { priority: 'asc' },
      { requestedAt: 'asc' },
    ],
  });

  return withdrawals.map(formatWithdrawalInfo);
}

/**
 * Update large withdrawal status (admin action)
 */
export async function updateLargeWithdrawalStatus(
  id: string,
  status: LargeWithdrawalStatus,
  adminNotes?: string
): Promise<LargeWithdrawalInfo> {
  const updateData: Record<string, unknown> = {
    status,
    adminNotes,
  };

  // Set timestamps based on status
  if (status === 'APPROVED' || status === 'PROCESSING') {
    updateData.processedAt = new Date();
  } else if (status === 'COMPLETED') {
    updateData.completedAt = new Date();
  }

  const withdrawal = await prisma.largeWithdrawal.update({
    where: { id },
    data: updateData,
  });

  console.log(`[WithdrawService] Large withdrawal ${id} status updated to ${status}`);

  // Notify user of status change
  await notifyUserOfStatusChange(withdrawal);

  return formatWithdrawalInfo(withdrawal);
}

/**
 * Complete a large withdrawal with actual amount
 */
export async function completeLargeWithdrawal(
  id: string,
  completeTxHash: string,
  actualAmount: bigint
): Promise<LargeWithdrawalInfo> {
  const withdrawal = await prisma.largeWithdrawal.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completeTxHash,
      actualAmount: actualAmount.toString(),
      completedAt: new Date(),
    },
  });

  console.log(`[WithdrawService] Large withdrawal ${id} completed: ${completeTxHash}`);

  // Notify user of completion
  await notifyUserOfStatusChange(withdrawal);

  return formatWithdrawalInfo(withdrawal);
}

// =============================================================================
// Admin Notification Functions
// =============================================================================

interface AdminNotificationData {
  id: string;
  userAddress: string;
  shares: string;
  estimatedAmount: string;
  priority: number;
}

/**
 * Notify administrators of a new large withdrawal request
 */
async function notifyAdminsOfLargeWithdrawal(data: AdminNotificationData): Promise<void> {
  const amountUsd = Number(BigInt(data.estimatedAmount) / BigInt(1e18));
  const message = formatAdminNotificationMessage(data, amountUsd);

  console.log('[WithdrawService] Notifying admins of large withdrawal');
  console.log(message);

  // Send email notifications via the existing notification queue
  try {
    await addBroadcastNotificationJob(
      'LARGE_WITHDRAWAL_ALERT',
      {
        id: data.id,
        userAddress: data.userAddress,
        shares: data.shares,
        estimatedAmount: `$${amountUsd.toLocaleString()}`,
        priority: data.priority,
        timestamp: new Date().toISOString(),
      },
      'critical' // High priority for admin alerts
    );
  } catch (error) {
    console.error('[WithdrawService] Failed to queue admin notification:', error);
  }

  // Send Telegram notification if configured
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    await sendTelegramNotification(message);
  }
}

/**
 * Format admin notification message
 */
function formatAdminNotificationMessage(data: AdminNotificationData, amountUsd: number): string {
  const priorityLabel = ['', '🔴 CRITICAL', '🟠 HIGH', '🟡 MEDIUM', '🟢 NORMAL', '⚪ LOW'][data.priority];

  return `
🚨 LARGE WITHDRAWAL ALERT ${priorityLabel}

📋 Request ID: ${data.id}
👤 User: ${data.userAddress}
💰 Amount: $${amountUsd.toLocaleString()} USD
🎫 Shares: ${data.shares}
⏰ Time: ${new Date().toISOString()}

🎯 Target: T+0.5 (12 hours)

Please review and process this withdrawal request.
Admin Dashboard: ${process.env.ADMIN_DASHBOARD_URL || 'https://admin.paimon.finance'}
`.trim();
}

/**
 * Send Telegram notification to admin group
 */
async function sendTelegramNotification(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      console.error('[WithdrawService] Telegram notification failed:', await response.text());
    } else {
      console.log('[WithdrawService] Telegram notification sent');
    }
  } catch (error) {
    console.error('[WithdrawService] Failed to send Telegram notification:', error);
  }
}

/**
 * Notify user when their large withdrawal status changes
 */
async function notifyUserOfStatusChange(withdrawal: {
  id: string;
  userAddress: string;
  status: LargeWithdrawalStatus;
  estimatedAmount: unknown;
}): Promise<void> {
  const statusMessages: Record<LargeWithdrawalStatus, string> = {
    PENDING: 'Your large withdrawal request has been received and is awaiting review.',
    APPROVED: 'Your large withdrawal has been approved and is being processed.',
    PROCESSING: 'Your large withdrawal is being processed. Funds are being prepared.',
    READY: 'Your large withdrawal is ready! You can complete the withdrawal now.',
    COMPLETED: 'Your large withdrawal has been completed successfully.',
    REJECTED: 'Your large withdrawal request has been rejected. Please contact support.',
    CANCELLED: 'Your large withdrawal request has been cancelled.',
  };

  // Queue notification to user
  // This will use the existing notification system
  console.log(`[WithdrawService] Notifying user ${withdrawal.userAddress} of status: ${withdrawal.status}`);
  console.log(`  - Message: ${statusMessages[withdrawal.status]}`);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format withdrawal record for API response
 */
function formatWithdrawalInfo(withdrawal: {
  id: string;
  userAddress: string;
  shares: unknown;
  estimatedAmount: unknown;
  actualAmount: unknown;
  status: LargeWithdrawalStatus;
  priority: number;
  requestedAt: Date;
  processedAt: Date | null;
  completedAt: Date | null;
}): LargeWithdrawalInfo {
  // Calculate estimated completion time (T+0.5 = 12 hours from request)
  const estimatedCompletionTime = new Date(withdrawal.requestedAt);
  estimatedCompletionTime.setHours(estimatedCompletionTime.getHours() + 12);

  return {
    id: withdrawal.id,
    userAddress: withdrawal.userAddress,
    shares: withdrawal.shares?.toString() || '0',
    estimatedAmount: withdrawal.estimatedAmount?.toString() || '0',
    actualAmount: withdrawal.actualAmount?.toString() || null,
    status: withdrawal.status,
    priority: withdrawal.priority,
    requestedAt: withdrawal.requestedAt,
    processedAt: withdrawal.processedAt,
    completedAt: withdrawal.completedAt,
    estimatedCompletionTime:
      withdrawal.status === 'COMPLETED' || withdrawal.status === 'REJECTED' || withdrawal.status === 'CANCELLED'
        ? null
        : estimatedCompletionTime,
  };
}

/**
 * Get statistics for large withdrawals
 */
export async function getLargeWithdrawalStats(): Promise<{
  totalPending: number;
  totalProcessing: number;
  totalCompleted: number;
  totalValue: string;
  avgProcessingTimeHours: number;
}> {
  const [pending, processing, completed] = await Promise.all([
    prisma.largeWithdrawal.count({ where: { status: 'PENDING' } }),
    prisma.largeWithdrawal.count({
      where: { status: { in: ['APPROVED', 'PROCESSING', 'READY'] } },
    }),
    prisma.largeWithdrawal.count({ where: { status: 'COMPLETED' } }),
  ]);

  // Calculate total value of pending/processing withdrawals
  const activeWithdrawals = await prisma.largeWithdrawal.findMany({
    where: {
      status: { in: ['PENDING', 'APPROVED', 'PROCESSING', 'READY'] },
    },
    select: { estimatedAmount: true },
  });

  const totalValue = activeWithdrawals.reduce(
    (sum, w) => sum + BigInt(w.estimatedAmount.toString()),
    BigInt(0)
  );

  // Calculate average processing time for completed withdrawals
  const completedWithdrawals = await prisma.largeWithdrawal.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { not: null },
    },
    select: { requestedAt: true, completedAt: true },
    take: 100,
    orderBy: { completedAt: 'desc' },
  });

  let avgProcessingTimeHours = 0;
  if (completedWithdrawals.length > 0) {
    const totalHours = completedWithdrawals.reduce((sum, w) => {
      if (!w.completedAt) return sum;
      const hours = (w.completedAt.getTime() - w.requestedAt.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    avgProcessingTimeHours = totalHours / completedWithdrawals.length;
  }

  return {
    totalPending: pending,
    totalProcessing: processing,
    totalCompleted: completed,
    totalValue: totalValue.toString(),
    avgProcessingTimeHours: Math.round(avgProcessingTimeHours * 10) / 10,
  };
}

export default {
  isLargeWithdrawal,
  processLargeWithdrawal,
  getUserLargeWithdrawals,
  getLargeWithdrawalById,
  getPendingLargeWithdrawals,
  updateLargeWithdrawalStatus,
  completeLargeWithdrawal,
  getLargeWithdrawalStats,
  LARGE_WITHDRAWAL_THRESHOLD,
};
