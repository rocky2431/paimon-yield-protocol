/**
 * Notification Routes Tests
 * Task #56 - 实现通知系统 - 邮件通知
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';

// Mock the email service
vi.mock('../services/emailService', () => ({
  getNotificationPreferences: vi.fn(),
  upsertNotificationPreferences: vi.fn(),
  verifyEmail: vi.fn(),
  getNotificationHistory: vi.fn(),
}));

import * as emailService from '../services/emailService.js';

describe('Notification Routes', () => {
  let server: FastifyInstance;

  const mockPreferences = {
    id: 'pref-1',
    userAddress: '0x1234567890123456789012345678901234567890',
    email: 'test@example.com',
    emailVerified: true,
    withdrawalAlert: true,
    rebalanceAlert: true,
    emergencyAlert: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockHistoryLogs = [
    {
      id: 'log-1',
      userAddress: '0x1234567890123456789012345678901234567890',
      type: 'WITHDRAWAL_COMPLETE' as const,
      channel: 'EMAIL' as const,
      recipient: 'test@example.com',
      subject: 'Your PNGY Withdrawal is Complete',
      status: 'SENT' as const,
      errorMessage: null,
      sentAt: new Date('2024-01-15T10:00:00Z'),
      createdAt: new Date('2024-01-15T10:00:00Z'),
    },
    {
      id: 'log-2',
      userAddress: '0x1234567890123456789012345678901234567890',
      type: 'REBALANCE_EXECUTED' as const,
      channel: 'EMAIL' as const,
      recipient: 'test@example.com',
      subject: 'Portfolio Rebalance Executed',
      status: 'SENT' as const,
      errorMessage: null,
      sentAt: new Date('2024-01-14T08:00:00Z'),
      createdAt: new Date('2024-01-14T08:00:00Z'),
    },
  ];

  beforeAll(async () => {
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // GET /api/notifications/preferences/:address
  // ===========================================================================

  describe('GET /api/notifications/preferences/:address', () => {
    it('should return notification preferences for valid address', async () => {
      vi.mocked(emailService.getNotificationPreferences).mockResolvedValue(mockPreferences);

      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/preferences/0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.userAddress).toBe(mockPreferences.userAddress);
      expect(body.data.email).toBe(mockPreferences.email);
      expect(body.data.emailVerified).toBe(true);
      expect(body.data.withdrawalAlert).toBe(true);
      expect(body.data.rebalanceAlert).toBe(true);
      expect(body.data.emergencyAlert).toBe(true);
    });

    it('should return null data for address with no preferences', async () => {
      vi.mocked(emailService.getNotificationPreferences).mockResolvedValue(null);

      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/preferences/0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });

    it('should return 400 for invalid Ethereum address', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/preferences/invalid-address',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for address with wrong length', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/preferences/0x1234',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(emailService.getNotificationPreferences).mockRejectedValue(
        new Error('Database error')
      );

      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/preferences/0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to get notification preferences');
    });
  });

  // ===========================================================================
  // POST /api/notifications/preferences/:address
  // ===========================================================================

  describe('POST /api/notifications/preferences/:address', () => {
    it('should create new preferences with email', async () => {
      const updatedPrefs = {
        ...mockPreferences,
        emailVerified: false,
      };
      vi.mocked(emailService.upsertNotificationPreferences).mockResolvedValue(updatedPrefs);

      const response = await server.inject({
        method: 'POST',
        url: '/api/notifications/preferences/0x1234567890123456789012345678901234567890',
        payload: {
          email: 'test@example.com',
          withdrawalAlert: true,
          rebalanceAlert: true,
          emergencyAlert: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('test@example.com');
      expect(body.data.emailVerified).toBe(false);
    });

    it('should update alert preferences', async () => {
      const updatedPrefs = {
        ...mockPreferences,
        withdrawalAlert: false,
        rebalanceAlert: false,
      };
      vi.mocked(emailService.upsertNotificationPreferences).mockResolvedValue(updatedPrefs);

      const response = await server.inject({
        method: 'POST',
        url: '/api/notifications/preferences/0x1234567890123456789012345678901234567890',
        payload: {
          withdrawalAlert: false,
          rebalanceAlert: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.withdrawalAlert).toBe(false);
      expect(body.data.rebalanceAlert).toBe(false);
    });

    it('should return 400 for invalid Ethereum address', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/notifications/preferences/not-an-address',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/notifications/preferences/0x1234567890123456789012345678901234567890',
        payload: {
          email: 'not-valid-email',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(emailService.upsertNotificationPreferences).mockRejectedValue(
        new Error('Database error')
      );

      const response = await server.inject({
        method: 'POST',
        url: '/api/notifications/preferences/0x1234567890123456789012345678901234567890',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to update notification preferences');
    });
  });

  // ===========================================================================
  // POST /api/notifications/verify-email
  // ===========================================================================

  describe('POST /api/notifications/verify-email', () => {
    it('should verify email successfully', async () => {
      vi.mocked(emailService.verifyEmail).mockResolvedValue(true);

      const response = await server.inject({
        method: 'POST',
        url: '/api/notifications/verify-email',
        payload: {
          address: '0x1234567890123456789012345678901234567890',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.verified).toBe(true);
    });

    it('should return false when no email to verify', async () => {
      vi.mocked(emailService.verifyEmail).mockResolvedValue(false);

      const response = await server.inject({
        method: 'POST',
        url: '/api/notifications/verify-email',
        payload: {
          address: '0x1234567890123456789012345678901234567890',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.verified).toBe(false);
    });

    it('should return 400 for invalid Ethereum address', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/notifications/verify-email',
        payload: {
          address: 'invalid',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when address is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/notifications/verify-email',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(emailService.verifyEmail).mockRejectedValue(new Error('Database error'));

      const response = await server.inject({
        method: 'POST',
        url: '/api/notifications/verify-email',
        payload: {
          address: '0x1234567890123456789012345678901234567890',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to verify email');
    });
  });

  // ===========================================================================
  // GET /api/notifications/history/:address
  // ===========================================================================

  describe('GET /api/notifications/history/:address', () => {
    it('should return notification history', async () => {
      vi.mocked(emailService.getNotificationHistory).mockResolvedValue(mockHistoryLogs);

      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/history/0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].id).toBe('log-1');
      expect(body.data[0].type).toBe('WITHDRAWAL_COMPLETE');
      expect(body.data[0].channel).toBe('EMAIL');
      expect(body.data[0].status).toBe('SENT');
    });

    it('should return empty array when no history', async () => {
      vi.mocked(emailService.getNotificationHistory).mockResolvedValue([]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/history/0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
    });

    it('should respect limit and offset parameters', async () => {
      vi.mocked(emailService.getNotificationHistory).mockResolvedValue([mockHistoryLogs[0]]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/history/0x1234567890123456789012345678901234567890?limit=1&offset=0',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(1);
      expect(emailService.getNotificationHistory).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        1,
        0
      );
    });

    it('should use default limit and offset', async () => {
      vi.mocked(emailService.getNotificationHistory).mockResolvedValue(mockHistoryLogs);

      await server.inject({
        method: 'GET',
        url: '/api/notifications/history/0x1234567890123456789012345678901234567890',
      });

      expect(emailService.getNotificationHistory).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        20,
        0
      );
    });

    it('should return 400 for invalid Ethereum address', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/history/invalid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(emailService.getNotificationHistory).mockRejectedValue(
        new Error('Database error')
      );

      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/history/0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to get notification history');
    });

    it('should format dates correctly in response', async () => {
      vi.mocked(emailService.getNotificationHistory).mockResolvedValue(mockHistoryLogs);

      const response = await server.inject({
        method: 'GET',
        url: '/api/notifications/history/0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data[0].sentAt).toBe('2024-01-15T10:00:00.000Z');
      expect(body.data[0].createdAt).toBe('2024-01-15T10:00:00.000Z');
    });
  });
});
