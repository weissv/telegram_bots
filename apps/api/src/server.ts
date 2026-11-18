import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rawBody from 'fastify-raw-body';
import rateLimit from '@fastify/rate-limit';
import path from 'path';
import fs from 'fs';
import { getEnv } from '@telegram-commerce/config';
import { prisma } from '@telegram-commerce/database';
import { webhookRoutes } from './routes/webhooks.js';
import { shopRoutes } from './routes/shop.js';
import { adminRoutes } from './routes/admin.js';
import { billingRoutes } from './routes/billing.js';

function findDistPath(appName: string): string {
  const candidates = [
    path.resolve(process.cwd(), `apps/${appName}/dist`),
    path.resolve(process.cwd(), `../${appName}/dist`),
  ];
  return candidates.find((c) => fs.existsSync(c)) || candidates[0];
}

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

  // Static files for Telegram Mini App, Merchant Admin & Landing
  const miniappDist = findDistPath('miniapp');
  const adminDist = findDistPath('admin');
  const landingDist = findDistPath('landing');

  try {
    const fastifyStatic = ((await import('@fastify/static' as any)) as any).default;

    if (fs.existsSync(miniappDist)) {
      await fastify.register(fastifyStatic, {
        root: miniappDist,
        prefix: '/miniapp/',
        decorateReply: false,
      });
      console.log(`📦 Serving Mini App from ${miniappDist} at /miniapp/`);
    }

    if (fs.existsSync(adminDist)) {
      await fastify.register(fastifyStatic, {
        root: adminDist,
        prefix: '/admin/',
        decorateReply: false,
      });
      console.log(`📦 Serving Admin from ${adminDist} at /admin/`);
    }

    if (fs.existsSync(landingDist)) {
      await fastify.register(fastifyStatic, {
        root: landingDist,
        prefix: '/landing/',
        decorateReply: false,
      });

      const landingAssets = path.join(landingDist, 'assets');
      if (fs.existsSync(landingAssets)) {
        await fastify.register(fastifyStatic, {
          root: landingAssets,
          prefix: '/assets/',
          decorateReply: false,
        });
      }
      console.log(`📦 Serving Landing from ${landingDist} at /landing/ and /`);
    }
  } catch (err) {
    console.warn('⚠️ Static serving plugin load notice:', err);
  }

  // Health Check
  fastify.get('/health', async (_req, reply) => {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Database healthcheck timeout')), 3000);
        }),
      ]);

      return reply.status(200).send({
        status: 'ok',
        db: 'ok',
        mode: env.MODE,
        master_bot: !!env.MASTER_BOT_TOKEN,
        allowDemoLogin: process.env.ALLOW_DEMO_LOGIN === 'true',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      fastify.log?.error?.({ err }, 'Database healthcheck failed');
      return reply.status(503).send({
        status: 'error',
        db: 'down',
        mode: env.MODE,
        master_bot: !!env.MASTER_BOT_TOKEN,
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  });

  // Robots.txt
  fastify.get('/robots.txt', async (_req, reply) => {
    return reply.type('text/plain').send('User-agent: *\nAllow: /\n');
  });

  // Root route: serve Landing if built, otherwise redirect to demo storefront
  fastify.get('/', async (req, reply) => {
    if (fs.existsSync(path.join(landingDist, 'index.html'))) {
      if ((reply as any).sendFile) {
        return (reply as any).sendFile('index.html', landingDist);
      }
      return reply.type('text/html').send(fs.readFileSync(path.join(landingDist, 'index.html'), 'utf8'));
    }
    return reply.redirect('/miniapp/?tenant_id=demo-tenant');
  });

  // Routes
  await fastify.register(webhookRoutes);
  await fastify.register(shopRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(billingRoutes);

  // SPA fallback for frontend routes
  fastify.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/admin') && fs.existsSync(path.join(adminDist, 'index.html'))) {
      if ((reply as any).sendFile) {
        return (reply as any).sendFile('index.html', adminDist);
      }
      return reply.type('text/html').send(fs.readFileSync(path.join(adminDist, 'index.html'), 'utf8'));
    }
    if (req.url.startsWith('/miniapp') && fs.existsSync(path.join(miniappDist, 'index.html'))) {
      if ((reply as any).sendFile) {
        return (reply as any).sendFile('index.html', miniappDist);
      }
      return reply.type('text/html').send(fs.readFileSync(path.join(miniappDist, 'index.html'), 'utf8'));
    }
    if ((req.url.startsWith('/landing') || req.url === '/') && fs.existsSync(path.join(landingDist, 'index.html'))) {
      if ((reply as any).sendFile) {
        return (reply as any).sendFile('index.html', landingDist);
      }
      return reply.type('text/html').send(fs.readFileSync(path.join(landingDist, 'index.html'), 'utf8'));
    }
    return reply.status(404).send({ error: 'Route not found' });
  });

  return fastify;
}
