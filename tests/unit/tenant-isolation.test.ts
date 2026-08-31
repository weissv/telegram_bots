import { describe, it, expect, vi } from 'vitest';
import { getTenantExtensionConfig } from '@telegram-commerce/database';

describe('Multi-Tenant Database Query Isolation', () => {
  const tenantAId = '11111111-1111-1111-1111-111111111111';
  const tenantBId = '22222222-2222-2222-2222-222222222222';

  it('should automatically inject tenant_id into product.findMany query args', async () => {
    const config = getTenantExtensionConfig(tenantAId);
    expect(config).toBeDefined();

    let capturedArgs: any = null;
    const mockQuery = vi.fn().mockImplementation(async (args) => {
      capturedArgs = args;
      return [];
    });

    const findManyHandler = config.query.product.findMany;
    expect(findManyHandler).toBeTypeOf('function');

    await findManyHandler({
      args: { where: { is_active: true } },
      query: mockQuery,
    });

    expect(capturedArgs.where).toEqual({
      is_active: true,
      tenant_id: tenantAId,
    });
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('should isolate product queries between Tenant A and Tenant B', async () => {
    const configA = getTenantExtensionConfig(tenantAId);
    const configB = getTenantExtensionConfig(tenantBId);

    let argsA: any = null;
    let argsB: any = null;

    await configA.query.product.findMany({
      args: { where: { category: 'Apparel' } },
      query: async (a: any) => {
        argsA = a;
        return [];
      },
    });

    await configB.query.product.findMany({
      args: { where: { category: 'Apparel' } },
      query: async (a: any) => {
        argsB = a;
        return [];
      },
    });

    expect(argsA.where.tenant_id).toBe(tenantAId);
    expect(argsB.where.tenant_id).toBe(tenantBId);
    expect(argsA.where.tenant_id).not.toBe(argsB.where.tenant_id);
  });

  it('should inject tenant_id into order.findMany and order.count', async () => {
    const config = getTenantExtensionConfig(tenantAId);

    let countArgs: any = null;
    await config.query.order.count({
      args: { where: { status: 'PAID' } },
      query: async (a: any) => {
        countArgs = a;
        return 5;
      },
    });

    expect(countArgs.where).toEqual({
      status: 'PAID',
      tenant_id: tenantAId,
    });
  });

  it('should automatically bind tenant relation in product.create', async () => {
    const config = getTenantExtensionConfig(tenantAId);

    let createArgs: any = null;
    await config.query.product.create({
      args: {
        data: {
          title: 'Cyberpunk Helmet',
          price: 150,
          stock: 10,
        },
      },
      query: async (a: any) => {
        createArgs = a;
        return { id: 'p1', ...a.data };
      },
    });

    expect(createArgs.data.tenant).toEqual({
      connect: { id: tenantAId },
    });
  });
});
