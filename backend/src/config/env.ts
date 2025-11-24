import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // CORS
  CORS_ORIGIN: z.string().optional(),

  // Database
  DATABASE_URL: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional(),

  // Blockchain
  BSC_MAINNET_RPC_URL: z.string().default('https://bsc-dataseed.binance.org'),
  BSC_TESTNET_RPC_URL: z.string().default('https://data-seed-prebsc-1-s1.binance.org:8545'),

  // Contracts
  PNGY_VAULT_ADDRESS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

export const env = validateEnv();
