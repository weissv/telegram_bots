import { FastifyRequest, FastifyReply } from 'fastify';
import { getEnv } from '@telegram-commerce/config';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
  }
}

/**
 * Middleware resolving the tenant ID from header, query param, or standalone default.
 */
export async function tenantContextMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const env = getEnv();

  if (env.MODE === 'standalone') {
    req.tenantId = env.STANDALONE_TENANT_ID;
    return;
  }

  const tenantIdHeader = req.headers['x-tenant-id'] as string;
  const tenantIdQuery = (req.query as any)?.tenant_id as string;
  const tenantIdParam = (req.params as any)?.tenant_id as string;

  let tenantId = tenantIdHeader || tenantIdQuery || tenantIdParam;

  if (tenantId === 'demo-tenant' || !tenantId) {
    tenantId = env.STANDALONE_TENANT_ID;
  }

  req.tenantId = tenantId;
}
