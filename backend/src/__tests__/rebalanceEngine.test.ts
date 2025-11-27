import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Address } from 'viem';

// =============================================================================
// Hoisted Mocks - Available during module load
// =============================================================================

const { mockReadContract, mockEstimateGas, mockPrismaAssetAllocation, mockPrismaRebalanceHistory } = vi.hoisted(() => ({
  mockReadContract: vi.fn(),
  mockEstimateGas: vi.fn().mockResolvedValue(500000n),
  mockPrismaAssetAllocation: {
    findMany: vi.fn(),
  },
  mockPrismaRebalanceHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

// =============================================================================
// Mocks
// =============================================================================

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mockReadContract,
      estimateGas: mockEstimateGas,
    })),
  };
});

vi.mock('../services/database', () => ({
  prisma: {
    assetAllocation: mockPrismaAssetAllocation,
    rebalanceHistory: mockPrismaRebalanceHistory,
  },
}));

vi.mock('../jobs/notificationQueue', () => ({
  addBroadcastNotificationJob: vi.fn().mockResolvedValue(undefined),
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import {
  fetchAssetData,
  calculateOptimalAllocations,
  checkRebalanceNeeded,
  generateRebalanceTransactions,
  createRebalanceProposal,
  encodeRebalanceTransaction,
  submitToGnosisSafe,
  executeRebalanceCheck,
  getRebalanceStatus,
  type AssetData,
  type RebalanceProposal,
} from '../services/rebalanceEngine';

// =============================================================================
// Test Data
// =============================================================================

const mockAssetAllocations = [
  {
    id: '1',
    tokenAddress: '0x1111111111111111111111111111111111111111',
    tokenSymbol: 'RWA1',
    allocation: 0.4,
    valueUsd: BigInt('1000000000000000000000'),
    apy: 5.5,
    isActive: true,
    updatedAt: new Date(),
  },
  {
    id: '2',
    tokenAddress: '0x2222222222222222222222222222222222222222',
    tokenSymbol: 'RWA2',
    allocation: 0.3,
    valueUsd: BigInt('750000000000000000000'),
    apy: 7.2,
    isActive: true,
    updatedAt: new Date(),
  },
  {
    id: '3',
    tokenAddress: '0x3333333333333333333333333333333333333333',
    tokenSymbol: 'RWA3',
    allocation: 0.3,
    valueUsd: BigInt('750000000000000000000'),
    apy: 4.8,
    isActive: true,
    updatedAt: new Date(),
  },
];

const mockAssetData: AssetData[] = [
  {
    token: '0x1111111111111111111111111111111111111111' as Address,
    currentAllocation: 4000n,
    currentValue: BigInt('1000000000000000000000'),
    apy: 550n,
  },
  {
    token: '0x2222222222222222222222222222222222222222' as Address,
    currentAllocation: 3000n,
    currentValue: BigInt('750000000000000000000'),
    apy: 720n,
  },
  {
    token: '0x3333333333333333333333333333333333333333' as Address,
    currentAllocation: 3000n,
    currentValue: BigInt('750000000000000000000'),
    apy: 480n,
  },
];

const mockRebalanceProposal: RebalanceProposal = {
  sellAssets: ['0x3333333333333333333333333333333333333333' as Address],
  sellAmounts: [100000000000000000000n],
  buyAssets: ['0x2222222222222222222222222222222222222222' as Address],
  buyAmounts: [100000000000000000000n],
  newAllocations: [3500n, 3500n, 3000n],
  totalValue: 2500000000000000000000n,
  maxDeviation: 6.5,
  estimatedGas: 500000n,
};

// =============================================================================
// Tests
// =============================================================================

describe('RebalanceEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PNGY_VAULT_ADDRESS = '0x4444444444444444444444444444444444444444';
    process.env.REBALANCE_STRATEGY_ADDRESS = '0x5555555555555555555555555555555555555555';
    process.env.GNOSIS_SAFE_ADDRESS = '0x6666666666666666666666666666666666666666';
  });

  afterEach(() => {
    delete process.env.PNGY_VAULT_ADDRESS;
    delete process.env.REBALANCE_STRATEGY_ADDRESS;
    delete process.env.GNOSIS_SAFE_ADDRESS;
  });

  describe('fetchAssetData', () => {
    it('should fetch and transform asset allocations from database', async () => {
      mockPrismaAssetAllocation.findMany.mockResolvedValue(mockAssetAllocations);

      const result = await fetchAssetData();

      expect(mockPrismaAssetAllocation.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toHaveLength(3);
      expect(result[0].token).toBe('0x1111111111111111111111111111111111111111');
      expect(result[0].currentAllocation).toBe(4000n);
      expect(result[0].apy).toBe(550n);
    });

    it('should return empty array when no active allocations', async () => {
      mockPrismaAssetAllocation.findMany.mockResolvedValue([]);

      const result = await fetchAssetData();

      expect(result).toEqual([]);
    });
  });

  describe('calculateOptimalAllocations', () => {
    it('should call RebalanceStrategy contract for optimal allocations', async () => {
      const mockResult = [
        { token: mockAssetData[0].token, targetAllocation: 3500n, allocationDelta: -500n },
        { token: mockAssetData[1].token, targetAllocation: 3500n, allocationDelta: 500n },
        { token: mockAssetData[2].token, targetAllocation: 3000n, allocationDelta: 0n },
      ];
      mockReadContract.mockResolvedValue(mockResult);

      const result = await calculateOptimalAllocations(mockAssetData);

      expect(mockReadContract).toHaveBeenCalledWith({
        address: process.env.REBALANCE_STRATEGY_ADDRESS,
        abi: expect.any(Array),
        functionName: 'calculateOptimalAllocation',
        args: [mockAssetData],
      });
      expect(result).toHaveLength(3);
      expect(result[0].targetAllocation).toBe(3500n);
      expect(result[1].allocationDelta).toBe(500n);
    });

    it('should throw error when contract address not configured', async () => {
      delete process.env.REBALANCE_STRATEGY_ADDRESS;

      await expect(calculateOptimalAllocations(mockAssetData)).rejects.toThrow(
        'RebalanceStrategy contract address not configured'
      );
    });
  });

  describe('checkRebalanceNeeded', () => {
    it('should return true when deviation exceeds threshold', async () => {
      mockReadContract.mockResolvedValue([true, 650n]);

      const targetAllocations = [3500n, 3500n, 3000n];
      const result = await checkRebalanceNeeded(mockAssetData, targetAllocations);

      expect(result.needed).toBe(true);
      expect(result.maxDeviation).toBe(6.5);
    });

    it('should return false when deviation is below threshold', async () => {
      mockReadContract.mockResolvedValue([false, 300n]);

      const targetAllocations = [4100n, 2900n, 3000n];
      const result = await checkRebalanceNeeded(mockAssetData, targetAllocations);

      expect(result.needed).toBe(false);
      expect(result.maxDeviation).toBe(3);
    });
  });

  describe('generateRebalanceTransactions', () => {
    it('should generate buy and sell transactions', async () => {
      const mockTxs = [
        { token: mockAssetData[0].token, isBuy: false, amount: 100n, usdValue: 100n },
        { token: mockAssetData[1].token, isBuy: true, amount: 100n, usdValue: 100n },
      ];
      mockReadContract.mockResolvedValue(mockTxs);

      const targetAllocations = [3500n, 3500n, 3000n];
      const totalValue = 2500000000000000000000n;
      const result = await generateRebalanceTransactions(mockAssetData, targetAllocations, totalValue);

      expect(result).toHaveLength(2);
      expect(result[0].isBuy).toBe(false);
      expect(result[1].isBuy).toBe(true);
    });
  });

  describe('encodeRebalanceTransaction', () => {
    it('should encode proposal into hex transaction data', () => {
      const result = encodeRebalanceTransaction(mockRebalanceProposal);

      expect(result).toMatch(/^0x/);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(10);
    });
  });

  describe('submitToGnosisSafe', () => {
    it('should encode transaction and store in database', async () => {
      mockPrismaRebalanceHistory.create.mockResolvedValue({});

      const result = await submitToGnosisSafe(mockRebalanceProposal);

      expect(result.to).toBe(process.env.PNGY_VAULT_ADDRESS);
      expect(result.value).toBe(0n);
      expect(result.safeTxGas).toBe(mockRebalanceProposal.estimatedGas);
      expect(result.transactionData).toMatch(/^0x/);

      expect(mockPrismaRebalanceHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'REBALANCE',
          fromAsset: mockRebalanceProposal.sellAssets[0],
          toAsset: mockRebalanceProposal.buyAssets[0],
        }),
      });
    });

    it('should throw error when vault address not configured', async () => {
      delete process.env.PNGY_VAULT_ADDRESS;

      await expect(submitToGnosisSafe(mockRebalanceProposal)).rejects.toThrow(
        'PNGYVault contract address not configured'
      );
    });
  });

  describe('createRebalanceProposal', () => {
    it('should return null when no active assets', async () => {
      mockPrismaAssetAllocation.findMany.mockResolvedValue([]);

      const result = await createRebalanceProposal();

      expect(result).toBeNull();
    });

    it('should return null when rebalance not needed', async () => {
      mockPrismaAssetAllocation.findMany.mockResolvedValue(mockAssetAllocations);

      mockReadContract
        .mockResolvedValueOnce([
          { token: mockAssetData[0].token, targetAllocation: 4000n, allocationDelta: 0n },
          { token: mockAssetData[1].token, targetAllocation: 3000n, allocationDelta: 0n },
          { token: mockAssetData[2].token, targetAllocation: 3000n, allocationDelta: 0n },
        ])
        .mockResolvedValueOnce([false, 200n]);

      const result = await createRebalanceProposal();

      expect(result).toBeNull();
    });

    it('should create proposal when rebalance is needed', async () => {
      mockPrismaAssetAllocation.findMany.mockResolvedValue(mockAssetAllocations);

      mockReadContract
        .mockResolvedValueOnce([
          { token: mockAssetData[0].token, targetAllocation: 3500n, allocationDelta: -500n },
          { token: mockAssetData[1].token, targetAllocation: 3500n, allocationDelta: 500n },
          { token: mockAssetData[2].token, targetAllocation: 3000n, allocationDelta: 0n },
        ])
        .mockResolvedValueOnce([true, 700n])
        .mockResolvedValueOnce([
          { token: mockAssetData[0].token, isBuy: false, amount: 100n, usdValue: 100n },
          { token: mockAssetData[1].token, isBuy: true, amount: 100n, usdValue: 100n },
        ]);

      const result = await createRebalanceProposal();

      expect(result).not.toBeNull();
      expect(result?.maxDeviation).toBe(7);
      expect(result?.sellAssets).toHaveLength(1);
      expect(result?.buyAssets).toHaveLength(1);
    });
  });

  describe('executeRebalanceCheck', () => {
    it('should skip when contracts not configured', async () => {
      delete process.env.PNGY_VAULT_ADDRESS;
      delete process.env.REBALANCE_STRATEGY_ADDRESS;

      const result = await executeRebalanceCheck();

      expect(result.checked).toBe(false);
      expect(result.error).toBe('Contracts not configured');
    });

    it('should return checked=true when no assets found', async () => {
      mockPrismaAssetAllocation.findMany.mockResolvedValue([]);

      const result = await executeRebalanceCheck();

      expect(result.checked).toBe(true);
      expect(result.proposalCreated).toBe(false);
      expect(result.proposal).toBeNull();
    });

    it('should create proposal and submit to Gnosis Safe when rebalance needed', async () => {
      mockPrismaAssetAllocation.findMany.mockResolvedValue(mockAssetAllocations);
      mockPrismaRebalanceHistory.create.mockResolvedValue({});

      mockReadContract
        .mockResolvedValueOnce([
          { token: mockAssetData[0].token, targetAllocation: 3500n, allocationDelta: -500n },
          { token: mockAssetData[1].token, targetAllocation: 3500n, allocationDelta: 500n },
          { token: mockAssetData[2].token, targetAllocation: 3000n, allocationDelta: 0n },
        ])
        .mockResolvedValueOnce([true, 700n])
        .mockResolvedValueOnce([
          { token: mockAssetData[0].token, isBuy: false, amount: 100n, usdValue: 100n },
          { token: mockAssetData[1].token, isBuy: true, amount: 100n, usdValue: 100n },
        ]);

      const result = await executeRebalanceCheck();

      expect(result.checked).toBe(true);
      expect(result.proposalCreated).toBe(true);
      expect(result.proposal).not.toBeNull();
      expect(mockPrismaRebalanceHistory.create).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPrismaAssetAllocation.findMany.mockRejectedValue(new Error('Database error'));

      const result = await executeRebalanceCheck();

      expect(result.checked).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getRebalanceStatus', () => {
    it('should return rebalance history and status', async () => {
      const mockHistory = [
        {
          id: '1',
          txHash: 'pending-123',
          type: 'REBALANCE',
          fromAsset: '0x111',
          toAsset: '0x222',
          fromAmount: '1000',
          toAmount: '1000',
          timestamp: new Date(),
        },
        {
          id: '2',
          txHash: '0xabc123',
          type: 'REBALANCE',
          fromAsset: '0x333',
          toAsset: '0x444',
          fromAmount: '2000',
          toAmount: '2000',
          timestamp: new Date(Date.now() - 86400000),
        },
      ];
      mockPrismaRebalanceHistory.findMany.mockResolvedValue(mockHistory);

      const result = await getRebalanceStatus();

      expect(result.pendingProposals).toBe(1);
      expect(result.recentRebalances).toHaveLength(2);
      expect(result.lastCheck).toEqual(mockHistory[0].timestamp);
    });

    it('should return null lastCheck when no history', async () => {
      mockPrismaRebalanceHistory.findMany.mockResolvedValue([]);

      const result = await getRebalanceStatus();

      expect(result.lastCheck).toBeNull();
      expect(result.pendingProposals).toBe(0);
      expect(result.recentRebalances).toEqual([]);
    });
  });
});

describe('RebalanceEngine - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PNGY_VAULT_ADDRESS = '0x4444444444444444444444444444444444444444';
    process.env.REBALANCE_STRATEGY_ADDRESS = '0x5555555555555555555555555555555555555555';
  });

  afterEach(() => {
    delete process.env.PNGY_VAULT_ADDRESS;
    delete process.env.REBALANCE_STRATEGY_ADDRESS;
  });

  it('should handle gas estimation failure with default value', async () => {
    mockPrismaAssetAllocation.findMany.mockResolvedValue(mockAssetAllocations);
    mockEstimateGas.mockRejectedValue(new Error('Gas estimation failed'));

    mockReadContract
      .mockResolvedValueOnce([
        { token: mockAssetData[0].token, targetAllocation: 3500n, allocationDelta: -500n },
        { token: mockAssetData[1].token, targetAllocation: 3500n, allocationDelta: 500n },
        { token: mockAssetData[2].token, targetAllocation: 3000n, allocationDelta: 0n },
      ])
      .mockResolvedValueOnce([true, 700n])
      .mockResolvedValueOnce([
        { token: mockAssetData[0].token, isBuy: false, amount: 100n, usdValue: 100n },
        { token: mockAssetData[1].token, isBuy: true, amount: 100n, usdValue: 100n },
      ]);

    const result = await createRebalanceProposal();

    expect(result).not.toBeNull();
    expect(result?.estimatedGas).toBe(500000n);
  });

  it('should handle proposal with no sell assets', async () => {
    const proposalWithNoSells: RebalanceProposal = {
      ...mockRebalanceProposal,
      sellAssets: [],
      sellAmounts: [],
    };

    mockPrismaRebalanceHistory.create.mockResolvedValue({});

    const result = await submitToGnosisSafe(proposalWithNoSells);

    expect(result.transactionData).toMatch(/^0x/);
    expect(mockPrismaRebalanceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromAsset: '0x0000000000000000000000000000000000000000',
      }),
    });
  });

  it('should handle proposal with no buy assets', async () => {
    const proposalWithNoBuys: RebalanceProposal = {
      ...mockRebalanceProposal,
      buyAssets: [],
      buyAmounts: [],
    };

    mockPrismaRebalanceHistory.create.mockResolvedValue({});

    const result = await submitToGnosisSafe(proposalWithNoBuys);

    expect(result.transactionData).toMatch(/^0x/);
    expect(mockPrismaRebalanceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toAsset: '0x0000000000000000000000000000000000000000',
      }),
    });
  });
});
