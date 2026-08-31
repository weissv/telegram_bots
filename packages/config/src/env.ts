import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const envSchema = z.object({
  MODE: z.enum(['saas', 'standalone']).default('saas'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ENCRYPTION_KEY: z.string().min(64, 'ENCRYPTION_KEY must be a 64-char hex string (32 bytes)'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),

  MASTER_BOT_TOKEN: z.string().optional(),

  PUBLIC_API_URL: z.string().default('http://localhost:3000'),
  PUBLIC_MINIAPP_URL: z.string().default('http://localhost:5173'),
  PUBLIC_ADMIN_URL: z.string().default('http://localhost:5174'),
  PUBLIC_LANDING_URL: z.string().default('http://localhost:5175'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_BASIC_PLAN_PRICE_ID: z.string().optional(),
  STRIPE_PRO_PLAN_PRICE_ID: z.string().optional(),
  STRIPE_STANDALONE_PRICE_ID: z.string().optional(),

  STANDALONE_TENANT_ID: z.string().default('00000000-0000-0000-0000-000000000001'),
  STANDALONE_BOT_TOKEN: z.string().optional(),
  STANDALONE_ADMIN_TELEGRAM_ID: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let parsedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!parsedEnv) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('❌ Environment validation failed:', JSON.stringify(result.error.format(), null, 2));
      // For development/test fallback with sensible defaults if missing
      parsedEnv = envSchema.parse({
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/telegram_commerce',
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret-key-12345678',
        ...process.env,
      });
    } else {
      parsedEnv = result.data;
    }
  }
  return parsedEnv;
}
