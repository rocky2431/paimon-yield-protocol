import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

// =============================================================================
// Mock Setup - Must be before imports
// =============================================================================

vi.mock('../services/vault.service', () => ({
  getNetValueHistory: vi.fn(),
  getLatestNetValue: vi.fn(),
}));

// Import after mock setup
import { netvalueRoutes } from '../routes/netvalue';
import * as vaultService from '../services/vault.service';

// =============================================================================
// Mock Data Factory
// =============================================================================

function createMockNetValueRecords() {
  return [
    {
      id: '1',
      timestamp: new Date('2025-11-01T00:00:00Z'),
      totalAssets: BigInt('1000000000000000000000'), // 1000 USDT
      totalShares: BigInt('1000000000000000000000'), // 1000 shares
      sharePrice: BigInt('1000000000000000000'), // 1.0 per share
      blockNumber: BigInt(1000000),
      createdAt: new Date(),
    },
    {
      id: '2',
      timestamp: new Date('2025-11-15T00:00:00Z'),
      totalAssets: BigInt('1050000000000000000000'), // 1050 USDT
      totalShares: BigInt('1000000000000000000000'), // 1000 shares
      sharePrice: BigInt('1050000000000000000'), // 1.05 per share
      blockNumber: BigInt(1100000),
      createdAt: new Date(),
    },
    {
      id: '3',
      timestamp: new Date('2025-11-25T00:00:00Z'),
      totalAssets: BigInt('1100000000000000000000'), // 1100 USDT
      totalShares: BigInt('1000000000000000000000'), // 1000 shares
      sharePrice: BigInt('1100000000000000000'), // 1.1 per share
      blockNumber: BigInt(1200000),
      createdAt: new Date(),
    },
  ];
}

// =============================================================================
// Test Setup
// =============================================================================

async function buildTestServer() {
  const server = Fastify({ logger: false });
  await server.register(netvalueRoutes, { prefix: '/api' });
  return server;
}

// =============================================================================
// Tests
// =============================================================================

describe('Netvalue API Routes', () => {
  let server: ReturnType<typeof Fastify>;
  let mockRecords: ReturnType<typeof createMockNetValueRecords>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRecords = createMockNetValueRecords();
    vi.mocked(vaultService.getNetValueHistory).mockResolvedValue(mockRecords);
    vi.mocked(vaultService.getLatestNetValue).mockResolvedValue(mockRecords[2]);
    server = await buildTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('GET /api/netvalue', () => {
    it('should return net value history with default 30 days', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/netvalue',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.history).toBeInstanceOf(Array);
      expect(body.data.summary).toBeDefined();
    });

    it('should return history records with correct fields', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/netvalue?days=30',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      const record = body.data.history[0];

      expect(record).toHaveProperty('timestamp');
      expect(record).toHaveProperty('sharePrice');
      expect(record).toHaveProperty('totalAssets');
      expect(record).toHaveProperty('totalShares');
      expect(record).toHaveProperty('apy');
    });

    it('should return summary with correct fields', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/netvalue?days=30',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      const summary = body.data.summary;

      expect(summary).toHaveProperty('currentPrice');
      expect(summary).toHaveProperty('startPrice');
      expect(summary).toHaveProperty('periodReturn');
      expect(summary).toHaveProperty('annualizedReturn');
      expect(summary).toHaveProperty('dataPoints');
    });

    it('should calculate correct period return', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/netvalue?days=30',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      const summary = body.data.summary;

      // Start price: 1.0, End price: 1.1 = 10% return
      expect(summary.periodReturn).toBe(10);
    });

    it('should support days=7 parameter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/netvalue?days=7',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });

    it('should support days=90 parameter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/netvalue?days=90',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });

    it('should reject invalid days parameter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/netvalue?days=15',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle empty history gracefully', async () => {
      vi.mocked(vaultService.getNetValueHistory).mockResolvedValueOnce([]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/netvalue?days=30',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.history).toHaveLength(0);
      expect(body.data.summary.dataPoints).toBe(0);
    });

    it('should return ISO format timestamps', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/netvalue?days=30',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      const timestamp = body.data.history[0].timestamp;

      // Should be valid ISO date
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should return string values for BigInt fields', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/netvalue?days=30',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      const record = body.data.history[0];

      expect(typeof record.sharePrice).toBe('string');
      expect(typeof record.totalAssets).toBe('string');
      expect(typeof record.totalShares).toBe('string');
    });
  });
});

describe('Netvalue API - APY Calculations', () => {
  let server: ReturnType<typeof Fastify>;
  let mockRecords: ReturnType<typeof createMockNetValueRecords>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRecords = createMockNetValueRecords();
    vi.mocked(vaultService.getNetValueHistory).mockResolvedValue(mockRecords);
    vi.mocked(vaultService.getLatestNetValue).mockResolvedValue(mockRecords[2]);
    server = await buildTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('should calculate APY for each data point', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/netvalue?days=30',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // First record should have 0 APY (no previous)
    expect(body.data.history[0].apy).toBe(0);

    // Subsequent records should have calculated APY
    expect(typeof body.data.history[1].apy).toBe('number');
    expect(typeof body.data.history[2].apy).toBe('number');
  });

  it('should return reasonable APY values', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/netvalue?days=30',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    for (const record of body.data.history) {
      // APY should be within reasonable range (-100% to 10000%)
      expect(record.apy).toBeGreaterThanOrEqual(-100);
      expect(record.apy).toBeLessThanOrEqual(10000);
    }
  });

  it('should calculate annualized return correctly', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/netvalue?days=30',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    const summary = body.data.summary;

    // 10% return over 30 days = ~121.67% annualized (10 * 365/30)
    expect(summary.annualizedReturn).toBeGreaterThan(100);
    expect(summary.annualizedReturn).toBeLessThan(150);
  });
});

describe('Netvalue API - Error Handling', () => {
  let server: ReturnType<typeof Fastify>;
  let mockRecords: ReturnType<typeof createMockNetValueRecords>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRecords = createMockNetValueRecords();
    vi.mocked(vaultService.getNetValueHistory).mockResolvedValue(mockRecords);
    vi.mocked(vaultService.getLatestNetValue).mockResolvedValue(mockRecords[2]);
    server = await buildTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(vaultService.getNetValueHistory).mockRejectedValueOnce(new Error('Database error'));

    const response = await server.inject({
      method: 'GET',
      url: '/api/netvalue?days=30',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to fetch net value history');
  });

  it('should reject negative days parameter', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/netvalue?days=-1',
    });

    // Fastify schema validation should reject
    expect(response.statusCode).toBe(400);
  });

  it('should reject non-integer days parameter', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/netvalue?days=30.5',
    });

    expect(response.statusCode).toBe(400);
  });

  it('should reject days=0', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/netvalue?days=0',
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Netvalue API - Edge Cases', () => {
  let server: ReturnType<typeof Fastify>;
  let mockRecords: ReturnType<typeof createMockNetValueRecords>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRecords = createMockNetValueRecords();
    vi.mocked(vaultService.getNetValueHistory).mockResolvedValue(mockRecords);
    vi.mocked(vaultService.getLatestNetValue).mockResolvedValue(mockRecords[2]);
    server = await buildTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('should handle single record history', async () => {
    vi.mocked(vaultService.getNetValueHistory).mockResolvedValueOnce([mockRecords[0]]);

    const response = await server.inject({
      method: 'GET',
      url: '/api/netvalue?days=30',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.history).toHaveLength(1);
    expect(body.data.summary.periodReturn).toBe(0); // No change with single record
  });

  it('should handle zero share price gracefully', async () => {
    vi.mocked(vaultService.getNetValueHistory).mockResolvedValueOnce([
      {
        ...mockRecords[0],
        sharePrice: BigInt(0),
      },
      mockRecords[1],
    ]);

    const response = await server.inject({
      method: 'GET',
      url: '/api/netvalue?days=30',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });

  it('should round APY to 2 decimal places', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/netvalue?days=30',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    for (const record of body.data.history) {
      const apyStr = record.apy.toString();
      const decimalIndex = apyStr.indexOf('.');
      if (decimalIndex !== -1) {
        const decimals = apyStr.length - decimalIndex - 1;
        expect(decimals).toBeLessThanOrEqual(2);
      }
    }
  });
});
