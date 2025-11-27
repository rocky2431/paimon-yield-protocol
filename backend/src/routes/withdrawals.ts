/**
 * Large Withdrawal API Routes
 * Task #59 - 实现大额赎回优先通道
 *
 * Provides endpoints for:
 * - Checking large withdrawal status
 * - Viewing withdrawal history
 * - Admin operations (approve, reject, update status)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getUserLargeWithdrawals,
  getLargeWithdrawalById,
  getPendingLargeWithdrawals,
  updateLargeWithdrawalStatus,
  getLargeWithdrawalStats,
  processLargeWithdrawal,
  isLargeWithdrawal,
  LARGE_WITHDRAWAL_THRESHOLD,
} from '../services/withdrawService.js';
import type { LargeWithdrawalStatus } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

interface GetUserWithdrawalsParams {
  address: string;
}

interface GetWithdrawalByIdParams {
  id: string;
}

interface CreateLargeWithdrawalBody {
  userAddress: string;
  shares: string;
  estimatedAmount: string;
  requestTxHash?: string;
}

interface UpdateWithdrawalStatusBody {
  status: LargeWithdrawalStatus;
  adminNotes?: string;
}

// =============================================================================
// Route Registration
// =============================================================================

export default async function withdrawalRoutes(fastify: FastifyInstance) {
  // ---------------------------------------------------------------------------
  // User Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/withdrawals/user/:address
   * Get large withdrawal history for a specific user
   */
  fastify.get<{ Params: GetUserWithdrawalsParams }>(
    '/user/:address',
    async (request: FastifyRequest<{ Params: GetUserWithdrawalsParams }>, reply: FastifyReply) => {
      try {
        const { address } = request.params;

        // Validate address format
        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
          return reply.status(400).send({
            error: 'Invalid address format',
          });
        }

        const withdrawals = await getUserLargeWithdrawals(address.toLowerCase());

        return reply.send({
          success: true,
          data: {
            address,
            withdrawals,
            threshold: LARGE_WITHDRAWAL_THRESHOLD.toString(),
          },
        });
      } catch (error) {
        console.error('[Withdrawals] Error fetching user withdrawals:', error);
        return reply.status(500).send({
          error: 'Failed to fetch withdrawal history',
        });
      }
    }
  );

  /**
   * GET /api/withdrawals/:id
   * Get a specific large withdrawal by ID
   */
  fastify.get<{ Params: GetWithdrawalByIdParams }>(
    '/:id',
    async (request: FastifyRequest<{ Params: GetWithdrawalByIdParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const withdrawal = await getLargeWithdrawalById(id);

        if (!withdrawal) {
          return reply.status(404).send({
            error: 'Withdrawal not found',
          });
        }

        return reply.send({
          success: true,
          data: withdrawal,
        });
      } catch (error) {
        console.error('[Withdrawals] Error fetching withdrawal:', error);
        return reply.status(500).send({
          error: 'Failed to fetch withdrawal',
        });
      }
    }
  );

  /**
   * POST /api/withdrawals/check
   * Check if an amount qualifies as a large withdrawal
   */
  fastify.post<{ Body: { amount: string } }>(
    '/check',
    async (request: FastifyRequest<{ Body: { amount: string } }>, reply: FastifyReply) => {
      try {
        const { amount } = request.body;

        if (!amount) {
          return reply.status(400).send({
            error: 'Amount is required',
          });
        }

        const amountBigInt = BigInt(amount);
        const isLarge = isLargeWithdrawal(amountBigInt);
        const thresholdUsd = Number(LARGE_WITHDRAWAL_THRESHOLD / BigInt(1e18));
        const amountUsd = Number(amountBigInt / BigInt(1e18));

        return reply.send({
          success: true,
          data: {
            isLargeWithdrawal: isLarge,
            amount: amount,
            amountUsd: amountUsd,
            threshold: LARGE_WITHDRAWAL_THRESHOLD.toString(),
            thresholdUsd: thresholdUsd,
            message: isLarge
              ? `This withdrawal ($${amountUsd.toLocaleString()}) exceeds the $${thresholdUsd.toLocaleString()} threshold and will be processed through the priority channel.`
              : `This withdrawal is below the $${thresholdUsd.toLocaleString()} threshold and will be processed normally.`,
          },
        });
      } catch (error) {
        console.error('[Withdrawals] Error checking withdrawal:', error);
        return reply.status(500).send({
          error: 'Failed to check withdrawal amount',
        });
      }
    }
  );

  /**
   * POST /api/withdrawals/request
   * Create a new large withdrawal request
   */
  fastify.post<{ Body: CreateLargeWithdrawalBody }>(
    '/request',
    async (request: FastifyRequest<{ Body: CreateLargeWithdrawalBody }>, reply: FastifyReply) => {
      try {
        const { userAddress, shares, estimatedAmount, requestTxHash } = request.body;

        // Validate required fields
        if (!userAddress || !shares || !estimatedAmount) {
          return reply.status(400).send({
            error: 'Missing required fields: userAddress, shares, estimatedAmount',
          });
        }

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
          return reply.status(400).send({
            error: 'Invalid address format',
          });
        }

        // Check if this qualifies as a large withdrawal
        const amountBigInt = BigInt(estimatedAmount);
        if (!isLargeWithdrawal(amountBigInt)) {
          return reply.status(400).send({
            error: 'Amount does not meet large withdrawal threshold',
            threshold: LARGE_WITHDRAWAL_THRESHOLD.toString(),
          });
        }

        // Process the large withdrawal request
        const withdrawal = await processLargeWithdrawal({
          userAddress: userAddress.toLowerCase(),
          shares: BigInt(shares),
          estimatedAmount: amountBigInt,
          requestTxHash,
        });

        return reply.status(201).send({
          success: true,
          data: withdrawal,
          message: 'Large withdrawal request created. Our team will process it within 12 hours.',
        });
      } catch (error) {
        console.error('[Withdrawals] Error creating withdrawal request:', error);
        return reply.status(500).send({
          error: 'Failed to create withdrawal request',
        });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/withdrawals/admin/pending
   * Get all pending large withdrawals (admin only)
   */
  fastify.get(
    '/admin/pending',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // TODO: Add admin authentication check

        const withdrawals = await getPendingLargeWithdrawals();

        return reply.send({
          success: true,
          data: {
            withdrawals,
            count: withdrawals.length,
          },
        });
      } catch (error) {
        console.error('[Withdrawals] Error fetching pending withdrawals:', error);
        return reply.status(500).send({
          error: 'Failed to fetch pending withdrawals',
        });
      }
    }
  );

  /**
   * GET /api/withdrawals/admin/stats
   * Get large withdrawal statistics (admin only)
   */
  fastify.get(
    '/admin/stats',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // TODO: Add admin authentication check

        const stats = await getLargeWithdrawalStats();

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        console.error('[Withdrawals] Error fetching stats:', error);
        return reply.status(500).send({
          error: 'Failed to fetch statistics',
        });
      }
    }
  );

  /**
   * PATCH /api/withdrawals/admin/:id/status
   * Update large withdrawal status (admin only)
   */
  fastify.patch<{ Params: GetWithdrawalByIdParams; Body: UpdateWithdrawalStatusBody }>(
    '/admin/:id/status',
    async (
      request: FastifyRequest<{ Params: GetWithdrawalByIdParams; Body: UpdateWithdrawalStatusBody }>,
      reply: FastifyReply
    ) => {
      try {
        // TODO: Add admin authentication check

        const { id } = request.params;
        const { status, adminNotes } = request.body;

        // Validate status
        const validStatuses: LargeWithdrawalStatus[] = [
          'PENDING',
          'APPROVED',
          'PROCESSING',
          'READY',
          'COMPLETED',
          'REJECTED',
          'CANCELLED',
        ];

        if (!status || !validStatuses.includes(status)) {
          return reply.status(400).send({
            error: 'Invalid status',
            validStatuses,
          });
        }

        const withdrawal = await updateLargeWithdrawalStatus(id, status, adminNotes);

        return reply.send({
          success: true,
          data: withdrawal,
          message: `Withdrawal status updated to ${status}`,
        });
      } catch (error) {
        console.error('[Withdrawals] Error updating status:', error);
        return reply.status(500).send({
          error: 'Failed to update withdrawal status',
        });
      }
    }
  );

  /**
   * GET /api/withdrawals/threshold
   * Get the current large withdrawal threshold
   */
  fastify.get(
    '/threshold',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const thresholdUsd = Number(LARGE_WITHDRAWAL_THRESHOLD / BigInt(1e18));

      return reply.send({
        success: true,
        data: {
          threshold: LARGE_WITHDRAWAL_THRESHOLD.toString(),
          thresholdUsd: thresholdUsd,
          thresholdFormatted: `$${thresholdUsd.toLocaleString()}`,
          targetProcessingTime: '12 hours (T+0.5)',
          description: 'Withdrawals at or above this amount are processed through the priority channel with dedicated admin review.',
        },
      });
    }
  );
}
