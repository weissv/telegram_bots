import { Prisma } from '@prisma/client';

export interface TenantContext {
  tenantId: string;
}

/**
 * Returns the raw extension configuration object for tenant-level query isolation.
 */
export function getTenantExtensionConfig(tenantId: string) {
  return {
    name: 'multi-tenant-isolation',
    query: {
      product: {
        async findMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async findFirst({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async count({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async aggregate({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async create({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.data = { ...args.data, tenant: { connect: { id: tenantId } } };
          return query(args);
        },
        async createMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((item: any) => ({ ...item, tenant_id: tenantId }));
          } else {
            args.data = { ...args.data, tenant_id: tenantId };
          }
          return query(args);
        },
        async update({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async updateMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async delete({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async deleteMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
      },
      order: {
        async findMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async findFirst({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async count({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async aggregate({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async create({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.data = { ...args.data, tenant: { connect: { id: tenantId } } };
          return query(args);
        },
        async createMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((item: any) => ({ ...item, tenant_id: tenantId }));
          } else {
            args.data = { ...args.data, tenant_id: tenantId };
          }
          return query(args);
        },
        async update({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async updateMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async delete({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async deleteMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
      },
      botConfig: {
        async findUnique({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async findFirst({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async update({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async upsert({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          args.create = { ...args.create, tenant: { connect: { id: tenantId } } };
          return query(args);
        },
      },
      adminUser: {
        async findMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async findFirst({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async create({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.data = { ...args.data, tenant: { connect: { id: tenantId } } };
          return query(args);
        },
      },
      subscription: {
        async findMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
        async findFirst({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          args.where = { ...args.where, tenant_id: tenantId };
          return query(args);
        },
      },
    },
  };
}

/**
 * Creates a Prisma Client Extension that automatically injects `{ tenant_id: tenantId }`
 * into all CRUD queries for multi-tenant models (Product, Order, Subscription, BotConfig, AdminUser).
 */
export function createTenantExtension(tenantId: string) {
  return Prisma.defineExtension(getTenantExtensionConfig(tenantId));
}
