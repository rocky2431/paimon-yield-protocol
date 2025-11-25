/**
 * Net Value History Routes
 * Task #52 - 实现后端 API - 获取历史净值数据
 *
 * GET /netvalue - Get historical net value data for yield curve display
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getNetValueHistory, getLatestNetValue } from '../services/vault.service.js';

// =============================================================================
// Types
// =============================================================================

interface NetValueRecord {
  timestamp: string;
  sharePrice: string;
  totalAssets: string;
  totalShares: string;
  apy: number;
}

interface NetValueSummary {
  currentPrice: string;
  startPrice: string;
  periodReturn: number;
  annualizedReturn: number;
  dataPoints: number;
}

interface NetValueResponse {
  success: boolean;
  data: {
    history: NetValueRecord[];
    summary: NetValueSummary;
  };
}

interface NetValueQueryParams {
  days?: number;
}

// =============================================================================
// Constants
// =============================================================================

const VALID_DAYS = [7, 30, 90];
const DEFAULT_DAYS = 30;
const PRECISION = 1e18; // 18 decimal precision for BigInt conversion
const DAYS_PER_YEAR = 365;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate APY based on share price change over time
 * @param currentPrice Current share price (as string, 18 decimals)
 * @param previousPrice Previous share price (as string, 18 decimals)
 * @param hoursDiff Hours between the two prices
 * @returns APY as percentage
 */
function calculatePointApy(
  currentPrice: string,
  previousPrice: string,
  hoursDiff: number
): number {
  if (hoursDiff <= 0 || previousPrice === '0') {
    return 0;
  }

  const current = BigInt(currentPrice);
  const previous = BigInt(previousPrice);

  if (previous === 0n) {
    return 0;
  }

  // Calculate hourly return rate
  // returnRate = (current - previous) / previous
  const returnRate = Number(current - previous) / Number(previous);

  // Annualize: (1 + hourlyReturn) ^ (8760 hours/year) - 1
  const hoursPerYear = 8760;
  const annualizedReturn = Math.pow(1 + returnRate / hoursDiff, hoursPerYear) - 1;

  // Return as percentage, capped at reasonable range
  return Math.min(Math.max(annualizedReturn * 100, -100), 10000);
}

/**
 * Calculate period return percentage
 * @param currentPrice Current share price (as string)
 * @param startPrice Starting share price (as string)
 * @returns Return percentage
 */
function calculatePeriodReturn(currentPrice: string, startPrice: string): number {
  if (startPrice === '0') {
    return 0;
  }

  const current = BigInt(currentPrice);
  const start = BigInt(startPrice);

  if (start === 0n) {
    return 0;
  }

  // (current - start) / start * 100
  const returnPct = (Number(current - start) / Number(start)) * 100;
  return Math.round(returnPct * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate annualized return from period return
 * @param periodReturn Period return percentage
 * @param days Number of days in period
 * @returns Annualized return percentage
 */
function calculateAnnualizedReturn(periodReturn: number, days: number): number {
  if (days <= 0) {
    return 0;
  }

  // Simple annualization: periodReturn * (365 / days)
  const annualized = periodReturn * (DAYS_PER_YEAR / days);
  return Math.round(annualized * 100) / 100; // Round to 2 decimals
}

/**
 * Transform database record to API response format
 */
function transformNetValueRecord(
  record: {
    timestamp: Date;
    sharePrice: bigint | string;
    totalAssets: bigint | string;
    totalShares: bigint | string;
  },
  apy: number
): NetValueRecord {
  return {
    timestamp: record.timestamp.toISOString(),
    sharePrice: record.sharePrice.toString(),
    totalAssets: record.totalAssets.toString(),
    totalShares: record.totalShares.toString(),
    apy: Math.round(apy * 100) / 100, // Round to 2 decimals
  };
}

// =============================================================================
// Route Plugin
// =============================================================================

export const netvalueRoutes: FastifyPluginAsync = async (
  server: FastifyInstance
): Promise<void> => {
  // GET /netvalue - Get historical net value data
  server.get<{
    Querystring: NetValueQueryParams;
    Reply: NetValueResponse | { success: false; error: string };
  }>(
    '/netvalue',
    {
      schema: {
        tags: ['netvalue'],
        summary: 'Get historical net value data',
        description: 'Returns historical NAV data for yield curve display with APY calculations',
        querystring: {
          type: 'object',
          properties: {
            days: {
              type: 'integer',
              enum: VALID_DAYS,
              default: DEFAULT_DAYS,
              description: 'Time range in days (7, 30, or 90)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  history: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        timestamp: { type: 'string', format: 'date-time' },
                        sharePrice: { type: 'string' },
                        totalAssets: { type: 'string' },
                        totalShares: { type: 'string' },
                        apy: { type: 'number' },
                      },
                    },
                  },
                  summary: {
                    type: 'object',
                    properties: {
                      currentPrice: { type: 'string' },
                      startPrice: { type: 'string' },
                      periodReturn: { type: 'number' },
                      annualizedReturn: { type: 'number' },
                      dataPoints: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
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
      const { days = DEFAULT_DAYS } = request.query;

      // Validate days parameter
      if (!VALID_DAYS.includes(days)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid days parameter. Must be one of: ${VALID_DAYS.join(', ')}`,
        });
      }

      try {
        // Fetch historical data from database
        const records = await getNetValueHistory(days);

        if (records.length === 0) {
          // Return empty response with default values
          return {
            success: true,
            data: {
              history: [],
              summary: {
                currentPrice: '1000000000000000000', // 1e18 default
                startPrice: '1000000000000000000',
                periodReturn: 0,
                annualizedReturn: 0,
                dataPoints: 0,
              },
            },
          };
        }

        // Calculate APY for each record
        const history: NetValueRecord[] = [];
        let previousRecord: typeof records[0] | null = null;

        for (const record of records) {
          let apy = 0;

          if (previousRecord) {
            const hoursDiff =
              (record.timestamp.getTime() - previousRecord.timestamp.getTime()) /
              (1000 * 60 * 60);
            apy = calculatePointApy(
              record.sharePrice.toString(),
              previousRecord.sharePrice.toString(),
              hoursDiff
            );
          }

          history.push(transformNetValueRecord(record, apy));
          previousRecord = record;
        }

        // Calculate summary statistics
        const startRecord = records[0];
        const endRecord = records[records.length - 1];
        const startPrice = startRecord.sharePrice.toString();
        const currentPrice = endRecord.sharePrice.toString();

        const periodReturn = calculatePeriodReturn(currentPrice, startPrice);
        const annualizedReturn = calculateAnnualizedReturn(periodReturn, days);

        return {
          success: true,
          data: {
            history,
            summary: {
              currentPrice,
              startPrice,
              periodReturn,
              annualizedReturn,
              dataPoints: records.length,
            },
          },
        };
      } catch (error) {
        server.log.error(error, 'Failed to fetch net value history');
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch net value history',
        });
      }
    }
  );
};

export default netvalueRoutes;
