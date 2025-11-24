import { FastifyInstance, FastifyPluginAsync } from 'fastify';

interface VaultStats {
  totalAssets: string;
  totalShares: string;
  sharePrice: string;
  apy: string;
  lastUpdated: string;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw';
  address: string;
  amount: string;
  shares: string;
  timestamp: string;
  txHash: string;
}

export const vaultRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Get vault statistics
  server.get<{ Reply: VaultStats }>(
    '/stats',
    {
      schema: {
        tags: ['vault'],
        summary: 'Get vault statistics',
        response: {
          200: {
            type: 'object',
            properties: {
              totalAssets: { type: 'string' },
              totalShares: { type: 'string' },
              sharePrice: { type: 'string' },
              apy: { type: 'string' },
              lastUpdated: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      // TODO: Fetch from database/blockchain
      return reply.send({
        totalAssets: '0',
        totalShares: '0',
        sharePrice: '1000000000000000000', // 1e18
        apy: '0',
        lastUpdated: new Date().toISOString(),
      });
    }
  );

  // Get recent transactions
  server.get<{ Reply: Transaction[] }>(
    '/transactions',
    {
      schema: {
        tags: ['vault'],
        summary: 'Get recent vault transactions',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 10 },
            offset: { type: 'integer', default: 0 },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: ['deposit', 'withdraw'] },
                address: { type: 'string' },
                amount: { type: 'string' },
                shares: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                txHash: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      // TODO: Fetch from database
      return reply.send([]);
    }
  );

  // Get net value history
  server.get(
    '/nav-history',
    {
      schema: {
        tags: ['vault'],
        summary: 'Get NAV history for charts',
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', default: 30 },
          },
        },
      },
    },
    async (_request, reply) => {
      // TODO: Fetch from database
      return reply.send([]);
    }
  );
};
