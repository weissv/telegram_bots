import { prisma } from '@telegram-commerce/database';

const UNREACHABLE_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1011',
  'P1017',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ECONNRESET',
  '08001',
  '08003',
  '08004',
  '08006',
  '57P01',
  '57P02',
  '57P03',
]);

/**
 * Ordered, idempotent PostgreSQL DDL statements.
 * Enum value additions MUST execute individually in autocommit mode before
 * subsequent column defaults reference those enum values (prevents PG 55P04).
 */
export const SCHEMA_MIGRATION_STATEMENTS: readonly string[] = [
  `ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT'`,
  `ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW'`,
  `ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_REVIEW'`,
  `ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED'`,
  `ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT'`,
  `ALTER TABLE "BotConfig" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "BotConfig" ALTER COLUMN "currency" SET DEFAULT 'UZS'`,
  `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "plan" "Plan" NOT NULL DEFAULT 'BASIC_20'`,
  `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "invoice_number" TEXT`,
  `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "amount_uzs" INTEGER`,
  `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "payment_reference" TEXT`,
  `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT`,
  `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3)`,
  `ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT'`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "variants" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_method" TEXT NOT NULL DEFAULT 'COURIER'`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "access_token" TEXT`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "receipt_url" TEXT`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3)`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "verified_by" TEXT`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "status_history" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "Order" ALTER COLUMN "payment_method" SET DEFAULT 'PAYNET_XOLIS'`,
  `CREATE INDEX IF NOT EXISTS "Tenant_subscription_status_idx" ON "Tenant"("subscription_status")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_invoice_number_key" ON "Subscription"("invoice_number")`,
];

function isDatabaseUnreachableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    name?: string;
    code?: string;
    errorCode?: string;
    message?: string;
    meta?: { code?: string };
    cause?: { code?: string; message?: string };
  };

  if (e.name === 'PrismaClientInitializationError') {
    return true;
  }

  const candidateCodes = [e.code, e.errorCode, e.meta?.code, e.cause?.code];
  if (candidateCodes.some((c) => c && UNREACHABLE_CODES.has(c))) {
    return true;
  }

  const msg = `${e.message || ''} ${e.cause?.message || ''}`.toLowerCase();
  return (
    msg.includes("can't reach database server") ||
    msg.includes('connection refused') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('server closed the connection') ||
    msg.includes('connection terminated unexpectedly') ||
    msg.includes('the database system is starting up')
  );
}

/**
 * Runs idempotent PostgreSQL DDL statements one by one in autocommit mode so
 * newly added enum values are committed before subsequent defaults use them.
 */
export async function ensureSchemaMigrated(): Promise<void> {
  if (typeof (prisma as any).$executeRawUnsafe !== 'function') {
    return;
  }

  for (const stmt of SCHEMA_MIGRATION_STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err: any) {
      if (isDatabaseUnreachableError(err)) {
        console.error('❌ Database unreachable during schema migration:', err);
        throw err;
      }
      console.warn(`⚠️ Schema migration statement warning (${stmt}):`, err?.message || err);
    }
  }

  console.log('✅ Schema migration check completed');
}
