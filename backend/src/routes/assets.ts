/**
 * Asset Allocation Routes
 * Task #53 - 实现后端 API - 获取 RWA 资产配置数据
 *
 * GET /assets/allocation - Get RWA asset allocation data
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getActiveAllocations, getRecentRebalances } from '../services/vault.service.js';

// =============================================================================
// Types
// =============================================================================

interface AssetAllocationRecord {
  tokenAddress: string;
  name: string;
  symbol: string;
  targetAllocation: number;
  actualAllocation: number;
  balance: string;
  valueUsd: string;
  apy: number;
  isActive: boolean;
}

interface AllocationSummary {
  totalValueUsd: string;
  averageApy: number;
  lastRebalance: string | null;
  assetCount: number;
}

interface AllocationResponse {
  success: boolean;
  data: {
    allocations: AssetAllocationRecord[];
    summary: AllocationSummary;
  };
}

// =============================================================================
// Constants
// =============================================================================

const PRECISION_DECIMALS = 18;
const ALLOCATION_DECIMALS = 4; // 0.0000 - 1.0000

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate actual allocation percentage from value
 */
function calculateActualAllocation(valueUsd: bigint, totalValueUsd: bigint): number {
  if (totalValueUsd === 0n) {
    return 0;
  }
  // Calculate percentage with 4 decimal precision
  const percentage = (Number(valueUsd) / Number(totalValueUsd)) * 100;
  return Math.round(percentage * 100) / 100; // Round to 2 decimals
}

/**
 * Convert allocation from decimal (0.0000-1.0000) to percentage
 */
function allocationToPercentage(allocation: number): number {
  return Math.round(allocation * 100 * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate weighted average APY
 */
function calculateWeightedApy(
  allocations: Array<{ valueUsd: bigint; apy: number }>,
  totalValueUsd: bigint
): number {
  if (totalValueUsd === 0n || allocations.length === 0) {
    return 0;
  }

  let weightedSum = 0;
  for (const alloc of allocations) {
    const weight = Number(alloc.valueUsd) / Number(totalValueUsd);
    weightedSum += alloc.apy * weight;
  }

  return Math.round(weightedSum * 100) / 100; // Round to 2 decimals
}

/**
 * Transform database record to API response format
 */
function transformAllocation(
  record: {
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    allocation: { toNumber: () => number } | number;
    balance: bigint | string;
    valueUsd: bigint | string;
    apy: { toNumber: () => number } | number;
    isActive: boolean;
  },
  totalValueUsd: bigint
): AssetAllocationRecord {
  const valueUsd = typeof record.valueUsd === 'string' ? BigInt(record.valueUsd) : record.valueUsd;
  const allocation = typeof record.allocation === 'number' ? record.allocation : record.allocation.toNumber();
  const apy = typeof record.apy === 'number' ? record.apy : record.apy.toNumber();

  return {
    tokenAddress: record.tokenAddress,
    name: record.tokenName,
    symbol: record.tokenSymbol,
    targetAllocation: allocationToPercentage(allocation),
    actualAllocation: calculateActualAllocation(valueUsd, totalValueUsd),
    balance: record.balance.toString(),
    valueUsd: valueUsd.toString(),
    apy: Math.round(apy * 100) / 100,
    isActive: record.isActive,
  };
}

// =============================================================================
// Route Plugin
// =============================================================================

export const assetsRoutes: FastifyPluginAsync = async (
  server: FastifyInstance
): Promise<void> => {
  // GET /assets/allocation - Get RWA asset allocation data
  server.get<{
    Reply: AllocationResponse | { success: false; error: string };
  }>(
    '/assets/allocation',
    {
      schema: {
        tags: ['assets'],
        summary: 'Get RWA asset allocation data',
        description: 'Returns current RWA asset allocation with APY and value data',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  allocations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        tokenAddress: { type: 'string' },
                        name: { type: 'string' },
                        symbol: { type: 'string' },
                        targetAllocation: { type: 'number' },
                        actualAllocation: { type: 'number' },
                        balance: { type: 'string' },
                        valueUsd: { type: 'string' },
                        apy: { type: 'number' },
                        isActive: { type: 'boolean' },
                      },
                    },
                  },
                  summary: {
                    type: 'object',
                    properties: {
                      totalValueUsd: { type: 'string' },
                      averageApy: { type: 'number' },
                      lastRebalance: { type: 'string', nullable: true },
                      assetCount: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
          500: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Fetch active allocations from database
        const allocations = await getActiveAllocations();

        // Fetch recent rebalance for last rebalance time
        const recentRebalances = await getRecentRebalances(1);
        const lastRebalance = recentRebalances.length > 0
          ? recentRebalances[0].timestamp.toISOString()
          : null;

        // If no allocations, return empty response
        if (allocations.length === 0) {
          return {
            success: true,
            data: {
              allocations: [],
              summary: {
                totalValueUsd: '0',
                averageApy: 0,
                lastRebalance,
                assetCount: 0,
              },
            },
          };
        }

        // Calculate total value
        const totalValueUsd = allocations.reduce((sum, alloc) => {
          const value = typeof alloc.valueUsd === 'string'
            ? BigInt(alloc.valueUsd)
            : BigInt(alloc.valueUsd.toString());
          return sum + value;
        }, 0n);

        // Prepare data for weighted APY calculation
        const allocationData = allocations.map(alloc => ({
          valueUsd: typeof alloc.valueUsd === 'string'
            ? BigInt(alloc.valueUsd)
            : BigInt(alloc.valueUsd.toString()),
          apy: typeof alloc.apy === 'number' ? alloc.apy : alloc.apy.toNumber(),
        }));

        // Calculate weighted average APY
        const averageApy = calculateWeightedApy(allocationData, totalValueUsd);

        // Transform allocations
        const transformedAllocations = allocations.map(alloc =>
          transformAllocation(alloc as any, totalValueUsd)
        );

        return {
          success: true,
          data: {
            allocations: transformedAllocations,
            summary: {
              totalValueUsd: totalValueUsd.toString(),
              averageApy,
              lastRebalance,
              assetCount: allocations.length,
            },
          },
        };
      } catch (error) {
        server.log.error(error, 'Failed to fetch asset allocations');
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch asset allocations',
        });
      }
    }
  );
};

export default assetsRoutes;
