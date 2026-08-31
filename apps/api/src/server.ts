import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rawBody from 'fastify-raw-body';
import rateLimit from '@fastify/rate-limit';
import { getEnv } from '@telegram-commerce/config';
import { webhookRoutes } from './routes/webhooks.js';
import { shopRoutes } from './routes/shop.js';
import { adminRoutes } from './routes/admin.js';
import { billingRoutes } from './routes/billing.js';

export async function createServer(): Promise<FastifyInstance> {
  const env = getEnv();

  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Raw body plugin (for Stripe webhooks)
  await fastify.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  });

  // Rate Limiting
  await fastify.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  // JWT
  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Health Check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      mode: env.MODE,
      timestamp: new Date().toISOString(),
    };
  });

  // Routes
  await fastify.register(webhookRoutes);
  await fastify.register(shopRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(billingRoutes);

  return fastify;
}
