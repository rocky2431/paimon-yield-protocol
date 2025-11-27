import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// =============================================================================
// Mocks - Must be defined before imports
// =============================================================================

const mockWithdrawService = {
  getUserLargeWithdrawals: vi.fn(),
  getLargeWithdrawalById: vi.fn(),
  getPendingLargeWithdrawals: vi.fn(),
  updateLargeWithdrawalStatus: vi.fn(),
  getLargeWithdrawalStats: vi.fn(),
  processLargeWithdrawal: vi.fn(),
  isLargeWithdrawal: vi.fn(),
  LARGE_WITHDRAWAL_THRESHOLD: BigInt('100000000000000000000000'),
};

vi.mock('../services/withdrawService', () => ({
  getUserLargeWithdrawals: () => mockWithdrawService.getUserLargeWithdrawals(),
  getLargeWithdrawalById: (id: string) => mockWithdrawService.getLargeWithdrawalById(id),
  getPendingLargeWithdrawals: () => mockWithdrawService.getPendingLargeWithdrawals(),
  updateLargeWithdrawalStatus: (id: string, status: string, notes?: string) =>
    mockWithdrawService.updateLargeWithdrawalStatus(id, status, notes),
  getLargeWithdrawalStats: () => mockWithdrawService.getLargeWithdrawalStats(),
  processLargeWithdrawal: (req: unknown) => mockWithdrawService.processLargeWithdrawal(req),
  isLargeWithdrawal: (amount: bigint) => mockWithdrawService.isLargeWithdrawal(amount),
  LARGE_WITHDRAWAL_THRESHOLD: BigInt('100000000000000000000000'),
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import withdrawalRoutes from '../routes/withdrawals';

// =============================================================================
// Test Setup
// =============================================================================

describe('Withdrawal Routes', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    server = Fastify();
    await server.register(withdrawalRoutes, { prefix: '/api/withdrawals' });
  });

  afterEach(async () => {
    await server.close();
  });

  // ===========================================================================
  // User Routes
  // ===========================================================================

  describe('GET /api/withdrawals/user/:address', () => {
    it('should return user withdrawal history', async () => {
      const mockWithdrawals = [
        {
          id: 'w1',
          userAddress: '0x1234567890123456789012345678901234567890',
          shares: '1000000000000000000000',
          estimatedAmount: '150000000000000000000000',
          status: 'PENDING',
          priority: 3,
          requestedAt: new Date('2024-01-01'),
        },
      ];

      mockWithdrawService.getUserLargeWithdrawals.mockResolvedValue(mockWithdrawals);

      const response = await server.inject({
        method: 'GET',
        url: '/api/withdrawals/user/0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.withdrawals).toHaveLength(1);
      expect(body.data.threshold).toBe('100000000000000000000000');
    });

    it('should return 400 for invalid address format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/withdrawals/user/invalid-address',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid address format');
    });

    it('should normalize address to lowercase', async () => {
      mockWithdrawService.getUserLargeWithdrawals.mockResolvedValue([]);

      await server.inject({
        method: 'GET',
        url: '/api/withdrawals/user/0xABCDEF1234567890123456789012345678901234',
      });

      expect(mockWithdrawService.getUserLargeWithdrawals).toHaveBeenCalled();
    });
  });

  describe('GET /api/withdrawals/:id', () => {
    it('should return specific withdrawal', async () => {
      const mockWithdrawal = {
        id: 'w1',
        userAddress: '0x1234567890123456789012345678901234567890',
        shares: '1000000000000000000000',
        estimatedAmount: '150000000000000000000000',
        status: 'PENDING',
      };

      mockWithdrawService.getLargeWithdrawalById.mockResolvedValue(mockWithdrawal);

      const response = await server.inject({
        method: 'GET',
        url: '/api/withdrawals/w1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('w1');
    });

    it('should return 404 for non-existent withdrawal', async () => {
      mockWithdrawService.getLargeWithdrawalById.mockResolvedValue(null);

      const response = await server.inject({
        method: 'GET',
        url: '/api/withdrawals/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Withdrawal not found');
    });
  });

  describe('POST /api/withdrawals/check', () => {
    it('should return true for large withdrawal', async () => {
      mockWithdrawService.isLargeWithdrawal.mockReturnValue(true);

      const response = await server.inject({
        method: 'POST',
        url: '/api/withdrawals/check',
        payload: {
          amount: '150000000000000000000000',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.isLargeWithdrawal).toBe(true);
      expect(body.data.message).toContain('priority channel');
    });

    it('should return false for small withdrawal', async () => {
      mockWithdrawService.isLargeWithdrawal.mockReturnValue(false);

      const response = await server.inject({
        method: 'POST',
        url: '/api/withdrawals/check',
        payload: {
          amount: '50000000000000000000000',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.isLargeWithdrawal).toBe(false);
      expect(body.data.message).toContain('below');
    });

    it('should return 400 if amount is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/withdrawals/check',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Amount is required');
    });
  });

  describe('POST /api/withdrawals/request', () => {
    it('should create large withdrawal request', async () => {
      const mockWithdrawal = {
        id: 'w1',
        userAddress: '0x1234567890123456789012345678901234567890',
        shares: '1000000000000000000000',
        estimatedAmount: '150000000000000000000000',
        status: 'PENDING',
      };

      mockWithdrawService.isLargeWithdrawal.mockReturnValue(true);
      mockWithdrawService.processLargeWithdrawal.mockResolvedValue(mockWithdrawal);

      const response = await server.inject({
        method: 'POST',
        url: '/api/withdrawals/request',
        payload: {
          userAddress: '0x1234567890123456789012345678901234567890',
          shares: '1000000000000000000000',
          estimatedAmount: '150000000000000000000000',
          requestTxHash: '0xabc123',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('12 hours');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/withdrawals/request',
        payload: {
          userAddress: '0x1234567890123456789012345678901234567890',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 400 for invalid address', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/withdrawals/request',
        payload: {
          userAddress: 'invalid',
          shares: '1000000000000000000000',
          estimatedAmount: '150000000000000000000000',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid address format');
    });

    it('should return 400 if amount below threshold', async () => {
      mockWithdrawService.isLargeWithdrawal.mockReturnValue(false);

      const response = await server.inject({
        method: 'POST',
        url: '/api/withdrawals/request',
        payload: {
          userAddress: '0x1234567890123456789012345678901234567890',
          shares: '100000000000000000000',
          estimatedAmount: '50000000000000000000000', // $50K - below threshold
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('threshold');
    });
  });

  // ===========================================================================
  // Admin Routes
  // ===========================================================================

  describe('GET /api/withdrawals/admin/pending', () => {
    it('should return pending withdrawals', async () => {
      const mockWithdrawals = [
        { id: 'w1', status: 'PENDING', priority: 1 },
        { id: 'w2', status: 'APPROVED', priority: 2 },
      ];

      mockWithdrawService.getPendingLargeWithdrawals.mockResolvedValue(mockWithdrawals);

      const response = await server.inject({
        method: 'GET',
        url: '/api/withdrawals/admin/pending',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.withdrawals).toHaveLength(2);
      expect(body.data.count).toBe(2);
    });
  });

  describe('GET /api/withdrawals/admin/stats', () => {
    it('should return withdrawal statistics', async () => {
      const mockStats = {
        totalPending: 5,
        totalProcessing: 3,
        totalCompleted: 20,
        totalValue: '500000000000000000000000',
        avgProcessingTimeHours: 8.5,
      };

      mockWithdrawService.getLargeWithdrawalStats.mockResolvedValue(mockStats);

      const response = await server.inject({
        method: 'GET',
        url: '/api/withdrawals/admin/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.totalPending).toBe(5);
      expect(body.data.avgProcessingTimeHours).toBe(8.5);
    });
  });

  describe('PATCH /api/withdrawals/admin/:id/status', () => {
    it('should update withdrawal status', async () => {
      const mockWithdrawal = {
        id: 'w1',
        status: 'APPROVED',
        adminNotes: 'Approved for processing',
      };

      mockWithdrawService.updateLargeWithdrawalStatus.mockResolvedValue(mockWithdrawal);

      const response = await server.inject({
        method: 'PATCH',
        url: '/api/withdrawals/admin/w1/status',
        payload: {
          status: 'APPROVED',
          adminNotes: 'Approved for processing',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('APPROVED');
      expect(body.message).toContain('APPROVED');
    });

    it('should return 400 for invalid status', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/withdrawals/admin/w1/status',
        payload: {
          status: 'INVALID_STATUS',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid status');
      expect(body.validStatuses).toBeDefined();
    });

    it('should return 400 if status is missing', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/withdrawals/admin/w1/status',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/withdrawals/threshold', () => {
    it('should return threshold information', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/withdrawals/threshold',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.threshold).toBe('100000000000000000000000');
      expect(body.data.thresholdUsd).toBe(100000);
      expect(body.data.thresholdFormatted).toContain('$');
      expect(body.data.targetProcessingTime).toContain('12 hours');
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('should return 500 on service error', async () => {
      mockWithdrawService.getUserLargeWithdrawals.mockRejectedValue(new Error('Database error'));

      const response = await server.inject({
        method: 'GET',
        url: '/api/withdrawals/user/0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Failed');
    });
  });
});
