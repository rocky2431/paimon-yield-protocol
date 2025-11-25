/**
 * Notification Routes
 * Task #56 - 实现通知系统 - 邮件通知
 *
 * API endpoints for managing notification preferences
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
  verifyEmail,
  getNotificationHistory,
} from '../services/emailService.js';

// =============================================================================
// Types
// =============================================================================

interface PreferencesPathParams {
  address: string;
}

interface UpdatePreferencesBody {
  email?: string;
  withdrawalAlert?: boolean;
  rebalanceAlert?: boolean;
  emergencyAlert?: boolean;
}

interface VerifyEmailBody {
  address: string;
  // In production, this would include a verification token
}

interface HistoryQueryParams {
  limit?: number;
  offset?: number;
}

// =============================================================================
// Constants
// =============================================================================

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// =============================================================================
// Validation
// =============================================================================

function isValidEthAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

// =============================================================================
// Route Plugin
// =============================================================================

export const notificationRoutes: FastifyPluginAsync = async (
  server: FastifyInstance
): Promise<void> => {
  // GET /notifications/preferences/:address - Get notification preferences
  server.get<{
    Params: PreferencesPathParams;
  }>(
    '/notifications/preferences/:address',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Get notification preferences for a wallet address',
        params: {
          type: 'object',
          required: ['address'],
          properties: {
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
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
                nullable: true,
                properties: {
                  userAddress: { type: 'string' },
                  email: { type: 'string', nullable: true },
                  emailVerified: { type: 'boolean' },
                  withdrawalAlert: { type: 'boolean' },
                  rebalanceAlert: { type: 'boolean' },
                  emergencyAlert: { type: 'boolean' },
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
        },
      },
    },
    async (request, reply) => {
      const { address } = request.params;

      if (!isValidEthAddress(address)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid Ethereum address',
        });
      }

      try {
        const preferences = await getNotificationPreferences(address);

        return {
          success: true,
          data: preferences
            ? {
                userAddress: preferences.userAddress,
                email: preferences.email,
                emailVerified: preferences.emailVerified,
                withdrawalAlert: preferences.withdrawalAlert,
                rebalanceAlert: preferences.rebalanceAlert,
                emergencyAlert: preferences.emergencyAlert,
              }
            : null,
        };
      } catch (error) {
        server.log.error(error, 'Failed to get notification preferences');
        return reply.status(500).send({
          success: false,
          error: 'Failed to get notification preferences',
        });
      }
    }
  );

  // POST /notifications/preferences/:address - Update notification preferences
  server.post<{
    Params: PreferencesPathParams;
    Body: UpdatePreferencesBody;
  }>(
    '/notifications/preferences/:address',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Update notification preferences',
        params: {
          type: 'object',
          required: ['address'],
          properties: {
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
            },
          },
        },
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            withdrawalAlert: { type: 'boolean' },
            rebalanceAlert: { type: 'boolean' },
            emergencyAlert: { type: 'boolean' },
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
                  userAddress: { type: 'string' },
                  email: { type: 'string', nullable: true },
                  emailVerified: { type: 'boolean' },
                  withdrawalAlert: { type: 'boolean' },
                  rebalanceAlert: { type: 'boolean' },
                  emergencyAlert: { type: 'boolean' },
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
        },
      },
    },
    async (request, reply) => {
      const { address } = request.params;
      const { email, withdrawalAlert, rebalanceAlert, emergencyAlert } = request.body;

      if (!isValidEthAddress(address)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid Ethereum address',
        });
      }

      if (email && !isValidEmail(email)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid email format',
        });
      }

      try {
        const preferences = await upsertNotificationPreferences(address, {
          email,
          withdrawalAlert,
          rebalanceAlert,
          emergencyAlert,
        });

        return {
          success: true,
          data: {
            userAddress: preferences.userAddress,
            email: preferences.email,
            emailVerified: preferences.emailVerified,
            withdrawalAlert: preferences.withdrawalAlert,
            rebalanceAlert: preferences.rebalanceAlert,
            emergencyAlert: preferences.emergencyAlert,
          },
        };
      } catch (error) {
        server.log.error(error, 'Failed to update notification preferences');
        return reply.status(500).send({
          success: false,
          error: 'Failed to update notification preferences',
        });
      }
    }
  );

  // POST /notifications/verify-email - Verify email address
  server.post<{
    Body: VerifyEmailBody;
  }>(
    '/notifications/verify-email',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Verify email address (simplified for demo)',
        body: {
          type: 'object',
          required: ['address'],
          properties: {
            address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              verified: { type: 'boolean' },
            },
          },
          400: {
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
      const { address } = request.body;

      if (!isValidEthAddress(address)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid Ethereum address',
        });
      }

      try {
        // In production, this would verify a token sent to the email
        const verified = await verifyEmail(address);

        return {
          success: true,
          verified,
        };
      } catch (error) {
        server.log.error(error, 'Failed to verify email');
        return reply.status(500).send({
          success: false,
          error: 'Failed to verify email',
        });
      }
    }
  );

  // GET /notifications/history/:address - Get notification history
  server.get<{
    Params: PreferencesPathParams;
    Querystring: HistoryQueryParams;
  }>(
    '/notifications/history/:address',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Get notification history for a wallet address',
        params: {
          type: 'object',
          required: ['address'],
          properties: {
            address: {
              type: 'string',
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
            },
            offset: {
              type: 'integer',
              minimum: 0,
              default: 0,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    channel: { type: 'string' },
                    recipient: { type: 'string' },
                    subject: { type: 'string', nullable: true },
                    status: { type: 'string' },
                    sentAt: { type: 'string', nullable: true },
                    createdAt: { type: 'string' },
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
        },
      },
    },
    async (request, reply) => {
      const { address } = request.params;
      const { limit = DEFAULT_LIMIT, offset = 0 } = request.query;

      if (!isValidEthAddress(address)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid Ethereum address',
        });
      }

      try {
        const history = await getNotificationHistory(address, limit, offset);

        return {
          success: true,
          data: history.map(log => ({
            id: log.id,
            type: log.type,
            channel: log.channel,
            recipient: log.recipient,
            subject: log.subject,
            status: log.status,
            sentAt: log.sentAt?.toISOString() ?? null,
            createdAt: log.createdAt.toISOString(),
          })),
        };
      } catch (error) {
        server.log.error(error, 'Failed to get notification history');
        return reply.status(500).send({
          success: false,
          error: 'Failed to get notification history',
        });
      }
    }
  );
};

export default notificationRoutes;
