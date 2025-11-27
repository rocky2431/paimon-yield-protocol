import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { healthRoutes } from './routes/health.js';
import { vaultRoutes } from './routes/vault.js';
import { transactionRoutes } from './routes/transactions.js';
import { netvalueRoutes } from './routes/netvalue.js';
import { assetsRoutes } from './routes/assets.js';
import { notificationRoutes } from './routes/notifications.js';
import { reportRoutes } from './routes/reports.js';
import withdrawalRoutes from './routes/withdrawals.js';

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Security plugins
  await server.register(helmet, {
    contentSecurityPolicy: false,
  });

  await server.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // API Documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'Paimon Yield Protocol API',
        description: 'RWA Yield Aggregator Backend API',
        version: '0.1.0',
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || 3001}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'vault', description: 'Vault operations' },
        { name: 'transactions', description: 'Transaction history' },
        { name: 'netvalue', description: 'Historical net value data' },
        { name: 'assets', description: 'RWA asset allocation data' },
        { name: 'notifications', description: 'Notification preferences and history' },
        { name: 'reports', description: 'B2B custom report export' },
        { name: 'withdrawals', description: 'Large withdrawal priority processing' },
      ],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Register routes
  await server.register(healthRoutes, { prefix: '/api' });
  await server.register(vaultRoutes, { prefix: '/api/vault' });
  await server.register(transactionRoutes, { prefix: '/api' });
  await server.register(netvalueRoutes, { prefix: '/api' });
  await server.register(assetsRoutes, { prefix: '/api' });
  await server.register(notificationRoutes, { prefix: '/api' });
  await server.register(reportRoutes, { prefix: '/api' });
  await server.register(withdrawalRoutes, { prefix: '/api/withdrawals' });

  return server;
}
