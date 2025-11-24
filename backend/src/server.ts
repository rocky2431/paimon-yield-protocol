import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { healthRoutes } from './routes/health.js';
import { vaultRoutes } from './routes/vault.js';

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

  return server;
}
