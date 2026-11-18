import crypto from 'node:crypto';
import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { prisma, getTenantDb } from '@telegram-commerce/database';
import { getStripeClient } from '@telegram-commerce/payments';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import {
  createCheckoutOrder,
  fulfillOrder,
  confirmPaynetPayment,
  cancelBuyerOrder,
} from '../services/orderService.js';
import { getTenantBotData } from '../services/botManager.js';
import {
  DEFAULT_THEME_CONFIG,
  PAYMENT_METHODS,
  decryptBotToken,
  getEnv,
  isValidPaynetQrUrl,
  validateTelegramInitData,
} from '@telegram-commerce/config';

export type OrderAccessAuthResult =
  | { authorized: true; actor: 'customer_token' | 'telegram_init_data' | 'admin' }
  | { authorized: false; statusCode: 401 | 403; error: string };

function safeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function stripSensitiveOrderFields<T extends Record<string, any>>(order: T): Omit<T, 'access_token'> {
  if (!order) return order;
  const { access_token: _omit, ...rest } = order;
  return rest;
}

/**
 * Reusable order authorization guard checking:
 * (a) matching `access_token` (`?token=`, `x-order-token`, or `body.accessToken`), OR
 * (b) verified `x-telegram-init-data` HMAC whose user ID matches `order.customer_telegram_id`, OR
 * (c) valid Admin Bearer JWT for that tenant.
 */
export async function authorizeOrderAccess(
  req: FastifyRequest,
  order: { tenant_id: string; customer_telegram_id?: string | null; access_token?: string | null },
  tenantId: string
): Promise<OrderAccessAuthResult> {
  if (!order || order.tenant_id !== tenantId) {
    return { authorized: false, statusCode: 403, error: 'Order does not belong to this store' };
  }

  let suppliedMismatch = false;

  // (a) Check order access_token
  const queryToken = typeof (req.query as any)?.token === 'string' ? (req.query as any).token.trim() : '';
  const headerToken = typeof req.headers['x-order-token'] === 'string' ? req.headers['x-order-token'].trim() : '';
  const bodyToken =
    typeof (req.body as any)?.accessToken === 'string' ? String((req.body as any).accessToken).trim() : '';
  const providedOrderToken = queryToken || headerToken || bodyToken;

  if (providedOrderToken) {
    if (order.access_token && safeStringEqual(providedOrderToken, order.access_token)) {
      return { authorized: true, actor: 'customer_token' };
    }
    suppliedMismatch = true;
  }

  // (b) Check Telegram Mini App initData HMAC
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const initData =
    (typeof req.headers['x-telegram-init-data'] === 'string' ? req.headers['x-telegram-init-data'].trim() : '') ||
    (authHeader.startsWith('tma ') ? authHeader.slice(4).trim() : '');

  if (initData) {
    const tenantData = await getTenantBotData(tenantId);
    if (tenantData) {
      try {
        const botToken = decryptBotToken(tenantData.encryptedToken);
        const validation = validateTelegramInitData(initData, botToken);
        if (validation.isValid && validation.user?.id) {
          if (String(validation.user.id) === String(order.customer_telegram_id)) {
            return { authorized: true, actor: 'telegram_init_data' };
          }
          return { authorized: false, statusCode: 403, error: 'Forbidden: Telegram user does not own this order' };
        }
      } catch {
        // invalid decrypt/validation falls through to 401
      }
    }
    return { authorized: false, statusCode: 401, error: 'Invalid Telegram authentication' };
  }

  // (c) Check Admin Bearer JWT for this tenant
  if (authHeader.startsWith('Bearer ')) {
    try {
      const payload = await req.jwtVerify<{ tenantId: string; role?: string }>();
      if (payload.tenantId === tenantId) {
        return { authorized: true, actor: 'admin' };
      }
      return { authorized: false, statusCode: 403, error: 'Forbidden: cross-tenant admin token' };
    } catch {
      return { authorized: false, statusCode: 401, error: 'Invalid or expired admin token' };
    }
  }

  if (suppliedMismatch) {
    return { authorized: false, statusCode: 403, error: 'Forbidden: invalid order access token' };
  }

  return {
    authorized: false,
    statusCode: 401,
    error: 'Unauthorized: order access token, Telegram initData, or admin JWT required',
  };
}

export const shopRoutes: FastifyPluginAsync = async (fastify) => {
  // Storefront bootstrap configuration
  fastify.get('/api/v1/shop/bootstrap', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const tenantId = req.tenantId;
    const botData = await getTenantBotData(tenantId);

    if (!botData) {
      return reply.status(404).send({ error: 'Storefront not found' });
    }

    const tenantDb = getTenantDb(tenantId);
    const env = getEnv();

    const [categoriesRaw, featuredProducts] = await Promise.all([
      tenantDb.product.findMany({
        where: { is_active: true },
        select: { category: true },
        distinct: ['category'],
      }),
      tenantDb.product.findMany({
        where: { is_active: true },
        take: 200,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const categories = categoriesRaw.map((c) => c.category).filter(Boolean);

    const rawTheme = {
      ...DEFAULT_THEME_CONFIG,
      ...botData.tenant.themeConfig,
      storeName: botData.tenant.themeConfig?.storeName || botData.tenant.name,
      currency: botData.tenant.currency || 'UZS',
    };

    const isDemo = Boolean(
      (rawTheme as any).isDemo || (env.MODE !== 'standalone' && tenantId === env.STANDALONE_TENANT_ID)
    );

    const theme = isDemo
      ? {
          ...rawTheme,
          paynetEnabled: false,
          paynetQrUrl: '',
          isDemo: true,
        }
      : rawTheme;

    const subscriptionAllowed =
      botData.subscriptionStatus === 'ACTIVE' || botData.subscriptionStatus === 'TRIALING';
    const hasValidPaynet = Boolean(theme.paynetEnabled && isValidPaynetQrUrl(theme.paynetQrUrl));
    const checkoutEnabled = Boolean(
      !isDemo &&
        botData.tenantActive &&
        botData.botActive &&
        subscriptionAllowed &&
        hasValidPaynet
    );

    let checkoutDisabledReason: string | null = null;
    if (isDemo) {
      checkoutDisabledReason = 'DEMO_STORE';
    } else if (!botData.tenantActive || !subscriptionAllowed) {
      checkoutDisabledReason = 'SUBSCRIPTION_INACTIVE';
    } else if (!botData.botActive) {
      checkoutDisabledReason = 'STORE_NOT_PUBLISHED';
    } else if (!hasValidPaynet) {
      checkoutDisabledReason = 'PAYNET_NOT_CONFIGURED';
    }

    return reply.send({
      tenant: {
        id: botData.tenant.id,
        name: botData.tenant.name,
        plan: botData.tenant.plan,
        currency: botData.tenant.currency || 'UZS',
        isActive: botData.botActive,
        subscriptionStatus: botData.subscriptionStatus,
      },
      theme,
      isDemo,
      checkoutEnabled,
      checkoutDisabledReason,
      categories: ['All', ...categories],
      featuredProducts,
    });
  });

  // Product listing & search
  fastify.get<{
    Querystring: {
      category?: string;
      q?: string;
      search?: string;
      page?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/v1/shop/products', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const tenantId = req.tenantId;
    const tenantDb = getTenantDb(tenantId);

    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit || '20', 10) || 20));
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const skip =
      req.query.offset !== undefined
        ? Math.max(0, Number.parseInt(req.query.offset, 10) || 0)
        : (page - 1) * limit;

    const where: any = { is_active: true };

    if (req.query.category && req.query.category !== 'All') {
      where.category = req.query.category;
    }

    const searchQuery = (req.query.q ?? req.query.search ?? '').trim();
    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } },
        { category: { contains: searchQuery, mode: 'insensitive' } },
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
      total,
      pagination: {
        page,
        limit,
        offset: skip,
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

  // Create checkout session with atomic stock guard & strict store/Paynet checks
  fastify.post<{
    Body: {
      customerTelegramId: string;
      customerName?: string;
      customerPhone?: string;
      shippingAddress?: string;
      deliveryMethod?: 'COURIER' | 'PICKUP' | string;
      items: Array<{ productId: string; quantity: number; variant?: string }>;
      paymentMethod?: 'STRIPE' | 'MOCK' | 'TELEGRAM_STARS' | 'PAYNET_XOLIS';
      successUrl?: string;
      cancelUrl?: string;
    };
  }>('/api/v1/shop/checkout', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const tenantId = req.tenantId;
    const {
      customerTelegramId,
      customerName,
      customerPhone,
      shippingAddress,
      deliveryMethod,
      items,
      paymentMethod,
      successUrl,
      cancelUrl,
    } = req.body || ({} as any);

    try {
      const result = await createCheckoutOrder({
        tenantId,
        customerTelegramId,
        customerName,
        customerPhone,
        shippingAddress,
        deliveryMethod,
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

  // Paynet Xolis payment confirmation by customer (transitions PENDING -> PAYMENT_REVIEW only)
  fastify.post<{
    Params: { id: string };
    Body?: { accessToken?: string; note?: string };
    Querystring?: { token?: string };
  }>('/api/v1/shop/orders/:id/confirm-paynet', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const existingOrder = await prisma.order.findUnique({
      where: { id: req.params.id },
    });

    if (!existingOrder || existingOrder.tenant_id !== req.tenantId) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    const auth = await authorizeOrderAccess(req, existingOrder, req.tenantId);
    if (!auth.authorized) {
      return reply.status(auth.statusCode).send({ error: auth.error });
    }

    try {
      const result = await confirmPaynetPayment(req.params.id, req.tenantId, {
        note: req.body?.note,
      });
      return reply.send({
        success: result.success,
        order: stripSensitiveOrderFields(result.order),
      });
    } catch (err: any) {
      req.log.error(err, 'Paynet confirmation failed');
      return reply.status(400).send({ error: err.message || 'Paynet payment confirmation failed' });
    }
  });

  // Buyer order cancellation (PENDING only, restores stock atomically)
  fastify.post<{
    Params: { id: string };
    Body?: { accessToken?: string };
    Querystring?: { token?: string };
  }>('/api/v1/shop/orders/:id/cancel', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const existingOrder = await prisma.order.findUnique({
      where: { id: req.params.id },
    });

    if (!existingOrder || existingOrder.tenant_id !== req.tenantId) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    const auth = await authorizeOrderAccess(req, existingOrder, req.tenantId);
    if (!auth.authorized) {
      return reply.status(auth.statusCode).send({ error: auth.error });
    }

    try {
      const cancelledOrder = await cancelBuyerOrder(req.params.id, req.tenantId);
      return reply.send({
        success: true,
        order: stripSensitiveOrderFields(cancelledOrder),
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Cannot cancel order' });
    }
  });

  // Protected order status inquiry
  fastify.get<{
    Params: { id: string };
    Querystring?: { token?: string };
  }>('/api/v1/shop/orders/:id', { preHandler: [tenantContextMiddleware] }, async (req, reply) => {
    const tenantId = req.tenantId;
    const tenantDb = getTenantDb(tenantId);

    const order = await tenantDb.order.findFirst({
      where: { id: req.params.id },
    });

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    const auth = await authorizeOrderAccess(req, order, tenantId);
    if (!auth.authorized) {
      return reply.status(auth.statusCode).send({ error: auth.error });
    }

    return reply.send({ order: stripSensitiveOrderFields(order) });
  });

  // Order payment success callback & redirect page (never marks Paynet orders PAID)
  fastify.get<{
    Params: { id: string };
    Querystring: { session_id?: string };
  }>('/api/v1/shop/orders/:id/success', async (req, reply) => {
    const { id } = req.params;
    const { session_id } = req.query;
    const env = getEnv();

    const order = await prisma.order.findUnique({
      where: { id },
    });

    const hasStripeKey = Boolean(env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.includes('placeholder'));

    if (
      order &&
      order.payment_method === PAYMENT_METHODS.STRIPE &&
      hasStripeKey &&
      typeof session_id === 'string' &&
      session_id.startsWith('cs_')
    ) {
      try {
        const stripe = getStripeClient();
        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.payment_status === 'paid' && session.metadata?.orderId === id) {
          await fulfillOrder(id, String(session.payment_intent || session.id));
        }
      } catch (err) {
        req.log.warn({ err }, `Stripe session verification failed on /success for order ${id}`);
      }
    }

    const isPaid = order?.status === 'PAID' || order?.status === 'DELIVERED';
    const heading = isPaid ? 'Payment Confirmed' : 'Order Pending Payment Verification';
    const bodyText = isPaid
      ? 'Your order has been confirmed and the merchant has been notified.'
      : 'Your order is registered. Payment verification is handled by the store operator.';

    reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>${heading}</title>
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
            <div class="icon">${isPaid ? '✓' : '⏳'}</div>
            <h1>${heading}</h1>
            <p>${bodyText}</p>
            <div class="badge">Order #${id.slice(0, 8)}</div>
            <p>You may now return to the Telegram bot or Mini App to track order status.</p>
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
