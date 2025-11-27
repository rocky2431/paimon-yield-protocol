import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Mocks - Using vi.hoisted() for proper hoisting
// =============================================================================

const mockPrismaLargeWithdrawal = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
}));

const mockAddBroadcastNotificationJob = vi.hoisted(() => vi.fn());

// Mock Prisma
vi.mock('../services/database', () => ({
  prisma: {
    largeWithdrawal: mockPrismaLargeWithdrawal,
  },
}));

// Mock notification queue
vi.mock('../jobs/notificationQueue', () => ({
  addBroadcastNotificationJob: (...args: unknown[]) => mockAddBroadcastNotificationJob(...args),
}));

// Mock fetch for Telegram
const mockFetch = vi.fn();
global.fetch = mockFetch;

// =============================================================================
// Imports (after mocks)
// =============================================================================

import {
  isLargeWithdrawal,
  processLargeWithdrawal,
  getUserLargeWithdrawals,
  getLargeWithdrawalById,
  getPendingLargeWithdrawals,
  updateLargeWithdrawalStatus,
  completeLargeWithdrawal,
  getLargeWithdrawalStats,
  LARGE_WITHDRAWAL_THRESHOLD,
} from '../services/withdrawService';

// =============================================================================
// Tests
// =============================================================================

describe('WithdrawService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('LARGE_WITHDRAWAL_THRESHOLD', () => {
    it('should be $100,000 in wei (18 decimals)', () => {
      // $100,000 * 10^18
      expect(LARGE_WITHDRAWAL_THRESHOLD).toBe(BigInt('100000000000000000000000'));
    });
  });

  describe('isLargeWithdrawal', () => {
    it('should return true for amounts >= $100,000', () => {
      expect(isLargeWithdrawal(BigInt('100000000000000000000000'))).toBe(true); // $100K
      expect(isLargeWithdrawal(BigInt('500000000000000000000000'))).toBe(true); // $500K
      expect(isLargeWithdrawal(BigInt('1000000000000000000000000'))).toBe(true); // $1M
    });

    it('should return false for amounts < $100,000', () => {
      expect(isLargeWithdrawal(BigInt('99999000000000000000000'))).toBe(false); // $99,999
      expect(isLargeWithdrawal(BigInt('50000000000000000000000'))).toBe(false); // $50K
      expect(isLargeWithdrawal(BigInt('0'))).toBe(false); // $0
    });

    it('should return true for exact threshold amount', () => {
      expect(isLargeWithdrawal(LARGE_WITHDRAWAL_THRESHOLD)).toBe(true);
    });
  });

  describe('processLargeWithdrawal', () => {
    const mockWithdrawal = {
      id: 'withdrawal-123',
      userAddress: '0x1234567890123456789012345678901234567890',
      shares: '1000000000000000000000',
      estimatedAmount: '150000000000000000000000',
      actualAmount: null,
      status: 'PENDING',
      priority: 4, // $150K falls in priority 4 ($100K-$250K)
      requestedAt: new Date('2024-01-01T00:00:00Z'),
      processedAt: null,
      completedAt: null,
      requestTxHash: '0xabc123',
    };

    it('should create a large withdrawal record', async () => {
      mockPrismaLargeWithdrawal.create.mockResolvedValue(mockWithdrawal);

      const result = await processLargeWithdrawal({
        userAddress: '0x1234567890123456789012345678901234567890',
        shares: BigInt('1000000000000000000000'),
        estimatedAmount: BigInt('150000000000000000000000'),
        requestTxHash: '0xabc123',
      });

      expect(mockPrismaLargeWithdrawal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userAddress: '0x1234567890123456789012345678901234567890',
          shares: '1000000000000000000000',
          estimatedAmount: '150000000000000000000000',
          status: 'PENDING',
          priority: 4, // $150K falls in priority 4 ($100K-$250K)
        }),
      });

      expect(result.id).toBe('withdrawal-123');
      expect(result.status).toBe('PENDING');
    });

    it('should notify admins of new large withdrawal', async () => {
      mockPrismaLargeWithdrawal.create.mockResolvedValue(mockWithdrawal);

      await processLargeWithdrawal({
        userAddress: '0x1234567890123456789012345678901234567890',
        shares: BigInt('1000000000000000000000'),
        estimatedAmount: BigInt('150000000000000000000000'),
      });

      expect(mockAddBroadcastNotificationJob).toHaveBeenCalledWith(
        'LARGE_WITHDRAWAL_ALERT',
        expect.objectContaining({
          id: 'withdrawal-123',
          userAddress: '0x1234567890123456789012345678901234567890',
        }),
        'critical'
      );
    });

    it('should assign correct priority based on amount', async () => {
      // Test $1M+ (priority 1)
      const withdrawal1M = { ...mockWithdrawal, priority: 1 };
      mockPrismaLargeWithdrawal.create.mockResolvedValue(withdrawal1M);

      await processLargeWithdrawal({
        userAddress: '0x1234567890123456789012345678901234567890',
        shares: BigInt('1000000000000000000000'),
        estimatedAmount: BigInt('1000000000000000000000000'), // $1M
      });

      expect(mockPrismaLargeWithdrawal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 1,
        }),
      });
    });

    // Note: Telegram notification test skipped because env vars are read at module load time
    // The Telegram integration is tested manually or via integration tests
  });

  describe('getUserLargeWithdrawals', () => {
    it('should return user withdrawals sorted by date', async () => {
      const mockWithdrawals = [
        {
          id: 'w1',
          userAddress: '0x1234567890123456789012345678901234567890',
          shares: '1000000000000000000000',
          estimatedAmount: '150000000000000000000000',
          actualAmount: null,
          status: 'PENDING',
          priority: 3,
          requestedAt: new Date('2024-01-02'),
          processedAt: null,
          completedAt: null,
        },
        {
          id: 'w2',
          userAddress: '0x1234567890123456789012345678901234567890',
          shares: '2000000000000000000000',
          estimatedAmount: '300000000000000000000000',
          actualAmount: '300000000000000000000000',
          status: 'COMPLETED',
          priority: 2,
          requestedAt: new Date('2024-01-01'),
          processedAt: new Date('2024-01-01T06:00:00Z'),
          completedAt: new Date('2024-01-01T12:00:00Z'),
        },
      ];

      mockPrismaLargeWithdrawal.findMany.mockResolvedValue(mockWithdrawals);

      const result = await getUserLargeWithdrawals('0x1234567890123456789012345678901234567890');

      expect(mockPrismaLargeWithdrawal.findMany).toHaveBeenCalledWith({
        where: { userAddress: '0x1234567890123456789012345678901234567890' },
        orderBy: { requestedAt: 'desc' },
        take: 10,
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('w1');
    });
  });

  describe('getLargeWithdrawalById', () => {
    it('should return withdrawal by ID', async () => {
      const mockWithdrawal = {
        id: 'w1',
        userAddress: '0x1234567890123456789012345678901234567890',
        shares: '1000000000000000000000',
        estimatedAmount: '150000000000000000000000',
        actualAmount: null,
        status: 'PENDING',
        priority: 3,
        requestedAt: new Date(),
        processedAt: null,
        completedAt: null,
      };

      mockPrismaLargeWithdrawal.findUnique.mockResolvedValue(mockWithdrawal);

      const result = await getLargeWithdrawalById('w1');

      expect(mockPrismaLargeWithdrawal.findUnique).toHaveBeenCalledWith({
        where: { id: 'w1' },
      });

      expect(result?.id).toBe('w1');
    });

    it('should return null if not found', async () => {
      mockPrismaLargeWithdrawal.findUnique.mockResolvedValue(null);

      const result = await getLargeWithdrawalById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPendingLargeWithdrawals', () => {
    it('should return withdrawals with pending statuses sorted by priority', async () => {
      const mockWithdrawals = [
        {
          id: 'w1',
          userAddress: '0x111',
          shares: '5000000000000000000000',
          estimatedAmount: '1000000000000000000000000', // $1M - priority 1
          actualAmount: null,
          status: 'PENDING',
          priority: 1,
          requestedAt: new Date('2024-01-02'),
          processedAt: null,
          completedAt: null,
        },
        {
          id: 'w2',
          userAddress: '0x222',
          shares: '1000000000000000000000',
          estimatedAmount: '150000000000000000000000', // $150K - priority 3
          actualAmount: null,
          status: 'APPROVED',
          priority: 3,
          requestedAt: new Date('2024-01-01'),
          processedAt: new Date(),
          completedAt: null,
        },
      ];

      mockPrismaLargeWithdrawal.findMany.mockResolvedValue(mockWithdrawals);

      const result = await getPendingLargeWithdrawals();

      expect(mockPrismaLargeWithdrawal.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['PENDING', 'APPROVED', 'PROCESSING', 'READY'],
          },
        },
        orderBy: [{ priority: 'asc' }, { requestedAt: 'asc' }],
      });

      expect(result).toHaveLength(2);
      expect(result[0].priority).toBe(1);
    });
  });

  describe('updateLargeWithdrawalStatus', () => {
    it('should update status to APPROVED with processedAt timestamp', async () => {
      const mockUpdated = {
        id: 'w1',
        userAddress: '0x1234567890123456789012345678901234567890',
        shares: '1000000000000000000000',
        estimatedAmount: '150000000000000000000000',
        actualAmount: null,
        status: 'APPROVED',
        priority: 3,
        requestedAt: new Date('2024-01-01'),
        processedAt: new Date(),
        completedAt: null,
        adminNotes: 'Approved by admin',
      };

      mockPrismaLargeWithdrawal.update.mockResolvedValue(mockUpdated);

      const result = await updateLargeWithdrawalStatus('w1', 'APPROVED', 'Approved by admin');

      expect(mockPrismaLargeWithdrawal.update).toHaveBeenCalledWith({
        where: { id: 'w1' },
        data: expect.objectContaining({
          status: 'APPROVED',
          adminNotes: 'Approved by admin',
          processedAt: expect.any(Date),
        }),
      });

      expect(result.status).toBe('APPROVED');
    });

    it('should update status to COMPLETED with completedAt timestamp', async () => {
      const mockUpdated = {
        id: 'w1',
        userAddress: '0x1234567890123456789012345678901234567890',
        shares: '1000000000000000000000',
        estimatedAmount: '150000000000000000000000',
        actualAmount: null,
        status: 'COMPLETED',
        priority: 3,
        requestedAt: new Date('2024-01-01'),
        processedAt: new Date('2024-01-01T06:00:00Z'),
        completedAt: new Date(),
      };

      mockPrismaLargeWithdrawal.update.mockResolvedValue(mockUpdated);

      const result = await updateLargeWithdrawalStatus('w1', 'COMPLETED');

      expect(mockPrismaLargeWithdrawal.update).toHaveBeenCalledWith({
        where: { id: 'w1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        }),
      });

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('completeLargeWithdrawal', () => {
    it('should complete withdrawal with actual amount and tx hash', async () => {
      const mockCompleted = {
        id: 'w1',
        userAddress: '0x1234567890123456789012345678901234567890',
        shares: '1000000000000000000000',
        estimatedAmount: '150000000000000000000000',
        actualAmount: '149500000000000000000000',
        status: 'COMPLETED',
        priority: 3,
        requestedAt: new Date('2024-01-01'),
        processedAt: new Date('2024-01-01T06:00:00Z'),
        completedAt: new Date(),
        completeTxHash: '0xdef456',
      };

      mockPrismaLargeWithdrawal.update.mockResolvedValue(mockCompleted);

      const result = await completeLargeWithdrawal(
        'w1',
        '0xdef456',
        BigInt('149500000000000000000000')
      );

      expect(mockPrismaLargeWithdrawal.update).toHaveBeenCalledWith({
        where: { id: 'w1' },
        data: {
          status: 'COMPLETED',
          completeTxHash: '0xdef456',
          actualAmount: '149500000000000000000000',
          completedAt: expect.any(Date),
        },
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.actualAmount).toBe('149500000000000000000000');
    });
  });

  describe('getLargeWithdrawalStats', () => {
    it('should return withdrawal statistics', async () => {
      mockPrismaLargeWithdrawal.count.mockResolvedValueOnce(5); // pending
      mockPrismaLargeWithdrawal.count.mockResolvedValueOnce(3); // processing
      mockPrismaLargeWithdrawal.count.mockResolvedValueOnce(20); // completed

      // Active withdrawals for total value
      mockPrismaLargeWithdrawal.findMany.mockResolvedValueOnce([
        { estimatedAmount: '100000000000000000000000' }, // $100K
        { estimatedAmount: '250000000000000000000000' }, // $250K
      ]);

      // Completed withdrawals for avg processing time
      mockPrismaLargeWithdrawal.findMany.mockResolvedValueOnce([
        {
          requestedAt: new Date('2024-01-01T00:00:00Z'),
          completedAt: new Date('2024-01-01T10:00:00Z'), // 10 hours
        },
        {
          requestedAt: new Date('2024-01-02T00:00:00Z'),
          completedAt: new Date('2024-01-02T14:00:00Z'), // 14 hours
        },
      ]);

      const stats = await getLargeWithdrawalStats();

      expect(stats.totalPending).toBe(5);
      expect(stats.totalProcessing).toBe(3);
      expect(stats.totalCompleted).toBe(20);
      expect(stats.totalValue).toBe('350000000000000000000000'); // $350K
      expect(stats.avgProcessingTimeHours).toBe(12); // (10 + 14) / 2
    });

    it('should handle no completed withdrawals', async () => {
      mockPrismaLargeWithdrawal.count.mockResolvedValueOnce(2);
      mockPrismaLargeWithdrawal.count.mockResolvedValueOnce(1);
      mockPrismaLargeWithdrawal.count.mockResolvedValueOnce(0);
      mockPrismaLargeWithdrawal.findMany.mockResolvedValueOnce([]);
      mockPrismaLargeWithdrawal.findMany.mockResolvedValueOnce([]);

      const stats = await getLargeWithdrawalStats();

      expect(stats.avgProcessingTimeHours).toBe(0);
      expect(stats.totalValue).toBe('0');
    });
  });
});

describe('WithdrawService - Estimated Completion Time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate T+0.5 (12 hours) from request time', async () => {
    const requestTime = new Date('2024-01-01T00:00:00Z');
    const mockWithdrawal = {
      id: 'w1',
      userAddress: '0x123',
      shares: '1000000000000000000000',
      estimatedAmount: '150000000000000000000000',
      actualAmount: null,
      status: 'PENDING',
      priority: 3,
      requestedAt: requestTime,
      processedAt: null,
      completedAt: null,
    };

    mockPrismaLargeWithdrawal.findUnique.mockResolvedValue(mockWithdrawal);

    const result = await getLargeWithdrawalById('w1');

    expect(result?.estimatedCompletionTime).toEqual(new Date('2024-01-01T12:00:00Z'));
  });

  it('should return null estimatedCompletionTime for completed withdrawals', async () => {
    const mockWithdrawal = {
      id: 'w1',
      userAddress: '0x123',
      shares: '1000000000000000000000',
      estimatedAmount: '150000000000000000000000',
      actualAmount: '150000000000000000000000',
      status: 'COMPLETED',
      priority: 3,
      requestedAt: new Date('2024-01-01T00:00:00Z'),
      processedAt: new Date('2024-01-01T06:00:00Z'),
      completedAt: new Date('2024-01-01T10:00:00Z'),
    };

    mockPrismaLargeWithdrawal.findUnique.mockResolvedValue(mockWithdrawal);

    const result = await getLargeWithdrawalById('w1');

    expect(result?.estimatedCompletionTime).toBeNull();
  });
});
