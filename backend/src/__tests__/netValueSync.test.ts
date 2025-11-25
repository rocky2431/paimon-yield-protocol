import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateSharePrice,
  syncNetValue,
  startNetValueSyncJob,
  stopNetValueSyncJob,
  getJobStatus,
} from '../jobs/netValueSync';

// =============================================================================
// Mocks
// =============================================================================

// Mock Viem
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBlockNumber: vi.fn().mockResolvedValue(1000000n),
      readContract: vi.fn().mockImplementation(({ functionName }) => {
        if (functionName === 'totalAssets') {
          return Promise.resolve(1000000n * 10n ** 18n); // 1M USDT
        }
        if (functionName === 'totalSupply') {
          return Promise.resolve(950000n * 10n ** 18n); // 950K shares
        }
        return Promise.resolve(0n);
      }),
    })),
  };
});

// Mock blockchain service
vi.mock('../services/blockchain', () => ({
  publicClient: {
    getBlockNumber: vi.fn().mockResolvedValue(1000000n),
    readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === 'totalAssets') {
        return Promise.resolve(1000000n * 10n ** 18n); // 1M USDT
      }
      if (functionName === 'totalSupply') {
        return Promise.resolve(950000n * 10n ** 18n); // 950K shares
      }
      return Promise.resolve(0n);
    }),
  },
  contracts: {
    pngyVault: undefined, // Will test with mock data
    usdt: '0x55d398326f99059fF775485246999027B3197955',
  },
}));

// Mock vault service
vi.mock('../services/vault.service', () => ({
  createNetValue: vi.fn().mockResolvedValue({
    id: 'test-id',
    timestamp: new Date(),
    totalAssets: '1000000000000000000000000',
    totalShares: '950000000000000000000000',
    sharePrice: '1052631578947368421',
    blockNumber: 1000000n,
    createdAt: new Date(),
  }),
  getLatestNetValue: vi.fn().mockResolvedValue(null),
}));

// Mock env
vi.mock('../config/env', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

// Mock node-cron
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn().mockReturnValue({
      stop: vi.fn(),
    }),
  },
}));

// =============================================================================
// Tests
// =============================================================================

// Reset module state between tests
async function resetModule() {
  vi.resetModules();
  const module = await import('../jobs/netValueSync');
  return module;
}

describe('NetValueSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopNetValueSyncJob();
  });

  describe('calculateSharePrice', () => {
    it('should return default price when totalShares is 0', () => {
      const result = calculateSharePrice(1000n, 0n);
      expect(result).toBe(10n ** 18n); // 1e18 default
    });

    it('should calculate correct share price with 1:1 ratio', () => {
      const totalAssets = 1000n * 10n ** 18n; // 1000 USDT
      const totalShares = 1000n * 10n ** 18n; // 1000 shares
      const result = calculateSharePrice(totalAssets, totalShares);
      expect(result).toBe(10n ** 18n); // 1 USDT per share
    });

    it('should calculate correct share price with profit', () => {
      const totalAssets = 1100n * 10n ** 18n; // 1100 USDT (10% profit)
      const totalShares = 1000n * 10n ** 18n; // 1000 shares
      const result = calculateSharePrice(totalAssets, totalShares);
      expect(result).toBe(11n * 10n ** 17n); // 1.1 USDT per share
    });

    it('should calculate correct share price with loss', () => {
      const totalAssets = 900n * 10n ** 18n; // 900 USDT (10% loss)
      const totalShares = 1000n * 10n ** 18n; // 1000 shares
      const result = calculateSharePrice(totalAssets, totalShares);
      expect(result).toBe(9n * 10n ** 17n); // 0.9 USDT per share
    });

    it('should handle large numbers correctly', () => {
      const totalAssets = 1000000n * 10n ** 18n; // 1M USDT
      const totalShares = 950000n * 10n ** 18n; // 950K shares
      const result = calculateSharePrice(totalAssets, totalShares);
      // Expected: 1000000 / 950000 * 1e18 = 1.0526... * 1e18
      expect(result).toBeGreaterThan(10n ** 18n);
      expect(result).toBeLessThan(11n * 10n ** 17n);
    });

    it('should maintain precision for small differences', () => {
      const totalAssets = 1000001n * 10n ** 18n;
      const totalShares = 1000000n * 10n ** 18n;
      const result = calculateSharePrice(totalAssets, totalShares);
      // Should be slightly above 1e18
      expect(result).toBeGreaterThan(10n ** 18n);
    });
  });

  describe('syncNetValue', () => {
    it('should successfully sync with mock data when vault not configured', async () => {
      const result = await syncNetValue();

      expect(result.success).toBe(true);
      expect(result.record).toBeDefined();
      expect(result.record?.totalAssets).toBe(0n);
      expect(result.record?.totalShares).toBe(0n);
      expect(result.record?.sharePrice).toBe(10n ** 18n);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should not run if already running', async () => {
      // Start first sync
      const firstSync = syncNetValue();

      // Try to start second sync immediately
      const secondResult = await syncNetValue();

      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toBe('Job already running');

      // Wait for first sync to complete
      await firstSync;
    });

    it('should update lastRun on success', async () => {
      const beforeRun = getJobStatus().lastRun;

      await syncNetValue();

      const afterStatus = getJobStatus();
      // lastRun should be updated (either from null or to a newer time)
      expect(afterStatus.lastRun).not.toBeNull();
      if (beforeRun) {
        expect(afterStatus.lastRun!.getTime()).toBeGreaterThanOrEqual(beforeRun.getTime());
      }
    });

    it('should return duration in result', async () => {
      const result = await syncNetValue();

      expect(result.duration).toBeDefined();
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('startNetValueSyncJob', () => {
    it('should start without error', () => {
      expect(() => startNetValueSyncJob()).not.toThrow();
    });

    it('should handle multiple start calls', () => {
      // First call should start the job
      startNetValueSyncJob();

      // Second call should either start again or log already started
      // (depends on module state - just verify no errors)
      expect(() => startNetValueSyncJob()).not.toThrow();
    });
  });

  describe('stopNetValueSyncJob', () => {
    it('should stop without error', () => {
      startNetValueSyncJob();
      expect(() => stopNetValueSyncJob()).not.toThrow();
    });

    it('should handle stopping when not started', () => {
      expect(() => stopNetValueSyncJob()).not.toThrow();
    });
  });

  describe('getJobStatus', () => {
    it('should return correct initial status', () => {
      const status = getJobStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('lastRun');
      expect(status).toHaveProperty('lastError');
      expect(status).toHaveProperty('schedule');
      expect(status).toHaveProperty('vaultConfigured');
      expect(status.schedule).toBe('0 * * * *');
    });

    it('should show vault not configured', () => {
      const status = getJobStatus();
      expect(status.vaultConfigured).toBe(false);
    });
  });
});

describe('NetValueSync - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateSharePrice edge cases', () => {
    it('should handle very small totalShares', () => {
      const totalAssets = 10n ** 18n; // 1 USDT
      const totalShares = 1n; // Very small
      const result = calculateSharePrice(totalAssets, totalShares);
      expect(result).toBe(10n ** 36n); // Very high NAV
    });

    it('should handle equal assets and shares', () => {
      const amount = 12345n * 10n ** 18n;
      const result = calculateSharePrice(amount, amount);
      expect(result).toBe(10n ** 18n);
    });

    it('should handle zero totalAssets with non-zero shares', () => {
      const result = calculateSharePrice(0n, 1000n * 10n ** 18n);
      expect(result).toBe(0n);
    });
  });
});

describe('NetValueSync - Precision Tests', () => {
  describe('NAV calculation precision', () => {
    it('should maintain 18 decimal precision', () => {
      // 1,000,000.123456789012345678 USDT
      const totalAssets = 1000000123456789012345678n;
      // 1,000,000 shares
      const totalShares = 1000000n * 10n ** 18n;

      const result = calculateSharePrice(totalAssets, totalShares);

      // Should be approximately 1.000000123456789012 * 1e18
      expect(result).toBeGreaterThan(10n ** 18n);
      expect(result.toString().length).toBeGreaterThanOrEqual(18);
    });

    it('should handle rounding consistently', () => {
      // Test case where division doesn't result in exact integer
      const totalAssets = 100n * 10n ** 18n;
      const totalShares = 3n * 10n ** 18n;

      const result = calculateSharePrice(totalAssets, totalShares);

      // 100 / 3 = 33.333... * 1e18 (should truncate, not round)
      const expected = (100n * 10n ** 36n) / (3n * 10n ** 18n);
      expect(result).toBe(expected);
    });
  });
});
