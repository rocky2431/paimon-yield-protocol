/**
 * Report Routes Tests
 * Task #58 - 实现 B2B 定制化报表导出
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock dependencies before importing server
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'test-email-id' }, error: null }),
    },
  })),
}));

vi.mock('../services/database', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    netValue: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    userPosition: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    notificationLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock the report service
vi.mock('../services/reportService', () => ({
  generateReport: vi.fn(),
  getReportFilename: vi.fn(),
}));

import { buildServer } from '../server.js';
import * as reportService from '../services/reportService.js';

describe('Report Routes', () => {
  let server: FastifyInstance;

  const mockTransactionCSV = `date,type,amount,shares,sharePrice,txHash,blockNumber
2024-01-15T10:00:00.000Z,DEPOSIT,1000.000000,950.000000,1.052631,0xabc123,12345678
2024-01-14T08:00:00.000Z,WITHDRAW,500.000000,475.000000,1.052631,0xdef456,12345670`;

  const mockNetValueCSV = `date,totalAssets,totalShares,sharePrice,apy
2024-01-15T00:00:00.000Z,1000000.000000,950000.000000,1.052631,5.500000
2024-01-14T00:00:00.000Z,990000.000000,950000.000000,1.042105,5.200000`;

  const mockSummaryCSV = `metric,value
Wallet Address,0x1234567890123456789012345678901234567890
Total Deposits (USDT),10000.000000
Total Withdrawals (USDT),2000.000000
Current PNGY Shares,7600.000000
Total Yield (USDT),500.000000`;

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
  // GET /api/reports/export
  // ===========================================================================

  describe('GET /api/reports/export', () => {
    it('should export transaction report as CSV', async () => {
      vi.mocked(reportService.generateReport).mockResolvedValue(mockTransactionCSV);
      vi.mocked(reportService.getReportFilename).mockReturnValue('paimon-yield-transactions-2024-01-15.csv');

      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890&type=transactions',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
      expect(response.payload).toContain('date,type,amount');
      expect(response.payload).toContain('DEPOSIT');
    });

    it('should export netvalue report as CSV', async () => {
      vi.mocked(reportService.generateReport).mockResolvedValue(mockNetValueCSV);
      vi.mocked(reportService.getReportFilename).mockReturnValue('paimon-yield-netvalue-2024-01-15.csv');

      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890&type=netvalue',
      });

      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain('date,totalAssets,totalShares');
      expect(reportService.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: 'netvalue',
        })
      );
    });

    it('should export summary report as CSV', async () => {
      vi.mocked(reportService.generateReport).mockResolvedValue(mockSummaryCSV);
      vi.mocked(reportService.getReportFilename).mockReturnValue('paimon-yield-summary-2024-01-15.csv');

      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890&type=summary',
      });

      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain('metric,value');
      expect(response.payload).toContain('Total Deposits');
    });

    it('should default to transactions report type', async () => {
      vi.mocked(reportService.generateReport).mockResolvedValue(mockTransactionCSV);
      vi.mocked(reportService.getReportFilename).mockReturnValue('test.csv');

      await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890',
      });

      expect(reportService.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: 'transactions',
        })
      );
    });

    it('should pass date range to report generator', async () => {
      vi.mocked(reportService.generateReport).mockResolvedValue(mockTransactionCSV);
      vi.mocked(reportService.getReportFilename).mockReturnValue('test.csv');

      await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890&startDate=2024-01-01&endDate=2024-01-31',
      });

      expect(reportService.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );

      const callArgs = vi.mocked(reportService.generateReport).mock.calls[0][0];
      expect(callArgs.startDate?.toISOString()).toContain('2024-01-01');
      expect(callArgs.endDate?.toISOString()).toContain('2024-01-31');
    });

    it('should return 400 for invalid address format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=invalid-address',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing address', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?type=transactions',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid report type', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890&type=invalid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid startDate format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890&startDate=01-15-2024',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid endDate format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890&endDate=2024/01/31',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when startDate is after endDate', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890&startDate=2024-02-01&endDate=2024-01-01',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain('startDate must be before endDate');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(reportService.generateReport).mockRejectedValue(new Error('Database error'));

      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to generate report');
    });

    it('should set correct Content-Disposition header with filename', async () => {
      vi.mocked(reportService.generateReport).mockResolvedValue(mockTransactionCSV);
      vi.mocked(reportService.getReportFilename).mockReturnValue('paimon-yield-transactions-0x12345678-2024-01-15.csv');

      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/export?address=0x1234567890123456789012345678901234567890',
      });

      expect(response.headers['content-disposition']).toContain('paimon-yield-transactions-0x12345678');
    });
  });

  // ===========================================================================
  // GET /api/reports/types
  // ===========================================================================

  describe('GET /api/reports/types', () => {
    it('should return list of available report types', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/types',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.data.map((r: { type: string }) => r.type)).toContain('transactions');
      expect(body.data.map((r: { type: string }) => r.type)).toContain('netvalue');
      expect(body.data.map((r: { type: string }) => r.type)).toContain('summary');
    });

    it('should include descriptions for each report type', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/types',
      });

      const body = JSON.parse(response.payload);
      for (const reportType of body.data) {
        expect(reportType.description).toBeDefined();
        expect(reportType.description.length).toBeGreaterThan(0);
      }
    });

    it('should indicate which reports require address', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/reports/types',
      });

      const body = JSON.parse(response.payload);
      const transactionsType = body.data.find((r: { type: string }) => r.type === 'transactions');
      const netvalueType = body.data.find((r: { type: string }) => r.type === 'netvalue');

      expect(transactionsType.requiresAddress).toBe(true);
      expect(netvalueType.requiresAddress).toBe(false);
    });
  });
});
