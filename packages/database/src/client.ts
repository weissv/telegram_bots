import { PrismaClient } from '@prisma/client';
import { createTenantExtension } from './tenantExtension.js';
import { getEnv } from '@telegram-commerce/config';

declare global {
  // eslint-disable-next-line no-var
  var __globalPrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__globalPrisma__ ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__globalPrisma__ = prisma;
}

/**
 * Returns a tenant-isolated Prisma client for the specified tenantId.
 * Automatically injects tenant_id into queries.
 */
export function getTenantDb(tenantId?: string) {
  const env = getEnv();
  const effectiveTenantId = tenantId || env.STANDALONE_TENANT_ID;
  return prisma.$extends(createTenantExtension(effectiveTenantId));
}

export type TenantDbClient = ReturnType<typeof getTenantDb>;
export { PrismaClient } from '@prisma/client';
