import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
}

// eslint-disable-next-line @typescript-eslint/require-await
export const healthRoutes: FastifyPluginAsync = async (server: FastifyInstance): Promise<void> => {
  server.get<{ Reply: HealthResponse }>(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Health check endpoint',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'error'] },
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string' },
              uptime: { type: 'number' },
            },
          },
        },
      },
    },
    () => {
      return {
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        uptime: process.uptime(),
      };
    }
  );
};
