import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

// =============================================================================
// Mock Setup - Must be before imports
// =============================================================================

vi.mock('../services/vault.service', () => ({
  getActiveAllocations: vi.fn(),
  getRecentRebalances: vi.fn(),
}));

// Import after mock setup
import { assetsRoutes } from '../routes/assets';
import * as vaultService from '../services/vault.service';

// =============================================================================
// Mock Data Factory
// =============================================================================

function createMockAllocations() {
  return [
    {
      id: '1',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenName: 'BlackRock USD Institutional Digital Liquidity Fund',
      tokenSymbol: 'BUIDL',
      allocation: { toNumber: () => 0.4 }, // 40%
      balance: BigInt('1000000000000000000000000'), // 1M tokens
      valueUsd: BigInt('1000000000000000000000000'), // $1M
      apy: { toNumber: () => 5.2 },
      isActive: true,
      updatedAt: new Date(),
    },
    {
      id: '2',
      tokenAddress: '0x2345678901234567890123456789012345678901',
      tokenName: 'Ondo US Dollar Yield',
      tokenSymbol: 'USDY',
      allocation: { toNumber: () => 0.35 }, // 35%
      balance: BigInt('875000000000000000000000'), // 875K tokens
      valueUsd: BigInt('875000000000000000000000'), // $875K
      apy: { toNumber: () => 5.8 },
      isActive: true,
      updatedAt: new Date(),
    },
    {
      id: '3',
      tokenAddress: '0x3456789012345678901234567890123456789012',
      tokenName: 'OpenEden T-Bill',
      tokenSymbol: 'TBILL',
      allocation: { toNumber: () => 0.25 }, // 25%
      balance: BigInt('625000000000000000000000'), // 625K tokens
      valueUsd: BigInt('625000000000000000000000'), // $625K
      apy: { toNumber: () => 6.5 },
      isActive: true,
      updatedAt: new Date(),
    },
  ];
}

function createMockRebalances() {
  return [
    {
      id: '1',
      txHash: '0xabc123',
      type: 'REBALANCE',
      fromAsset: '0x1111111111111111111111111111111111111111',
      toAsset: '0x2222222222222222222222222222222222222222',
      fromAmount: BigInt('100000000000000000000000'),
      toAmount: BigInt('100000000000000000000000'),
      blockNumber: BigInt(1000000),
      timestamp: new Date('2025-11-20T12:00:00Z'),
      createdAt: new Date(),
    },
  ];
}

// =============================================================================
// Test Setup
// =============================================================================

async function buildTestServer() {
  const server = Fastify({ logger: false });
  await server.register(assetsRoutes, { prefix: '/api' });
  return server;
}

// =============================================================================
// Tests
// =============================================================================

describe('Assets API Routes', () => {
  let server: ReturnType<typeof Fastify>;
  let mockAllocations: ReturnType<typeof createMockAllocations>;
  let mockRebalances: ReturnType<typeof createMockRebalances>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAllocations = createMockAllocations();
    mockRebalances = createMockRebalances();
    vi.mocked(vaultService.getActiveAllocations).mockResolvedValue(mockAllocations as any);
    vi.mocked(vaultService.getRecentRebalances).mockResolvedValue(mockRebalances as any);
    server = await buildTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('GET /api/assets/allocation', () => {
    it('should return asset allocations successfully', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.allocations).toBeInstanceOf(Array);
      expect(body.data.summary).toBeDefined();
    });

    it('should return correct allocation fields', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      const allocation = body.data.allocations[0];

      expect(allocation).toHaveProperty('tokenAddress');
      expect(allocation).toHaveProperty('name');
      expect(allocation).toHaveProperty('symbol');
      expect(allocation).toHaveProperty('targetAllocation');
      expect(allocation).toHaveProperty('actualAllocation');
      expect(allocation).toHaveProperty('balance');
      expect(allocation).toHaveProperty('valueUsd');
      expect(allocation).toHaveProperty('apy');
      expect(allocation).toHaveProperty('isActive');
    });

    it('should return correct summary fields', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      const summary = body.data.summary;

      expect(summary).toHaveProperty('totalValueUsd');
      expect(summary).toHaveProperty('averageApy');
      expect(summary).toHaveProperty('lastRebalance');
      expect(summary).toHaveProperty('assetCount');
    });

    it('should calculate correct total value', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      // Total: $1M + $875K + $625K = $2.5M
      const expectedTotal = '2500000000000000000000000';
      expect(body.data.summary.totalValueUsd).toBe(expectedTotal);
    });

    it('should calculate weighted average APY', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      // Weighted APY: (1M * 5.2 + 875K * 5.8 + 625K * 6.5) / 2.5M
      // = (5200000 + 5075000 + 4062500) / 2500000
      // = 14337500 / 2500000 = 5.735
      expect(body.data.summary.averageApy).toBeGreaterThan(5);
      expect(body.data.summary.averageApy).toBeLessThan(7);
    });

    it('should return correct asset count', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.summary.assetCount).toBe(3);
    });

    it('should return last rebalance timestamp', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.summary.lastRebalance).toBe('2025-11-20T12:00:00.000Z');
    });

    it('should handle no rebalance history', async () => {
      vi.mocked(vaultService.getRecentRebalances).mockResolvedValueOnce([]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.summary.lastRebalance).toBeNull();
    });

    it('should handle empty allocations', async () => {
      vi.mocked(vaultService.getActiveAllocations).mockResolvedValueOnce([]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.allocations).toHaveLength(0);
      expect(body.data.summary.assetCount).toBe(0);
      expect(body.data.summary.totalValueUsd).toBe('0');
      expect(body.data.summary.averageApy).toBe(0);
    });

    it('should convert target allocation to percentage', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      // First allocation: 0.4 → 40%
      expect(body.data.allocations[0].targetAllocation).toBe(40);
      // Second allocation: 0.35 → 35%
      expect(body.data.allocations[1].targetAllocation).toBe(35);
      // Third allocation: 0.25 → 25%
      expect(body.data.allocations[2].targetAllocation).toBe(25);
    });

    it('should calculate actual allocation from value', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/allocation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      // First: $1M / $2.5M = 40%
      expect(body.data.allocations[0].actualAllocation).toBe(40);
      // Second: $875K / $2.5M = 35%
      expect(body.data.allocations[1].actualAllocation).toBe(35);
      // Third: $625K / $2.5M = 25%
      expect(body.data.allocations[2].actualAllocation).toBe(25);
    });
  });
});

describe('Assets API - Error Handling', () => {
  let server: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(vaultService.getActiveAllocations).mockResolvedValue([]);
    vi.mocked(vaultService.getRecentRebalances).mockResolvedValue([]);
    server = await buildTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(vaultService.getActiveAllocations).mockRejectedValueOnce(new Error('Database error'));

    const response = await server.inject({
      method: 'GET',
      url: '/api/assets/allocation',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to fetch asset allocations');
  });

  it('should handle rebalance query errors gracefully', async () => {
    const mockAllocations = createMockAllocations();
    vi.mocked(vaultService.getActiveAllocations).mockResolvedValue(mockAllocations as any);
    vi.mocked(vaultService.getRecentRebalances).mockRejectedValueOnce(new Error('Query error'));

    const response = await server.inject({
      method: 'GET',
      url: '/api/assets/allocation',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(false);
  });
});

describe('Assets API - Edge Cases', () => {
  let server: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    server = await buildTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('should handle single allocation', async () => {
    const singleAllocation = [createMockAllocations()[0]];
    vi.mocked(vaultService.getActiveAllocations).mockResolvedValue(singleAllocation as any);
    vi.mocked(vaultService.getRecentRebalances).mockResolvedValue([]);

    const response = await server.inject({
      method: 'GET',
      url: '/api/assets/allocation',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.allocations).toHaveLength(1);
    expect(body.data.summary.assetCount).toBe(1);
    // Single asset = 100% actual allocation
    expect(body.data.allocations[0].actualAllocation).toBe(100);
  });

  it('should handle zero value allocation', async () => {
    const zeroValueAllocation = [{
      ...createMockAllocations()[0],
      valueUsd: BigInt(0),
    }];
    vi.mocked(vaultService.getActiveAllocations).mockResolvedValue(zeroValueAllocation as any);
    vi.mocked(vaultService.getRecentRebalances).mockResolvedValue([]);

    const response = await server.inject({
      method: 'GET',
      url: '/api/assets/allocation',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.summary.totalValueUsd).toBe('0');
    expect(body.data.summary.averageApy).toBe(0);
  });

  it('should return string values for BigInt fields', async () => {
    vi.mocked(vaultService.getActiveAllocations).mockResolvedValue(createMockAllocations() as any);
    vi.mocked(vaultService.getRecentRebalances).mockResolvedValue([]);

    const response = await server.inject({
      method: 'GET',
      url: '/api/assets/allocation',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    const allocation = body.data.allocations[0];

    expect(typeof allocation.balance).toBe('string');
    expect(typeof allocation.valueUsd).toBe('string');
    expect(typeof body.data.summary.totalValueUsd).toBe('string');
  });

  it('should round APY to 2 decimal places', async () => {
    vi.mocked(vaultService.getActiveAllocations).mockResolvedValue(createMockAllocations() as any);
    vi.mocked(vaultService.getRecentRebalances).mockResolvedValue([]);

    const response = await server.inject({
      method: 'GET',
      url: '/api/assets/allocation',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    for (const allocation of body.data.allocations) {
      const apyStr = allocation.apy.toString();
      const decimalIndex = apyStr.indexOf('.');
      if (decimalIndex !== -1) {
        const decimals = apyStr.length - decimalIndex - 1;
        expect(decimals).toBeLessThanOrEqual(2);
      }
    }
  });
});
