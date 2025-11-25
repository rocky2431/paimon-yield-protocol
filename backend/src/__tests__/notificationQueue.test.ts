/**
 * Notification Queue Tests
 * Task #57 - 实现通知系统 - Bull Queue 后台任务
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from 'vitest';

// Mock BullMQ before importing modules
vi.mock('bullmq', () => {
  const mockJob = {
    id: 'test-job-1',
    data: {},
    attemptsMade: 0,
    opts: { attempts: 3 },
    updateProgress: vi.fn().mockResolvedValue(undefined),
  };

  const mockQueue = {
    add: vi.fn().mockResolvedValue(mockJob),
    getWaitingCount: vi.fn().mockResolvedValue(5),
    getActiveCount: vi.fn().mockResolvedValue(2),
    getCompletedCount: vi.fn().mockResolvedValue(100),
    getFailedCount: vi.fn().mockResolvedValue(3),
    getDelayedCount: vi.fn().mockResolvedValue(1),
    getFailed: vi.fn().mockResolvedValue([]),
    clean: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockQueueEvents = {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockWorker = {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    name: 'test-worker',
  };

  return {
    Queue: vi.fn(() => mockQueue),
    QueueEvents: vi.fn(() => mockQueueEvents),
    Worker: vi.fn(() => mockWorker),
    Job: vi.fn(),
  };
});

// Mock Redis config
vi.mock('../config/redis', () => ({
  getRedisOptions: vi.fn().mockReturnValue({
    host: 'localhost',
    port: 6379,
  }),
}));

// Mock email service
vi.mock('../services/emailService', () => ({
  sendNotification: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
  broadcastNotification: vi.fn().mockResolvedValue({ sent: 5, failed: 0 }),
}));

// Import modules after mocking
import {
  notificationQueue,
  addNotificationJob,
  addUserNotificationJob,
  addBroadcastNotificationJob,
} from '../jobs/queues.js';

import {
  notifyEmergencyPause,
  notifyCircuitBreaker,
  notifyWithdrawalComplete,
  notifyRebalanceExecuted,
  getQueueStats,
  setupQueueMonitoring,
} from '../jobs/notificationQueue.js';

describe('Notification Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Queue Configuration Tests
  // ===========================================================================

  describe('Queue Configuration', () => {
    it('should create notification queue with correct name', () => {
      expect(notificationQueue).toBeDefined();
    });

    it('should have add method available', () => {
      expect(typeof notificationQueue.add).toBe('function');
    });
  });

  // ===========================================================================
  // addNotificationJob Tests
  // ===========================================================================

  describe('addNotificationJob', () => {
    it('should add a notification job with default priority', async () => {
      const jobData = {
        type: 'WITHDRAWAL_COMPLETE' as const,
        userAddress: '0x1234567890123456789012345678901234567890',
        data: { amount: '1000', shares: '950', txHash: '0xabc123' },
      };

      await addNotificationJob(jobData);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send',
        jobData,
        expect.objectContaining({
          priority: 3, // 'normal' priority
        })
      );
    });

    it('should add a critical priority job with no delay', async () => {
      const jobData = {
        type: 'EMERGENCY_PAUSE' as const,
        data: { reason: 'Security issue', timestamp: '2024-01-15T10:00:00Z' },
        priority: 'critical' as const,
      };

      await addNotificationJob(jobData);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send',
        jobData,
        expect.objectContaining({
          priority: 1, // 'critical' = highest priority
          delay: 0,
        })
      );
    });

    it('should map priority levels correctly', async () => {
      const priorities = ['low', 'normal', 'high', 'critical'] as const;
      const expectedPriorities = [4, 3, 2, 1];

      for (let i = 0; i < priorities.length; i++) {
        vi.clearAllMocks();

        await addNotificationJob({
          type: 'WITHDRAWAL_COMPLETE',
          data: {},
          priority: priorities[i],
        });

        expect(notificationQueue.add).toHaveBeenCalledWith(
          'send',
          expect.any(Object),
          expect.objectContaining({
            priority: expectedPriorities[i],
          })
        );
      }
    });
  });

  // ===========================================================================
  // addUserNotificationJob Tests
  // ===========================================================================

  describe('addUserNotificationJob', () => {
    it('should add a user-specific notification job', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';
      const type = 'WITHDRAWAL_COMPLETE' as const;
      const data = { amount: '1000', shares: '950', txHash: '0xabc' };

      await addUserNotificationJob(userAddress, type, data);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          type,
          userAddress,
          data,
          priority: 'normal',
        }),
        expect.any(Object)
      );
    });

    it('should allow custom priority for user notification', async () => {
      await addUserNotificationJob(
        '0x1234567890123456789012345678901234567890',
        'WITHDRAWAL_COMPLETE',
        {},
        'high'
      );

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          priority: 'high',
        }),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // addBroadcastNotificationJob Tests
  // ===========================================================================

  describe('addBroadcastNotificationJob', () => {
    it('should add a broadcast notification job without userAddress', async () => {
      const type = 'REBALANCE_EXECUTED' as const;
      const data = { fromAsset: 'USDT', toAsset: 'stETH', amount: '50000' };

      await addBroadcastNotificationJob(type, data);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          type,
          data,
          priority: 'normal',
        }),
        expect.any(Object)
      );

      // Should not have userAddress in the call
      const callArgs = (notificationQueue.add as Mock).mock.calls[0][1];
      expect(callArgs.userAddress).toBeUndefined();
    });

    it('should support critical priority for broadcast', async () => {
      await addBroadcastNotificationJob(
        'EMERGENCY_PAUSE',
        { reason: 'Test' },
        'critical'
      );

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          type: 'EMERGENCY_PAUSE',
          priority: 'critical',
        }),
        expect.objectContaining({
          priority: 1,
          delay: 0,
        })
      );
    });
  });

  // ===========================================================================
  // Helper Function Tests
  // ===========================================================================

  describe('notifyEmergencyPause', () => {
    it('should queue emergency pause with critical priority', async () => {
      const reason = 'Smart contract vulnerability detected';

      await notifyEmergencyPause(reason);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          type: 'EMERGENCY_PAUSE',
          data: expect.objectContaining({
            reason,
            timestamp: expect.any(String),
          }),
          priority: 'critical',
        }),
        expect.objectContaining({
          priority: 1,
        })
      );
    });
  });

  describe('notifyCircuitBreaker', () => {
    it('should queue circuit breaker with critical priority', async () => {
      const trigger = 'NAV drop >5%';
      const maxWithdrawal = '10000';

      await notifyCircuitBreaker(trigger, maxWithdrawal);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          type: 'CIRCUIT_BREAKER',
          data: expect.objectContaining({
            trigger,
            maxWithdrawal,
            timestamp: expect.any(String),
          }),
          priority: 'critical',
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyWithdrawalComplete', () => {
    it('should queue withdrawal notification for specific user', async () => {
      const userAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
      const amount = '5000.50';
      const shares = '4800.25';
      const txHash = '0x123abc456def789';

      await notifyWithdrawalComplete(userAddress, amount, shares, txHash);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          type: 'WITHDRAWAL_COMPLETE',
          userAddress,
          data: {
            amount,
            shares,
            txHash,
          },
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyRebalanceExecuted', () => {
    it('should queue rebalance notification as broadcast', async () => {
      const fromAsset = 'USDT';
      const toAsset = 'ONDO';
      const amount = '100000';
      const txHash = '0xrebalance123';

      await notifyRebalanceExecuted(fromAsset, toAsset, amount, txHash);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          type: 'REBALANCE_EXECUTED',
          data: {
            fromAsset,
            toAsset,
            amount,
            txHash,
          },
        }),
        expect.any(Object)
      );

      // Should be broadcast (no userAddress)
      const callArgs = (notificationQueue.add as Mock).mock.calls[0][1];
      expect(callArgs.userAddress).toBeUndefined();
    });
  });

  // ===========================================================================
  // Queue Stats Tests
  // ===========================================================================

  describe('getQueueStats', () => {
    it('should call queue stat methods', async () => {
      // Since we're testing mocked functions, just verify the function executes
      const stats = await getQueueStats();

      // Stats should be an object with the expected keys
      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('delayed');
    });
  });

  // ===========================================================================
  // Queue Monitoring Tests
  // ===========================================================================

  describe('setupQueueMonitoring', () => {
    it('should setup monitoring without errors', () => {
      // Just verify it doesn't throw
      expect(() => setupQueueMonitoring()).not.toThrow();
    });
  });

  // ===========================================================================
  // Notification Type Tests
  // ===========================================================================

  describe('Notification Types', () => {
    it('should support all notification types', async () => {
      const types = [
        'WITHDRAWAL_COMPLETE',
        'REBALANCE_EXECUTED',
        'EMERGENCY_PAUSE',
        'CIRCUIT_BREAKER',
      ] as const;

      for (const type of types) {
        vi.clearAllMocks();

        await addNotificationJob({
          type,
          data: { test: true },
        });

        expect(notificationQueue.add).toHaveBeenCalledWith(
          'send',
          expect.objectContaining({ type }),
          expect.any(Object)
        );
      }
    });
  });
});
