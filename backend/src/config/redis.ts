import { Redis } from 'ioredis';

// Redis connection options
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Parse Redis URL for connection options
function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      // TLS for Railway/production
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    return {
      host: 'localhost',
      port: 6379,
    };
  }
}

// Singleton Redis connection
let redisClient: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisClient) {
    const options = parseRedisUrl(redisUrl);
    redisClient = new Redis({
      ...options,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[Redis] Max retries reached, giving up');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on('connect', () => {
      console.warn('[Redis] Connected successfully');
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
  }

  return redisClient;
}

// Get Redis connection options for BullMQ
export function getRedisOptions() {
  return parseRedisUrl(redisUrl);
}

// Health check
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

// Graceful shutdown
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
