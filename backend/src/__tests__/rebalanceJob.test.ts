import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Mocks - Must be defined before imports
// =============================================================================

// Mock node-cron
const mockScheduledTask = {
  stop: vi.fn(),
};

vi.mock('node-cron', () => ({
  schedule: vi.fn(() => mockScheduledTask),
}));

// Mock rebalanceEngine
const mockExecuteRebalanceCheck = vi.fn();
const mockGetRebalanceStatus = vi.fn();

vi.mock('../services/rebalanceEngine', () => ({
  executeRebalanceCheck: () => mockExecuteRebalanceCheck(),
  getRebalanceStatus: () => mockGetRebalanceStatus(),
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import * as cron from 'node-cron';
import {
  startRebalanceJob,
  stopRebalanceJob,
  triggerRebalanceCheck,
  getJobStatus,
  getRebalanceHistory,
} from '../jobs/rebalanceJob';

// =============================================================================
// Tests
// =============================================================================

describe('RebalanceJob', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state by re-importing
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.REBALANCE_JOB_ENABLED = 'true';
    process.env.REBALANCE_CRON_SCHEDULE = '0 0 * * *';
  });

  afterEach(() => {
    stopRebalanceJob();
    process.env = originalEnv;
  });

  describe('startRebalanceJob', () => {
    it('should start cron job with correct schedule', () => {
      startRebalanceJob();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 0 * * *',
        expect.any(Function),
        {
          scheduled: true,
          timezone: 'UTC',
        }
      );
    });

    it('should not start if already running', () => {
      startRebalanceJob();
      startRebalanceJob();

      // Should only be called once
      expect(cron.schedule).toHaveBeenCalledTimes(1);
    });

    it('should not start if disabled via env', async () => {
      // Need to re-import module with new env
      process.env.REBALANCE_JOB_ENABLED = 'false';

      // Force re-import
      vi.resetModules();
      const { startRebalanceJob: startJobDisabled } = await import('../jobs/rebalanceJob');

      startJobDisabled();

      expect(cron.schedule).not.toHaveBeenCalled();
    });
  });

  describe('stopRebalanceJob', () => {
    it('should stop the scheduled task', () => {
      startRebalanceJob();
      stopRebalanceJob();

      expect(mockScheduledTask.stop).toHaveBeenCalled();
    });

    it('should handle stop when no job running', () => {
      // Should not throw
      expect(() => stopRebalanceJob()).not.toThrow();
    });
  });

  describe('triggerRebalanceCheck', () => {
    it('should manually trigger rebalance check', async () => {
      mockExecuteRebalanceCheck.mockResolvedValue({
        checked: true,
        proposalCreated: false,
        error: undefined,
      });

      const result = await triggerRebalanceCheck();

      expect(mockExecuteRebalanceCheck).toHaveBeenCalled();
      expect(result.checked).toBe(true);
    });

    it('should return result when proposal created', async () => {
      mockExecuteRebalanceCheck.mockResolvedValue({
        checked: true,
        proposalCreated: true,
        proposal: {
          maxDeviation: 6.5,
          sellAssets: ['0x111'],
          buyAssets: ['0x222'],
        },
        error: undefined,
      });

      const result = await triggerRebalanceCheck();

      expect(result.checked).toBe(true);
      expect(result.proposalCreated).toBe(true);
    });

    it('should handle errors from rebalance check', async () => {
      mockExecuteRebalanceCheck.mockRejectedValue(new Error('Check failed'));

      const result = await triggerRebalanceCheck();

      expect(result.checked).toBe(false);
      expect(result.error).toBe('Check failed');
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when running', () => {
      startRebalanceJob();

      const status = getJobStatus();

      expect(status.enabled).toBe(true);
      expect(status.running).toBe(true);
      expect(status.schedule).toBe('0 0 * * *');
    });

    it('should return job status when not running', () => {
      const status = getJobStatus();

      expect(status.enabled).toBe(true);
      expect(status.running).toBe(false);
    });

    it('should include last run result', async () => {
      mockExecuteRebalanceCheck.mockResolvedValue({
        checked: true,
        proposalCreated: true,
        error: undefined,
      });

      await triggerRebalanceCheck();
      const status = getJobStatus();

      expect(status.lastRun).not.toBeNull();
      expect(status.lastRun?.checked).toBe(true);
      expect(status.lastRun?.proposalCreated).toBe(true);
    });
  });

  describe('getRebalanceHistory', () => {
    it('should delegate to rebalanceEngine.getRebalanceStatus', async () => {
      const mockHistory = {
        lastCheck: new Date(),
        pendingProposals: 1,
        recentRebalances: [],
      };
      mockGetRebalanceStatus.mockResolvedValue(mockHistory);

      const result = await getRebalanceHistory();

      expect(mockGetRebalanceStatus).toHaveBeenCalled();
      expect(result).toEqual(mockHistory);
    });
  });
});

describe('RebalanceJob - Cron Execution', () => {
  let cronCallback: () => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REBALANCE_JOB_ENABLED = 'true';

    // Capture the callback passed to cron.schedule
    vi.mocked(cron.schedule).mockImplementation((_, callback) => {
      cronCallback = callback as () => Promise<void>;
      return mockScheduledTask;
    });
  });

  afterEach(() => {
    stopRebalanceJob();
  });

  it('should execute rebalance check when cron fires', async () => {
    mockExecuteRebalanceCheck.mockResolvedValue({
      checked: true,
      proposalCreated: false,
    });

    startRebalanceJob();
    await cronCallback();

    expect(mockExecuteRebalanceCheck).toHaveBeenCalled();
  });

  it('should log when proposal is created', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    mockExecuteRebalanceCheck.mockResolvedValue({
      checked: true,
      proposalCreated: true,
      proposal: {
        maxDeviation: 6.5,
        sellAssets: ['0x111'],
        buyAssets: ['0x222', '0x333'],
      },
    });

    startRebalanceJob();
    await cronCallback();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Rebalance proposal created')
    );
  });

  it('should log when no rebalance needed', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    mockExecuteRebalanceCheck.mockResolvedValue({
      checked: true,
      proposalCreated: false,
    });

    startRebalanceJob();
    await cronCallback();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('no rebalance needed')
    );
  });

  it('should log when check is skipped', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    mockExecuteRebalanceCheck.mockResolvedValue({
      checked: false,
      proposalCreated: false,
      error: 'Contracts not configured',
    });

    startRebalanceJob();
    await cronCallback();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Check skipped')
    );
  });

  it('should handle execution errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    mockExecuteRebalanceCheck.mockRejectedValue(new Error('Execution failed'));

    startRebalanceJob();
    await cronCallback();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[RebalanceJob] Failed:'),
      'Execution failed'
    );
  });
});

describe('RebalanceJob - Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use custom schedule from env', async () => {
    process.env.REBALANCE_CRON_SCHEDULE = '0 */6 * * *'; // Every 6 hours
    process.env.REBALANCE_JOB_ENABLED = 'true';

    vi.resetModules();
    const { startRebalanceJob: start, stopRebalanceJob: stop } = await import('../jobs/rebalanceJob');

    start();

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 */6 * * *',
      expect.any(Function),
      expect.any(Object)
    );

    stop();
  });

  it('should default to daily at midnight UTC', async () => {
    delete process.env.REBALANCE_CRON_SCHEDULE;
    process.env.REBALANCE_JOB_ENABLED = 'true';

    vi.resetModules();
    const { startRebalanceJob: start, stopRebalanceJob: stop } = await import('../jobs/rebalanceJob');

    start();

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 0 * * *',
      expect.any(Function),
      expect.any(Object)
    );

    stop();
  });
});
