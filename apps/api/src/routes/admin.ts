import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma, getTenantDb, SubscriptionStatus } from '@telegram-commerce/database';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import {
  encryptBotToken,
  decryptBotToken,
  generateWebhookSecret,
  getEnv,
  ORDER_STATUS,
  DEFAULT_THEME_CONFIG,
  isHttpsUrl,
  isValidPaynetQrUrl,
} from '@telegram-commerce/config';
import { t } from '@telegram-commerce/i18n';
import { invalidateTenantBot, getOrInitBot } from '../services/botManager.js';
import { cancelReservationExpiry } from '../services/reservationWorker.js';

function normalizeVariants(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  const sanitized = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function hasValidBotToken(encryptedToken?: string | null): boolean {
  if (!encryptedToken) return false;
  try {
    const plain = decryptBotToken(encryptedToken);
    return Boolean(plain && !plain.toUpperCase().includes('PLACEHOLDER') && plain.includes(':'));
  } catch {
    return false;
  }
}

async function connectAndVerifyBotToken(tenantId: string, rawToken: string): Promise<{
  botUsername: string;
  webhookConfigured: boolean;
}> {
  const botToken = rawToken.trim();
  if (!botToken || !botToken.includes(':')) {
    const err: any = new Error('Неверный формат токена Telegram бота.');
    err.statusCode = 400;
    throw err;
  }

  const env = getEnv();
  const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
  const meData = (await meRes.json().catch(() => ({}))) as any;

  if (!meRes.ok || !meData?.ok || !meData?.result?.username) {
    const err: any = new Error(
      `Неверный токен Telegram бота: ${meData?.description || 'getMe failed'}`
    );
    err.statusCode = 400;
    throw err;
  }

  const botUsername = String(meData.result.username);
  const encryptedToken = encryptBotToken(botToken);
  const webhookSecret = generateWebhookSecret();
  const baseApiUrl = env.PUBLIC_API_URL.replace(/\/+$/, '');
  const webhookUrl = `${baseApiUrl}/api/v1/webhooks/telegram/${tenantId}`;

  const setHookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
    }),
  });
  const hookData = (await setHookRes.json().catch(() => ({}))) as any;

  if (!setHookRes.ok || hookData?.ok !== true) {
    const err: any = new Error(
      `Ошибка регистрации webhook в Telegram: ${hookData?.description || setHookRes.statusText || 'setWebhook failed'}`
    );
    err.statusCode = 502;
    throw err;
  }

  await prisma.botConfig.upsert({
    where: { tenant_id: tenantId },
    create: {
      tenant_id: tenantId,
      bot_token_encrypted: encryptedToken,
      bot_username: botUsername,
      webhook_secret: webhookSecret,
      is_active: false,
      currency: 'UZS',
      theme_config: DEFAULT_THEME_CONFIG,
    },
    update: {
      bot_token_encrypted: encryptedToken,
      bot_username: botUsername,
      webhook_secret: webhookSecret,
    },
  });

  // Register standard bot commands (non-fatal)
  await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Главное меню' },
        { command: 'catalog', description: 'Каталог товаров' },
        { command: 'cart', description: 'Корзина' },
        { command: 'orders', description: 'Мои заказы' },
        { command: 'webapp', description: 'Открыть магазин' },
        { command: 'lang', description: 'Сменить язык' },
        { command: 'help', description: 'Помощь' },
      ],
    }),
  }).catch(() => {});

  // Configure Mini App menu button when HTTPS URL is available (non-fatal)
  if (isHttpsUrl(env.PUBLIC_MINIAPP_URL)) {
    const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=${tenantId}`;
    await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '🛍️ Открыть магазин',
          web_app: { url: miniappUrl },
        },
      }),
    }).catch(() => {});
  }

  await invalidateTenantBot(tenantId);
  await getOrInitBot(tenantId).catch(() => {});

  return {
    botUsername,
    webhookConfigured: true,
  };
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Merchant Auth: Registration
  fastify.post<{
    Body: {
      email: string;
      password: string;
      storeName: string;
      ownerTelegramId?: string;
    };
  }>('/api/v1/admin/auth/register', async (req, reply) => {
    const { email, password, storeName, ownerTelegramId } = req.body || ({} as any);

    if (!email || !password || !storeName) {
      return reply.status(400).send({ error: 'Email, password, and storeName are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.adminUser.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return reply.status(409).send({
        error: 'Этот email уже зарегистрирован. Пожалуйста, войдите в аккаунт или используйте другой email.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const webhookSecret = generateWebhookSecret();

    // Create draft tenant (PENDING_PAYMENT) + unpublished BotConfig (is_active: false) + OWNER admin user
    const tenant = await prisma.tenant.create({
      data: {
        name: storeName.trim(),
        owner_telegram_id: ownerTelegramId ? String(ownerTelegramId).trim() : '',
        plan: 'BASIC_20',
        subscription_status: SubscriptionStatus.PENDING_PAYMENT as any,
        is_active: true,
        botConfig: {
          create: {
            bot_token_encrypted: encryptBotToken('PLACEHOLDER_TOKEN_TO_UPDATE'),
            webhook_secret: webhookSecret,
            is_active: false,
            currency: 'UZS',
            theme_config: {
              ...DEFAULT_THEME_CONFIG,
              storeName: storeName.trim(),
              description: `Официальный Telegram-магазин ${storeName.trim()}`,
            },
          },
        },
        adminUsers: {
          create: {
            email: normalizedEmail,
            password_hash: passwordHash,
            role: 'OWNER',
          },
        },
      },
      include: {
        adminUsers: true,
      },
    });

    const adminUser = tenant.adminUsers[0];
    const token = fastify.jwt.sign({
      userId: adminUser.id,
      tenantId: tenant.id,
      email: adminUser.email,
      role: adminUser.role,
    });

    const adminPayload = { id: adminUser.id, email: adminUser.email, role: adminUser.role };

    return reply.status(201).send({
      token,
      user: adminPayload,
      admin: adminPayload,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        subscriptionStatus: (tenant as any).subscription_status || SubscriptionStatus.PENDING_PAYMENT,
      },
    });
  });

  // Merchant Auth: Login
  fastify.post<{
    Body: {
      email: string;
      password: string;
    };
  }>('/api/v1/admin/auth/login', async (req, reply) => {
    const { email, password } = req.body || ({} as any);
    const normalizedEmail = (email || '').trim().toLowerCase();

    const isProd = process.env.NODE_ENV === 'production';
    const allowDemo = process.env.ALLOW_DEMO_LOGIN === 'true';
    if (normalizedEmail === 'demo_merchant@telegram-commerce.local' && isProd && !allowDemo) {
      return reply.status(403).send({
        error: 'Демо-вход отключён в production-режиме. Используйте свой аккаунт или зарегистрируйтесь.',
      });
    }

    const adminUser = await prisma.adminUser.findFirst({
      where: { email: normalizedEmail },
      include: { tenant: true },
    });

    if (!adminUser) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password || '', adminUser.password_hash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign({
      userId: adminUser.id,
      tenantId: adminUser.tenant_id,
      email: adminUser.email,
      role: adminUser.role,
    });

    const adminPayload = { id: adminUser.id, email: adminUser.email, role: adminUser.role };

    return reply.send({
      token,
      user: adminPayload,
      admin: adminPayload,
      tenant: {
        id: adminUser.tenant.id,
        name: adminUser.tenant.name,
        plan: adminUser.tenant.plan,
        subscriptionStatus: (adminUser.tenant as any).subscription_status,
      },
    });
  });

  // Protected Admin Routes Group
  fastify.register(async (adminProtected) => {
    adminProtected.addHook('preHandler', adminAuthMiddleware);

    // Current Merchant Profile + BotConfig + Latest Subscription + Launch Readiness Checklist
    adminProtected.get('/api/v1/admin/auth/me', async (req, reply) => {
      const [tenant, activeProductCount] = await Promise.all([
        prisma.tenant.findUnique({
          where: { id: req.tenantId },
          include: {
            botConfig: true,
            subscriptions: {
              orderBy: { createdAt: 'desc' },
            },
          },
        }),
        prisma.product.count({
          where: { tenant_id: req.tenantId, is_active: true },
        }),
      ]);

      if (!tenant) {
        return reply.status(404).send({ error: 'Tenant not found' });
      }

      const mergedTheme = {
        ...DEFAULT_THEME_CONFIG,
        ...((tenant.botConfig?.theme_config as any) || {}),
      };

      const botConnected = Boolean(
        tenant.botConfig?.bot_username && hasValidBotToken(tenant.botConfig?.bot_token_encrypted)
      );
      const paynetConfigured = Boolean(
        mergedTheme.paynetEnabled && isValidPaynetQrUrl(mergedTheme.paynetQrUrl)
      );
      const legalConfigured = Boolean(
        String(mergedTheme.legalName || '').trim() && String(mergedTheme.supportContact || '').trim()
      );
      const hasActiveProduct = activeProductCount >= 1;
      const canPublish = Boolean(
        botConnected &&
          hasActiveProduct &&
          (!mergedTheme.paynetEnabled || (paynetConfigured && legalConfigured))
      );

      const latestSubscription = tenant.subscriptions?.[0] || null;
      const botConfigPayload = {
        botUsername: tenant.botConfig?.bot_username || null,
        isActive: Boolean(tenant.botConfig?.is_active),
        currency: tenant.botConfig?.currency || 'UZS',
        themeConfig: mergedTheme,
      };

      return reply.send({
        user: req.adminUser,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          plan: tenant.plan,
          subscriptionStatus: (tenant as any).subscription_status,
          isActive: tenant.is_active,
          ownerTelegramId: tenant.owner_telegram_id,
          botConfig: botConfigPayload,
          subscriptions: tenant.subscriptions,
        },
        botConfig: botConfigPayload,
        subscription: latestSubscription,
        readiness: {
          botConnected,
          paynetConfigured,
          legalConfigured,
          hasActiveProduct,
          activeProductCount,
          canPublish,
        },
        demoLoginAllowed:
          process.env.ALLOW_DEMO_LOGIN === 'true' || process.env.NODE_ENV !== 'production',
      });
    });

    // Analytics Dashboard
    adminProtected.get('/api/v1/admin/analytics', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);

      const [orders, productsCount] = await Promise.all([
        tenantDb.order.findMany({
          orderBy: { createdAt: 'desc' },
        }),
        tenantDb.product.count(),
      ]);

      const paidOrders = orders.filter(
        (o) => o.status === ORDER_STATUS.PAID || o.status === ORDER_STATUS.DELIVERED
      );
      const pendingOrders = orders.filter((o) => o.status === ORDER_STATUS.PENDING);
      const paymentReviewOrders = orders.filter((o) => o.status === ORDER_STATUS.PAYMENT_REVIEW);
      const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

      // Last 14 days (UTC), zero-filled, oldest first
      const DAY_MS = 24 * 60 * 60 * 1000;
      const now = new Date();
      const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const revenueByDay = Array.from({ length: 14 }, (_, i) => ({
        date: new Date(todayUtc - (13 - i) * DAY_MS).toISOString().slice(0, 10),
        revenue: 0,
        orders: 0,
      }));
      const revenueDayIndex = new Map(revenueByDay.map((d, i) => [d.date, i]));
      for (const o of paidOrders) {
        const idx = revenueDayIndex.get(new Date(o.createdAt).toISOString().slice(0, 10));
        if (idx !== undefined) {
          revenueByDay[idx].revenue += Number(o.total_amount);
          revenueByDay[idx].orders += 1;
        }
      }

      return reply.send({
        metrics: {
          totalRevenue,
          paidOrdersCount: paidOrders.length,
          pendingOrdersCount: pendingOrders.length,
          paymentReviewOrdersCount: paymentReviewOrders.length,
          totalProductsCount: productsCount,
          averageOrderValue: paidOrders.length ? totalRevenue / paidOrders.length : 0,
        },
        recentOrders: orders.slice(0, 10),
        revenueByDay,
      });
    });

    // Products CRUD
    adminProtected.get('/api/v1/admin/products', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const products = await tenantDb.product.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return reply.send({ products });
    });

    adminProtected.post<{
      Body: {
        title: string;
        description: string;
        price: number;
        stock: number;
        images?: string[];
        variants?: string[] | string;
        category?: string;
        isActive?: boolean;
        is_active?: boolean;
      };
    }>('/api/v1/admin/products', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const { title, description, price, stock, images, variants, category, isActive } = req.body;
      const resolvedActive = isActive !== undefined ? isActive : (req.body as any).is_active;
      const resolvedVariants = variants !== undefined ? normalizeVariants(variants) : [];

      const product = await tenantDb.product.create({
        data: {
          title,
          description: description || '',
          price: price as any,
          stock: stock ?? 0,
          images: images || [],
          variants: resolvedVariants as any,
          category: category || 'General',
          is_active: resolvedActive !== undefined ? Boolean(resolvedActive) : true,
        } as any,
      });

      return reply.status(201).send({ product });
    });

    adminProtected.put<{
      Params: { id: string };
      Body: {
        title?: string;
        description?: string;
        price?: number;
        stock?: number;
        images?: string[];
        variants?: string[] | string;
        category?: string;
        isActive?: boolean;
        is_active?: boolean;
      };
    }>('/api/v1/admin/products/:id', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const { id } = req.params;
      const { title, description, price, stock, images, variants, category, isActive } = req.body;
      const resolvedActive = isActive !== undefined ? isActive : (req.body as any).is_active;
      const resolvedVariants = variants !== undefined ? normalizeVariants(variants) : undefined;

      const product = await tenantDb.product.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price: price as any }),
          ...(stock !== undefined && { stock }),
          ...(images !== undefined && { images }),
          ...(resolvedVariants !== undefined && { variants: resolvedVariants as any }),
          ...(category !== undefined && { category }),
          ...(resolvedActive !== undefined && { is_active: Boolean(resolvedActive) }),
        },
      });

      return reply.send({ product });
    });

    adminProtected.delete<{
      Params: { id: string };
    }>('/api/v1/admin/products/:id', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      await tenantDb.product.delete({
        where: { id: req.params.id },
      });
      return reply.send({ success: true });
    });

    // Bulk Products Import / Upsert
    adminProtected.post<{
      Body: {
        products: Array<{
          id?: string;
          title: string;
          description?: string;
          price: number;
          stock?: number;
          images?: string[];
          variants?: string[] | string;
          category?: string;
          isActive?: boolean;
        }>;
        upsert?: boolean;
      };
    }>('/api/v1/admin/products/bulk', async (req, reply) => {
      const tenantId = req.tenantId;
      const { products, upsert = true } = req.body;

      if (!Array.isArray(products) || products.length === 0) {
        return reply.status(400).send({ error: 'Products array is required and cannot be empty' });
      }

      let created = 0;
      let updated = 0;

      await prisma.$transaction(async (tx) => {
        for (const item of products) {
          if (!item.title || item.price === undefined || item.price === null || isNaN(Number(item.price))) {
            continue;
          }

          const priceVal = Number(item.price);
          const stockVal = item.stock !== undefined ? Math.max(0, parseInt(String(item.stock), 10) || 0) : 0;
          const categoryVal = (item.category && item.category.trim()) || 'Общее';
          const descriptionVal = item.description || '';
          const imagesVal = Array.isArray(item.images) ? item.images : [];
          const variantsVal = item.variants !== undefined ? normalizeVariants(item.variants) : [];
          const isActiveVal = item.isActive !== undefined ? Boolean(item.isActive) : true;

          if (upsert && item.id) {
            const existing = await tx.product.findFirst({
              where: { id: item.id, tenant_id: tenantId },
            });

            if (existing) {
              await tx.product.update({
                where: { id: existing.id },
                data: {
                  title: item.title.trim(),
                  description: descriptionVal,
                  price: priceVal as any,
                  stock: stockVal,
                  category: categoryVal,
                  images: imagesVal,
                  variants: variantsVal as any,
                  is_active: isActiveVal,
                },
              });
              updated++;
              continue;
            }
          }

          await tx.product.create({
            data: {
              tenant_id: tenantId,
              title: item.title.trim(),
              description: descriptionVal,
              price: priceVal as any,
              stock: stockVal,
              category: categoryVal,
              images: imagesVal,
              variants: variantsVal as any,
              is_active: isActiveVal,
            },
          });
          created++;
        }
      });

      return reply.send({
        success: true,
        created,
        updated,
        total: created + updated,
      });
    });

    // Bulk Status Toggle
    adminProtected.post<{
      Body: {
        productIds: string[];
        isActive: boolean;
      };
    }>('/api/v1/admin/products/bulk-status', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const { productIds, isActive } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return reply.status(400).send({ error: 'productIds array is required' });
      }

      const res = await tenantDb.product.updateMany({
        where: { id: { in: productIds } },
        data: { is_active: Boolean(isActive) },
      });

      return reply.send({ success: true, count: res.count });
    });

    // Bulk Delete
    adminProtected.post<{
      Body: {
        productIds: string[];
      };
    }>('/api/v1/admin/products/bulk-delete', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const { productIds } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return reply.status(400).send({ error: 'productIds array is required' });
      }

      const res = await tenantDb.product.deleteMany({
        where: { id: { in: productIds } },
      });

      return reply.send({ success: true, count: res.count });
    });

    // Orders List
    adminProtected.get('/api/v1/admin/orders', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const orders = await tenantDb.order.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return reply.send({ orders });
    });

    // Orders UTF-8 BOM CSV Export
    adminProtected.get('/api/v1/admin/orders/export', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const orders = await tenantDb.order.findMany({
        orderBy: { createdAt: 'desc' },
      });

      const headers = [
        'ID',
        'Дата',
        'Статус',
        'Покупатель',
        'Телефон',
        'Telegram ID',
        'Доставка',
        'Адрес',
        'Метод оплаты',
        'Payment ID',
        'Чек URL',
        'Стоимость доставки',
        'Итого',
        'Товары',
      ];

      const lines = [headers.map(escapeCsvCell).join(';')];

      for (const ord of orders as any[]) {
        const items = Array.isArray(ord.items) ? ord.items : [];
        const itemsSummary = items
          .map((i: any) => `${i?.title || 'Товар'}${i?.variant ? ` (${i.variant})` : ''} × ${i?.quantity || 1}`)
          .join(', ');

        lines.push(
          [
            ord.id,
            ord.createdAt ? new Date(ord.createdAt).toISOString() : '',
            ord.status,
            ord.customer_name || '',
            ord.customer_phone || '',
            ord.customer_telegram_id || '',
            ord.delivery_method || 'COURIER',
            ord.shipping_address || '',
            ord.payment_method || '',
            ord.payment_id || '',
            ord.receipt_url || '',
            Number(ord.delivery_fee || 0),
            Number(ord.total_amount || 0),
            itemsSummary,
          ]
            .map(escapeCsvCell)
            .join(';')
        );
      }

      const csvBody = `\uFEFF${lines.join('\r\n')}`;
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="orders-export.csv"')
        .send(csvBody);
    });

    // Shared Order Status / Payment Verification Update Handler
    const updateOrderHandler = async (
      req: FastifyRequest<{
        Params: { id: string };
        Body: { status: string; paymentId?: string; receiptUrl?: string; note?: string };
      }>,
      reply: FastifyReply
    ) => {
      const tenantDb = getTenantDb(req.tenantId);
      const { id } = req.params;
      const { status, paymentId, receiptUrl, note } = req.body || ({} as any);

      const validStatuses = Object.values(ORDER_STATUS) as string[];
      if (!status || !validStatuses.includes(status)) {
        return reply.status(400).send({ error: 'Invalid order status' });
      }

      const existingOrder = await tenantDb.order.findFirst({
        where: { id },
      });

      if (!existingOrder) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      const trimmedPaymentId = typeof paymentId === 'string' ? paymentId.trim() : '';
      const trimmedReceiptUrl = typeof receiptUrl === 'string' ? receiptUrl.trim() : undefined;
      const trimmedNote = typeof note === 'string' ? note.trim() : '';

      if (status === ORDER_STATUS.PAID) {
        const effectivePaymentId =
          trimmedPaymentId || (existingOrder.status === ORDER_STATUS.PAID ? existingOrder.payment_id || '' : '');
        if (!effectivePaymentId) {
          return reply.status(400).send({
            error: 'Для подтверждения оплаты (PAID) необходимо указать paymentId (номер транзакции / чека Paynet)',
          });
        }

        const duplicateOrder = await prisma.order.findFirst({
          where: {
            tenant_id: req.tenantId,
            payment_id: effectivePaymentId,
            id: { not: id },
          },
        });
        if (duplicateOrder) {
          return reply.status(409).send({
            error: 'Этот paymentId уже использован для другого заказа',
            code: 'DUPLICATE_PAYMENT_ID',
          });
        }
      }

      if (
        existingOrder.status === status &&
        !trimmedPaymentId &&
        trimmedReceiptUrl === undefined &&
        !trimmedNote
      ) {
        return reply.send({ order: existingOrder });
      }

      const prevHistory = Array.isArray((existingOrder as any).status_history)
        ? ((existingOrder as any).status_history as any[])
        : [];
      const historyEntry: Record<string, any> = {
        status,
        at: new Date().toISOString(),
        by: req.adminUser?.email || 'admin',
      };
      if (trimmedNote) historyEntry.note = trimmedNote;
      if (trimmedPaymentId) historyEntry.paymentId = trimmedPaymentId;
      if (trimmedReceiptUrl) historyEntry.receiptUrl = trimmedReceiptUrl;

      const updateData: Record<string, any> = {
        status: status as any,
        status_history: [...prevHistory, historyEntry] as any,
      };
      if (status === ORDER_STATUS.PAID) {
        if (trimmedPaymentId) updateData.payment_id = trimmedPaymentId;
        updateData.verified_at = new Date();
        updateData.verified_by = req.adminUser?.email || 'admin';
      }
      if (trimmedReceiptUrl !== undefined) {
        updateData.receipt_url = trimmedReceiptUrl || null;
      }

      const wasAlreadyRestored =
        existingOrder.status === ORDER_STATUS.CANCELLED ||
        existingOrder.status === ORDER_STATUS.REFUNDED;
      const shouldRestoreStock =
        !wasAlreadyRestored &&
        (status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.REFUNDED);

      const order = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.order.updateMany({
          where: {
            id,
            tenant_id: req.tenantId,
            status: existingOrder.status as any,
          },
          data: updateData,
        });

        if (updateResult.count === 1 && shouldRestoreStock) {
          const items = Array.isArray(existingOrder.items) ? (existingOrder.items as any[]) : [];
          for (const item of items) {
            const productId = item?.productId || item?.id;
            const qty = Number(item?.quantity || 0);
            if (productId && qty > 0) {
              await tx.$executeRaw`
                UPDATE "Product"
                SET "stock" = "stock" + ${qty}
                WHERE "id" = ${String(productId)}
                  AND "tenant_id" = ${req.tenantId}
              `;
            }
          }
        }

        return tx.order.findFirst({
          where: { id, tenant_id: req.tenantId },
        });
      });

      if (existingOrder.status === ORDER_STATUS.PENDING && status !== ORDER_STATUS.PENDING) {
        await cancelReservationExpiry(id);
      }

      if (
        order &&
        order.customer_telegram_id &&
        /^\d+$/.test(order.customer_telegram_id) &&
        existingOrder.status !== status
      ) {
        let message: string | null = null;
        const shortId = order.id.slice(0, 8);
        if (status === ORDER_STATUS.PAID) {
          message = (order as any).receipt_url
            ? t('ru', 'orders.notify_paid_with_receipt', {
                orderId: shortId,
                receiptUrl: escapeHtml(String((order as any).receipt_url)),
              })
            : t('ru', 'orders.notify_paid', { orderId: shortId });
        } else if (status === ORDER_STATUS.DELIVERED) {
          message = t('ru', 'orders.notify_delivered', { orderId: shortId });
        } else if (status === ORDER_STATUS.CANCELLED) {
          message = t('ru', 'orders.notify_cancelled', { orderId: shortId });
        } else if (status === ORDER_STATUS.REFUNDED) {
          message = t('ru', 'orders.notify_refunded', { orderId: shortId });
        }

        if (message) {
          try {
            const botData = await getOrInitBot(req.tenantId);
            if (botData) {
              await botData.bot.api.sendMessage(order.customer_telegram_id, message, {
                parse_mode: 'HTML',
              });
            }
          } catch (notifyErr) {
            req.log.warn(
              { notifyErr },
              `Failed to notify customer ${order.customer_telegram_id} about order ${order.id} status ${status}`
            );
          }
        }
      }

      return reply.send({ order });
    };

    adminProtected.patch('/api/v1/admin/orders/:id', updateOrderHandler);
    adminProtected.patch('/api/v1/admin/orders/:id/status', updateOrderHandler);

    // Settings & Theme update
    adminProtected.get('/api/v1/admin/settings', async (req, reply) => {
      const [botConfig, tenant] = await Promise.all([
        prisma.botConfig.findUnique({ where: { tenant_id: req.tenantId } }),
        prisma.tenant.findUnique({ where: { id: req.tenantId } }),
      ]);

      const mergedTheme = {
        ...DEFAULT_THEME_CONFIG,
        ...((botConfig?.theme_config as any) || {}),
      };

      return reply.send({
        tenant,
        botConfig: {
          botUsername: botConfig?.bot_username,
          isActive: Boolean(botConfig?.is_active),
          currency: botConfig?.currency || 'UZS',
          themeConfig: mergedTheme,
        },
      });
    });

    adminProtected.put<{
      Body: {
        storeName?: string;
        currency?: string;
        themeConfig?: any;
        ownerTelegramId?: string;
        botToken?: string;
        isActive?: boolean;
      };
    }>('/api/v1/admin/settings', async (req, reply) => {
      const { storeName, currency, themeConfig, ownerTelegramId, botToken, isActive } =
        req.body || ({} as any);

      const currentBotConfig = await prisma.botConfig.findUnique({
        where: { tenant_id: req.tenantId },
      });

      const mergedTheme = {
        ...DEFAULT_THEME_CONFIG,
        ...((currentBotConfig?.theme_config as Record<string, any>) || {}),
        ...(themeConfig && typeof themeConfig === 'object' ? themeConfig : {}),
      };

      if (storeName) {
        mergedTheme.storeName = storeName.trim();
      }

      // Enforce Paynet QR & Legal info when merchant enables Paynet payments
      if (mergedTheme.paynetEnabled === true) {
        if (!isValidPaynetQrUrl(mergedTheme.paynetQrUrl)) {
          return reply.status(400).send({
            error:
              'Для включения приёма оплат Paynet укажите корректную ссылку Paynet QR-Online (https://app.paynet.uz/qr-online/...).',
          });
        }
        if (!String(mergedTheme.legalName || '').trim() || !String(mergedTheme.supportContact || '').trim()) {
          return reply.status(400).send({
            error:
              'Перед включением оплаты заполните юридическое название / ФИО продавца и контакт поддержки.',
          });
        }
      }

      // If botToken is supplied in settings PUT, verify getMe + setWebhook strictly before saving
      if (typeof botToken === 'string' && botToken.trim()) {
        try {
          await connectAndVerifyBotToken(req.tenantId, botToken.trim());
        } catch (err: any) {
          return reply.status(err.statusCode || 500).send({ error: err.message });
        }
      }

      // Enforce storefront publication checklist when toggling isActive: true
      if (isActive === true) {
        const latestBotConfig = await prisma.botConfig.findUnique({
          where: { tenant_id: req.tenantId },
        });
        if (!latestBotConfig?.bot_username || !hasValidBotToken(latestBotConfig?.bot_token_encrypted)) {
          return reply.status(400).send({
            error: 'Для публикации витрины сначала подключите действующего Telegram-бота (@BotFather).',
          });
        }

        const activeProductCount = await prisma.product.count({
          where: { tenant_id: req.tenantId, is_active: true },
        });
        if (activeProductCount < 1) {
          return reply.status(400).send({
            error: 'Добавьте хотя бы один активный товар перед публикацией витрины.',
          });
        }

        if (mergedTheme.paynetEnabled === true) {
          if (
            !isValidPaynetQrUrl(mergedTheme.paynetQrUrl) ||
            !String(mergedTheme.legalName || '').trim() ||
            !String(mergedTheme.supportContact || '').trim()
          ) {
            return reply.status(400).send({
              error:
                'Заполните Paynet QR-Online и реквизиты/поддержку продавца перед публикацией витрины с оплатой.',
            });
          }
        }
      }

      if (storeName || ownerTelegramId !== undefined) {
        await prisma.tenant.update({
          where: { id: req.tenantId },
          data: {
            ...(storeName && { name: storeName.trim() }),
            ...(ownerTelegramId !== undefined && { owner_telegram_id: String(ownerTelegramId).trim() }),
          },
        });
      }

      const botConfig = await prisma.botConfig.update({
        where: { tenant_id: req.tenantId },
        data: {
          ...(currency && { currency }),
          ...(themeConfig || storeName ? { theme_config: mergedTheme } : {}),
          ...(isActive !== undefined && { is_active: Boolean(isActive) }),
        },
      });

      await invalidateTenantBot(req.tenantId);
      if (botConfig.is_active) {
        await getOrInitBot(req.tenantId).catch(() => {});
      }

      return reply.send({
        success: true,
        botConfig: {
          ...botConfig,
          isActive: botConfig.is_active,
          themeConfig: mergedTheme,
        },
      });
    });

    // Test Telegram notification endpoint
    adminProtected.post('/api/v1/admin/settings/test-notification', async (req, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        include: { botConfig: true },
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'Tenant not found' });
      }

      if (!tenant.owner_telegram_id || !/^\d+$/.test(tenant.owner_telegram_id.trim())) {
        return reply.status(400).send({
          error:
            'Telegram ID владельца ещё не привязан. Укажите его в настройках или авторизуйтесь через @miraiedu_bot (/login).',
        });
      }

      if (!tenant.botConfig || !hasValidBotToken(tenant.botConfig.bot_token_encrypted)) {
        return reply.status(400).send({
          error: 'Бот магазина ещё не подключён. Сначала сохраните токен от @BotFather.',
        });
      }

      try {
        const botData = await getOrInitBot(req.tenantId);
        if (!botData) {
          return reply.status(400).send({ error: 'Не удалось инициализировать бота магазина.' });
        }

        const botName = tenant.botConfig.bot_username
          ? `@${escapeHtml(tenant.botConfig.bot_username)}`
          : 'бот магазина';

        await botData.bot.api.sendMessage(
          tenant.owner_telegram_id.trim(),
          `✅ <b>Тестовое уведомление — ${escapeHtml(tenant.name)}</b>\n\nВаш ${botName} подключён и готов отправлять заказы покупателей!`,
          { parse_mode: 'HTML' }
        );

        return reply.send({ success: true });
      } catch (err: any) {
        const usernameHint = tenant.botConfig.bot_username
          ? `@${tenant.botConfig.bot_username}`
          : 'бота магазина';
        return reply.status(400).send({
          error: `Не удалось отправить сообщение в Telegram (${err?.message || 'forbidden'}). Откройте ${usernameHint} в Telegram и нажмите /start, затем повторите тест.`,
        });
      }
    });

    // Bot token registration / update
    adminProtected.post<{
      Body: { botToken: string };
    }>('/api/v1/admin/settings/bot-token', async (req, reply) => {
      const { botToken } = req.body || ({} as any);
      if (!botToken || !String(botToken).trim()) {
        return reply.status(400).send({ error: 'botToken is required' });
      }

      try {
        const result = await connectAndVerifyBotToken(req.tenantId, String(botToken));
        return reply.send({
          success: true,
          botUsername: result.botUsername,
          webhookConfigured: result.webhookConfigured,
        });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({ error: err.message });
      }
    });
  });
};
