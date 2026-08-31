import { FastifyPluginAsync } from 'fastify';
import { prisma, getTenantDb } from '@telegram-commerce/database';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { createCheckoutOrder, fulfillOrder } from '../services/orderService.js';
import { getTenantBotData } from '../services/botManager.js';
import { DEFAULT_THEME_CONFIG } from '@telegram-commerce/config';

export const shopRoutes: FastifyPluginAsync = async (fastify) => {
  // Storefront bootstrap configuration
  fastify.get('/api/v1/shop/bootstrap', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const tenantId = req.tenantId;
    const botData = await getTenantBotData(tenantId);

    if (!botData) {
      return reply.status(404).send({ error: 'Storefront not found' });
    }

    const tenantDb = getTenantDb(tenantId);

    const [categoriesRaw, featuredProducts] = await Promise.all([
      tenantDb.product.findMany({
        where: { is_active: true },
        select: { category: true },
        distinct: ['category'],
      }),
      tenantDb.product.findMany({
        where: { is_active: true },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const categories = categoriesRaw.map((c) => c.category).filter(Boolean);

    const theme = {
      ...DEFAULT_THEME_CONFIG,
      ...botData.tenant.themeConfig,
      storeName: botData.tenant.themeConfig?.storeName || botData.tenant.name,
      currency: botData.tenant.currency || 'USD',
    };

    return reply.send({
      tenant: {
        id: botData.tenant.id,
        name: botData.tenant.name,
        plan: botData.tenant.plan,
        currency: botData.tenant.currency,
        isActive: botData.isActive,
      },
      theme,
      categories: ['All', ...categories],
      featuredProducts,
    });
  });

  // Product listing
  fastify.get<{
    Querystring: {
      category?: string;
      search?: string;
      page?: string;
      limit?: string;
    };
  }>('/api/v1/shop/products', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const tenantId = req.tenantId;
    const tenantDb = getTenantDb(tenantId);

    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: any = { is_active: true };

    if (req.query.category && req.query.category !== 'All') {
      where.category = req.query.category;
    }

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search, mode: 'insensitive' } },
        { description: { contains: req.query.search, mode: 'insensitive' } },
      ];
    }

    const [total, products] = await Promise.all([
      tenantDb.product.count({ where }),
      tenantDb.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return reply.send({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // Single product detail
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/shop/products/:id', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const tenantId = req.tenantId;
    const tenantDb = getTenantDb(tenantId);

    const product = await tenantDb.product.findFirst({
      where: { id: req.params.id, is_active: true },
    });

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    return reply.send({ product });
  });

  // Create checkout session with atomic stock guard
  fastify.post<{
    Body: {
      customerTelegramId: string;
      customerName?: string;
      customerPhone?: string;
      shippingAddress?: string;
      items: Array<{ productId: string; quantity: number }>;
      paymentMethod?: 'STRIPE' | 'MOCK' | 'TELEGRAM_STARS';
      successUrl?: string;
      cancelUrl?: string;
    };
  }>('/api/v1/shop/checkout', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const tenantId = req.tenantId;
    const { customerTelegramId, customerName, customerPhone, shippingAddress, items, paymentMethod, successUrl, cancelUrl } =
      req.body;

    try {
      const result = await createCheckoutOrder({
        tenantId,
        customerTelegramId,
        customerName,
        customerPhone,
        shippingAddress,
        items,
        paymentMethod,
        successUrl,
        cancelUrl,
      });

      return reply.send(result);
    } catch (err: any) {
      req.log.error(err, 'Checkout failed');
      return reply.status(400).send({
        error: err.message || 'Checkout failed due to insufficient stock or invalid request',
      });
    }
  });

  // Order status inquiry
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/shop/orders/:id', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const tenantId = req.tenantId;
    const tenantDb = getTenantDb(tenantId);

    const order = await tenantDb.order.findFirst({
      where: { id: req.params.id },
    });

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    return reply.send({ order });
  });

  // Order payment success callback & redirect page
  fastify.get<{
    Params: { id: string };
    Querystring: { session_id?: string };
  }>('/api/v1/shop/orders/:id/success', async (req, reply) => {
    const { id } = req.params;
    const { session_id } = req.query;

    await fulfillOrder(id, session_id);

    reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Order Confirmed</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 1.5rem; padding: 2.5rem; max-width: 440px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
            .icon { width: 64px; height: 64px; background: #0ea5e9; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 1.5rem; }
            h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
            .badge { display: inline-block; background: rgba(14,165,233,0.15); color: #38bdf8; padding: 0.5rem 1rem; border-radius: 9999px; font-family: monospace; font-size: 0.9rem; margin: 1rem 0; }
            .btn { display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 0.85rem 1.5rem; border-radius: 0.75rem; font-weight: 600; margin-top: 1.5rem; transition: background 0.2s; }
            .btn:hover { background: #0284c7; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h1>Payment Successful!</h1>
            <p>Your order has been confirmed and the merchant has been notified.</p>
            <div class="badge">Order #${id.slice(0, 8)}</div>
            <p>You may now return to the Telegram bot or Mini App to track shipping status.</p>
            <a class="btn" href="javascript:if(window.Telegram?.WebApp){window.Telegram.WebApp.close();}else{window.history.back();}">Return to Telegram</a>
          </div>
        </body>
      </html>
    `);
  });

  // Order payment cancel callback
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/shop/orders/:id/cancel', async (req, reply) => {
    reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Order Cancelled</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 1.5rem; padding: 2.5rem; max-width: 440px; text-align: center; }
            .icon { width: 64px; height: 64px; background: #f43f5e; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 1.5rem; }
            h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
            .btn { display: inline-block; background: #334155; color: white; text-decoration: none; padding: 0.85rem 1.5rem; border-radius: 0.75rem; font-weight: 600; margin-top: 1.5rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✕</div>
            <h1>Payment Cancelled</h1>
            <p>Your payment session was cancelled. No charges were made.</p>
            <a class="btn" href="javascript:if(window.Telegram?.WebApp){window.Telegram.WebApp.close();}else{window.history.back();}">Back to Store</a>
          </div>
        </body>
      </html>
    `);
  });
};
