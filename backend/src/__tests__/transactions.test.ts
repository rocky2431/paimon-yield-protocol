/**
 * Transaction History API Tests
 * Task #51 - 实现后端 API - 获取用户交易历史
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { transactionRoutes } from '../routes/transactions.js';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    transaction: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

// Get mocked prisma instance
const prisma = new PrismaClient();

// Mock transaction data
const mockTransactions = [
  {
    id: 'tx-1',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    type: 'DEPOSIT',
    userAddress: '0x1234567890123456789012345678901234567890',
    amount: BigInt('1000000000000000000000'), // 1000 USDT
    shares: BigInt('1000000000000000000000'), // 1000 PNGY
    sharePrice: BigInt('1000000000000000000'), // 1.0
    blockNumber: BigInt(12345678),
    timestamp: new Date('2024-01-15T10:00:00Z'),
    createdAt: new Date('2024-01-15T10:00:00Z'),
  },
  {
    id: 'tx-2',
    txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    type: 'WITHDRAW',
    userAddress: '0x1234567890123456789012345678901234567890',
    amount: BigInt('500000000000000000000'), // 500 USDT
    shares: BigInt('495000000000000000000'), // 495 PNGY (with yield)
    sharePrice: BigInt('1010000000000000000'), // 1.01
    blockNumber: BigInt(12345700),
    timestamp: new Date('2024-01-20T14:30:00Z'),
    createdAt: new Date('2024-01-20T14:30:00Z'),
  },
];

describe('Transaction Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(transactionRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /transactions/:address', () => {
    const validAddress = '0x1234567890123456789012345678901234567890';

    describe('successful requests', () => {
      it('should return transactions for a valid address', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions);
        vi.mocked(prisma.transaction.count).mockResolvedValue(2);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}`,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.data).toBeDefined();
        expect(body.data).toHaveLength(2);
        expect(body.pagination).toBeDefined();
        expect(body.pagination.total).toBe(2);
      });

      it('should return properly formatted transaction data', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTransactions[0]]);
        vi.mocked(prisma.transaction.count).mockResolvedValue(1);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}`,
        });

        const body = response.json();
        const tx = body.data[0];

        expect(tx.id).toBe('tx-1');
        expect(tx.txHash).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
        expect(tx.type).toBe('deposit');
        expect(tx.amount).toBe('1000000000000000000000');
        expect(tx.shares).toBe('1000000000000000000000');
        expect(tx.sharePrice).toBe('1000000000000000000');
        expect(tx.timestamp).toBeDefined();
      });

      it('should return empty array when user has no transactions', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
        vi.mocked(prisma.transaction.count).mockResolvedValue(0);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}`,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.data).toEqual([]);
        expect(body.pagination.total).toBe(0);
      });
    });

    describe('pagination', () => {
      it('should support limit parameter', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTransactions[0]]);
        vi.mocked(prisma.transaction.count).mockResolvedValue(2);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?limit=1`,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.data).toHaveLength(1);
        expect(body.pagination.limit).toBe(1);
      });

      it('should support offset parameter', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTransactions[1]]);
        vi.mocked(prisma.transaction.count).mockResolvedValue(2);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?offset=1`,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.pagination.offset).toBe(1);
      });

      it('should return pagination metadata', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions);
        vi.mocked(prisma.transaction.count).mockResolvedValue(50);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?limit=10&offset=0`,
        });

        const body = response.json();
        expect(body.pagination.total).toBe(50);
        expect(body.pagination.limit).toBe(10);
        expect(body.pagination.offset).toBe(0);
        expect(body.pagination.hasMore).toBe(true);
      });

      it('should use default pagination values', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions);
        vi.mocked(prisma.transaction.count).mockResolvedValue(2);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}`,
        });

        const body = response.json();
        expect(body.pagination.limit).toBe(20); // default limit
        expect(body.pagination.offset).toBe(0); // default offset
      });
    });

    describe('time filtering', () => {
      it('should filter by days parameter', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTransactions[1]]);
        vi.mocked(prisma.transaction.count).mockResolvedValue(1);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?days=7`,
        });

        expect(response.statusCode).toBe(200);
        // Verify the query was called with proper date filter
        expect(prisma.transaction.findMany).toHaveBeenCalled();
      });

      it('should filter by startDate parameter', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions);
        vi.mocked(prisma.transaction.count).mockResolvedValue(2);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?startDate=2024-01-01`,
        });

        expect(response.statusCode).toBe(200);
      });

      it('should filter by endDate parameter', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTransactions[0]]);
        vi.mocked(prisma.transaction.count).mockResolvedValue(1);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?endDate=2024-01-18`,
        });

        expect(response.statusCode).toBe(200);
      });

      it('should filter by date range', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions);
        vi.mocked(prisma.transaction.count).mockResolvedValue(2);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?startDate=2024-01-01&endDate=2024-01-31`,
        });

        expect(response.statusCode).toBe(200);
      });
    });

    describe('type filtering', () => {
      it('should filter by transaction type - deposit', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTransactions[0]]);
        vi.mocked(prisma.transaction.count).mockResolvedValue(1);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?type=deposit`,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.data[0].type).toBe('deposit');
      });

      it('should filter by transaction type - withdraw', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTransactions[1]]);
        vi.mocked(prisma.transaction.count).mockResolvedValue(1);

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?type=withdraw`,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.data[0].type).toBe('withdraw');
      });
    });

    describe('validation', () => {
      it('should return 400 for invalid address format', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/transactions/invalid-address',
        });

        expect(response.statusCode).toBe(400);
        const body = response.json();
        expect(body.error).toBeDefined();
      });

      it('should return 400 for invalid limit parameter', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?limit=-1`,
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for limit exceeding maximum', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?limit=1000`,
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for invalid date format', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?startDate=not-a-date`,
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for invalid type parameter', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}?type=invalid`,
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('error handling', () => {
      it('should return 500 when database error occurs', async () => {
        vi.mocked(prisma.transaction.findMany).mockRejectedValue(new Error('Database connection failed'));

        const response = await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}`,
        });

        expect(response.statusCode).toBe(500);
        const body = response.json();
        expect(body.error).toBeDefined();
      });
    });

    describe('sorting', () => {
      it('should sort by timestamp descending by default', async () => {
        vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions);
        vi.mocked(prisma.transaction.count).mockResolvedValue(2);

        await app.inject({
          method: 'GET',
          url: `/transactions/${validAddress}`,
        });

        expect(prisma.transaction.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { timestamp: 'desc' },
          })
        );
      });
    });
  });
});

describe('Transaction Routes - Exports', () => {
  it('exports transactionRoutes function', async () => {
    const { transactionRoutes } = await import('../routes/transactions.js');
    expect(transactionRoutes).toBeDefined();
    expect(typeof transactionRoutes).toBe('function');
  });
});
