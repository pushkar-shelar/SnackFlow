import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  
  // Database Configuration (Dual-Profile: Local & Neon Serverless)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  READONLY_DATABASE_URL: z.string().optional(),
  READ_REPLICA_URL: z.string().optional(),
  DB_POOL_SIZE: z.coerce.number().default(5),
  DB_CONNECT_TIMEOUT_S: z.coerce.number().default(15),
  APP_TZ: z.string().default('Asia/Kolkata'),

  // Redis (BullMQ & Cache)
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Security Secrets
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  HMAC_SHARE_SECRET: z.string().min(16, 'HMAC_SHARE_SECRET must be at least 16 characters'),

  // SMTP & Mailpit
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('orders@snackflow.local'),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env | null = null;

export function getEnv(): Env {
  if (!parsedEnv) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const formatted = result.error.format();
      console.error('❌ Environment validation error:', JSON.stringify(formatted, null, 2));
      throw new Error('Invalid environment configuration');
    }
    parsedEnv = result.data;
  }
  return parsedEnv;
}
