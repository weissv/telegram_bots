import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    adminUser?: {
      userId: string;
      tenantId: string;
      email: string;
      role: string;
    };
  }
}

export async function adminAuthMiddleware(req: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await req.jwtVerify<{
      userId: string;
      tenantId: string;
      email: string;
      role: string;
    }>();

    req.adminUser = payload;
    req.tenantId = payload.tenantId;
  } catch (err) {
    return reply.status(401).send({
      error: 'Unauthorized merchant token or session expired',
    });
  }
}
