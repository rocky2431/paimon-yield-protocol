/**
 * Transaction History Routes
 * Task #51 - 实现后端 API - 获取用户交易历史
 *
 * GET /transactions/:address - Get transaction history for a wallet address
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient, TransactionType } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

// Types
interface TransactionResponse {
  id: string;
  txHash: string;
  type: 'deposit' | 'withdraw';
  amount: string;
  shares: string;
  sharePrice: string;
  blockNumber: string;
  timestamp: string;
}

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface TransactionListResponse {
  data: TransactionResponse[];
  pagination: PaginationMeta;
}

interface TransactionQueryParams {
  limit?: number;
  offset?: number;
  days?: number;
  startDate?: string;
  endDate?: string;
  type?: 'deposit' | 'withdraw';
}

interface TransactionPathParams {
  address: string;
}

// Constants
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Validation helpers
function isValidEthAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// Transform database transaction to response format
function transformTransaction(tx: {
  id: string;
  txHash: string;
  type: TransactionType;
  amount: bigint | { toString(): string };
  shares: bigint | { toString(): string };
  sharePrice: bigint | { toString(): string };
  blockNumber: bigint;
  timestamp: Date;
}): TransactionResponse {
  return {
    id: tx.id,
    txHash: tx.txHash,
    type: tx.type.toLowerCase() as 'deposit' | 'withdraw',
    amount: tx.amount.toString(),
    shares: tx.shares.toString(),
    sharePrice: tx.sharePrice.toString(),
    blockNumber: tx.blockNumber.toString(),
    timestamp: tx.timestamp.toISOString(),
  };
}

export const transactionRoutes: FastifyPluginAsync = async (
  server: FastifyInstance
): Promise<void> => {
  // GET /transactions/:address - Get user transaction history
  server.get<{
    Params: TransactionPathParams;
    Querystring: TransactionQueryParams;
    Reply: TransactionListResponse | { error: string };
  }>(
    '/transactions/:address',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Get transaction history for a wallet address',
        description: 'Returns paginated transaction history with filtering options',
        params: {
          type: 'object',
          required: ['address'],
          properties: {
            address: {
              type: 'string',
              description: 'Ethereum wallet address (0x...)',
              pattern: '^0x[a-fA-F0-9]{40}$',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: MAX_LIMIT,
              default: DEFAULT_LIMIT,
              description: 'Number of records to return',
            },
            offset: {
              type: 'integer',
              minimum: 0,
              default: 0,
              description: 'Number of records to skip',
            },
            days: {
              type: 'integer',
              minimum: 1,
              maximum: 365,
              description: 'Filter transactions from last N days',
            },
            startDate: {
              type: 'string',
              format: 'date',
              description: 'Start date filter (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              format: 'date',
              description: 'End date filter (YYYY-MM-DD)',
            },
            type: {
              type: 'string',
              enum: ['deposit', 'withdraw'],
              description: 'Filter by transaction type',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    txHash: { type: 'string' },
                    type: { type: 'string', enum: ['deposit', 'withdraw'] },
                    amount: { type: 'string' },
                    shares: { type: 'string' },
                    sharePrice: { type: 'string' },
                    blockNumber: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  limit: { type: 'integer' },
                  offset: { type: 'integer' },
                  hasMore: { type: 'boolean' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          500: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { address } = request.params;
      const {
        limit = DEFAULT_LIMIT,
        offset = 0,
        days,
        startDate,
        endDate,
        type,
      } = request.query;

      // Validate address format
      if (!isValidEthAddress(address)) {
        return reply.status(400).send({
          error: 'Invalid Ethereum address format',
        });
      }

      // Validate limit
      if (limit < 1 || limit > MAX_LIMIT) {
        return reply.status(400).send({
          error: `Limit must be between 1 and ${MAX_LIMIT}`,
        });
      }

      // Validate offset
      if (offset < 0) {
        return reply.status(400).send({
          error: 'Offset must be non-negative',
        });
      }

      // Validate dates
      if (startDate && !isValidDate(startDate)) {
        return reply.status(400).send({
          error: 'Invalid startDate format. Use YYYY-MM-DD',
        });
      }

      if (endDate && !isValidDate(endDate)) {
        return reply.status(400).send({
          error: 'Invalid endDate format. Use YYYY-MM-DD',
        });
      }

      // Validate type
      if (type && !['deposit', 'withdraw'].includes(type)) {
        return reply.status(400).send({
          error: 'Invalid type. Must be "deposit" or "withdraw"',
        });
      }

      try {
        // Build where clause
        const where: {
          userAddress: string;
          type?: TransactionType;
          timestamp?: { gte?: Date; lte?: Date };
        } = {
          userAddress: address.toLowerCase(),
        };

        // Add type filter
        if (type) {
          where.type = type.toUpperCase() as TransactionType;
        }

        // Add date filters
        if (days || startDate || endDate) {
          where.timestamp = {};

          if (days) {
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - days);
            where.timestamp.gte = daysAgo;
          }

          if (startDate) {
            where.timestamp.gte = new Date(startDate);
          }

          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            where.timestamp.lte = end;
          }
        }

        // Query transactions with pagination
        const [transactions, total] = await Promise.all([
          prisma.transaction.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            skip: offset,
            take: limit,
          }),
          prisma.transaction.count({ where }),
        ]);

        // Transform and return response
        const data = transactions.map(transformTransaction);

        return {
          data,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + data.length < total,
          },
        };
      } catch (error) {
        server.log.error(error, 'Failed to fetch transactions');
        return reply.status(500).send({
          error: 'Failed to fetch transactions',
        });
      }
    }
  );
};

export default transactionRoutes;
