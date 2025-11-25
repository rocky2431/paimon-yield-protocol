/**
 * Email Service
 * Task #56 - 实现通知系统 - 邮件通知
 *
 * Uses Resend for sending transactional emails
 */

import { Resend } from 'resend';
import { env } from '../config/env.js';
import { prisma } from './database.js';
import type { NotificationType, NotificationStatus } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface NotificationContext {
  userAddress: string;
  type: NotificationType;
  data: Record<string, unknown>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================================================
// Email Client
// =============================================================================

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!env.EMAIL_ENABLED || !env.RESEND_API_KEY) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}

// =============================================================================
// Email Templates
// =============================================================================

export const emailTemplates = {
  withdrawalComplete: (data: {
    amount: string;
    shares: string;
    txHash: string;
  }) => ({
    subject: 'Your PNGY Withdrawal is Complete',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Withdrawal Complete</h1>
        <p>Your withdrawal request has been processed successfully.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Amount:</strong> ${data.amount} USDT</p>
          <p><strong>Shares Redeemed:</strong> ${data.shares} PNGY</p>
          <p><strong>Transaction:</strong> <a href="https://bscscan.com/tx/${data.txHash}">${data.txHash.slice(0, 10)}...${data.txHash.slice(-8)}</a></p>
        </div>
        <p>The funds have been transferred to your wallet.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Paimon Yield Protocol - RWA Yield Aggregator on BSC
        </p>
      </div>
    `,
    text: `Withdrawal Complete\n\nYour withdrawal request has been processed successfully.\n\nAmount: ${data.amount} USDT\nShares Redeemed: ${data.shares} PNGY\nTransaction: ${data.txHash}\n\nThe funds have been transferred to your wallet.`,
  }),

  rebalanceExecuted: (data: {
    fromAsset: string;
    toAsset: string;
    amount: string;
    txHash: string;
  }) => ({
    subject: 'Portfolio Rebalance Executed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Rebalance Executed</h1>
        <p>A portfolio rebalance has been executed to optimize your yield.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>From:</strong> ${data.fromAsset}</p>
          <p><strong>To:</strong> ${data.toAsset}</p>
          <p><strong>Amount:</strong> ${data.amount}</p>
          <p><strong>Transaction:</strong> <a href="https://bscscan.com/tx/${data.txHash}">${data.txHash.slice(0, 10)}...${data.txHash.slice(-8)}</a></p>
        </div>
        <p>No action is required from you. Your PNGY shares remain unchanged.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Paimon Yield Protocol - RWA Yield Aggregator on BSC
        </p>
      </div>
    `,
    text: `Rebalance Executed\n\nA portfolio rebalance has been executed to optimize your yield.\n\nFrom: ${data.fromAsset}\nTo: ${data.toAsset}\nAmount: ${data.amount}\nTransaction: ${data.txHash}\n\nNo action is required from you.`,
  }),

  emergencyPause: (data: {
    reason: string;
    timestamp: string;
  }) => ({
    subject: 'URGENT: Protocol Paused',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc3545;">Protocol Paused</h1>
        <p><strong>Important:</strong> The Paimon Yield Protocol has been temporarily paused.</p>
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107;">
          <p><strong>Reason:</strong> ${data.reason}</p>
          <p><strong>Time:</strong> ${data.timestamp}</p>
        </div>
        <p>Deposits and withdrawals are temporarily disabled. Your funds are safe and will be accessible once the protocol resumes.</p>
        <p>We will notify you when operations resume.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Paimon Yield Protocol - RWA Yield Aggregator on BSC
        </p>
      </div>
    `,
    text: `URGENT: Protocol Paused\n\nThe Paimon Yield Protocol has been temporarily paused.\n\nReason: ${data.reason}\nTime: ${data.timestamp}\n\nDeposits and withdrawals are temporarily disabled. Your funds are safe.`,
  }),

  circuitBreaker: (data: {
    trigger: string;
    maxWithdrawal: string;
    timestamp: string;
  }) => ({
    subject: 'Circuit Breaker Activated',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #fd7e14;">Circuit Breaker Activated</h1>
        <p>The protocol's circuit breaker has been triggered as a protective measure.</p>
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107;">
          <p><strong>Trigger:</strong> ${data.trigger}</p>
          <p><strong>Max Withdrawal:</strong> ${data.maxWithdrawal} USDT per transaction</p>
          <p><strong>Time:</strong> ${data.timestamp}</p>
        </div>
        <p>Withdrawals are limited until market conditions stabilize. Your funds remain secure.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Paimon Yield Protocol - RWA Yield Aggregator on BSC
        </p>
      </div>
    `,
    text: `Circuit Breaker Activated\n\nThe protocol's circuit breaker has been triggered.\n\nTrigger: ${data.trigger}\nMax Withdrawal: ${data.maxWithdrawal} USDT\nTime: ${data.timestamp}\n\nWithdrawals are limited until conditions stabilize.`,
  }),
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  const client = getResendClient();

  if (!client) {
    console.log('[EmailService] Email disabled or not configured, skipping send');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const result = await client.emails.send({
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (result.error) {
      console.error('[EmailService] Failed to send email:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`[EmailService] Email sent successfully: ${result.data?.id}`);
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[EmailService] Error sending email:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send a notification to a user
 */
export async function sendNotification(context: NotificationContext): Promise<SendResult> {
  const { userAddress, type, data } = context;

  // Get user's notification preferences
  const preferences = await prisma.notificationPreference.findUnique({
    where: { userAddress: userAddress.toLowerCase() },
  });

  if (!preferences || !preferences.email || !preferences.emailVerified) {
    console.log(`[EmailService] User ${userAddress} has no verified email, skipping`);
    return { success: false, error: 'No verified email' };
  }

  // Check if user wants this type of notification
  const alertEnabled = isAlertEnabled(preferences, type);
  if (!alertEnabled) {
    console.log(`[EmailService] User ${userAddress} disabled ${type} alerts, skipping`);
    return { success: false, error: 'Alert type disabled' };
  }

  // Generate email content based on type
  const emailContent = generateEmailContent(type, data);
  if (!emailContent) {
    return { success: false, error: 'Unknown notification type' };
  }

  // Create notification log entry
  const logEntry = await prisma.notificationLog.create({
    data: {
      userAddress: userAddress.toLowerCase(),
      type,
      channel: 'EMAIL',
      recipient: preferences.email,
      subject: emailContent.subject,
      status: 'PENDING',
    },
  });

  // Send the email
  const result = await sendEmail({
    to: preferences.email,
    ...emailContent,
  });

  // Update log entry with result
  await prisma.notificationLog.update({
    where: { id: logEntry.id },
    data: {
      status: result.success ? 'SENT' : 'FAILED',
      errorMessage: result.error,
      sentAt: result.success ? new Date() : null,
    },
  });

  return result;
}

/**
 * Check if a specific alert type is enabled for a user
 */
function isAlertEnabled(
  preferences: {
    withdrawalAlert: boolean;
    rebalanceAlert: boolean;
    emergencyAlert: boolean;
  },
  type: NotificationType
): boolean {
  switch (type) {
    case 'WITHDRAWAL_COMPLETE':
      return preferences.withdrawalAlert;
    case 'REBALANCE_EXECUTED':
      return preferences.rebalanceAlert;
    case 'EMERGENCY_PAUSE':
    case 'CIRCUIT_BREAKER':
      return preferences.emergencyAlert;
    default:
      return false;
  }
}

/**
 * Generate email content based on notification type
 */
function generateEmailContent(
  type: NotificationType,
  data: Record<string, unknown>
): { subject: string; html: string; text: string } | null {
  switch (type) {
    case 'WITHDRAWAL_COMPLETE':
      return emailTemplates.withdrawalComplete(data as any);
    case 'REBALANCE_EXECUTED':
      return emailTemplates.rebalanceExecuted(data as any);
    case 'EMERGENCY_PAUSE':
      return emailTemplates.emergencyPause(data as any);
    case 'CIRCUIT_BREAKER':
      return emailTemplates.circuitBreaker(data as any);
    default:
      return null;
  }
}

/**
 * Send notification to all users with a specific alert enabled
 */
export async function broadcastNotification(
  type: NotificationType,
  data: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  // Find all users with verified emails and the alert enabled
  const alertField = getAlertField(type);
  if (!alertField) {
    return { sent: 0, failed: 0 };
  }

  const preferences = await prisma.notificationPreference.findMany({
    where: {
      emailVerified: true,
      email: { not: null },
      [alertField]: true,
    },
  });

  let sent = 0;
  let failed = 0;

  for (const pref of preferences) {
    const result = await sendNotification({
      userAddress: pref.userAddress,
      type,
      data,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  console.log(`[EmailService] Broadcast ${type}: sent=${sent}, failed=${failed}`);
  return { sent, failed };
}

/**
 * Get the alert field name for a notification type
 */
function getAlertField(type: NotificationType): string | null {
  switch (type) {
    case 'WITHDRAWAL_COMPLETE':
      return 'withdrawalAlert';
    case 'REBALANCE_EXECUTED':
      return 'rebalanceAlert';
    case 'EMERGENCY_PAUSE':
    case 'CIRCUIT_BREAKER':
      return 'emergencyAlert';
    default:
      return null;
  }
}

// =============================================================================
// Notification Preferences CRUD
// =============================================================================

export async function getNotificationPreferences(userAddress: string) {
  return prisma.notificationPreference.findUnique({
    where: { userAddress: userAddress.toLowerCase() },
  });
}

export async function upsertNotificationPreferences(
  userAddress: string,
  data: {
    email?: string;
    withdrawalAlert?: boolean;
    rebalanceAlert?: boolean;
    emergencyAlert?: boolean;
  }
) {
  return prisma.notificationPreference.upsert({
    where: { userAddress: userAddress.toLowerCase() },
    update: {
      ...data,
      // Reset verification if email changed
      emailVerified: data.email ? false : undefined,
    },
    create: {
      userAddress: userAddress.toLowerCase(),
      email: data.email,
      withdrawalAlert: data.withdrawalAlert ?? true,
      rebalanceAlert: data.rebalanceAlert ?? true,
      emergencyAlert: data.emergencyAlert ?? true,
    },
  });
}

export async function verifyEmail(userAddress: string): Promise<boolean> {
  const result = await prisma.notificationPreference.updateMany({
    where: {
      userAddress: userAddress.toLowerCase(),
      email: { not: null },
    },
    data: {
      emailVerified: true,
    },
  });

  return result.count > 0;
}

export async function getNotificationHistory(
  userAddress: string,
  limit = 20,
  offset = 0
) {
  return prisma.notificationLog.findMany({
    where: { userAddress: userAddress.toLowerCase() },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}
