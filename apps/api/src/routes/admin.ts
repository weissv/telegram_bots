import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma, getTenantDb } from '@telegram-commerce/database';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { encryptBotToken, generateWebhookSecret, getEnv, ORDER_STATUS, DEFAULT_THEME_CONFIG, isHttpsUrl } from '@telegram-commerce/config';
import { t } from '@telegram-commerce/i18n';
import { invalidateTenantBot, getOrInitBot } from '../services/botManager.js';
import { cancelReservationExpiry } from '../services/reservationWorker.js';

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
    const { email, password, storeName, ownerTelegramId } = req.body;

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

    // Create tenant + admin user
    const tenant = await prisma.tenant.create({
      data: {
        name: storeName,
        owner_telegram_id: ownerTelegramId || '',
        plan: 'BASIC_20',
        botConfig: {
          create: {
            bot_token_encrypted: encryptBotToken('PLACEHOLDER_TOKEN_TO_UPDATE'),
            webhook_secret: webhookSecret,
            currency: 'UZS',
            theme_config: {
              ...DEFAULT_THEME_CONFIG,
              storeName,
              description: `Официальный Telegram-магазин ${storeName}`,
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

    return reply.send({
      token,
      user: { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan },
    });
  });

  // Merchant Auth: Login
  fastify.post<{
    Body: {
      email: string;
      password: string;
    };
  }>('/api/v1/admin/auth/login', async (req, reply) => {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    const adminUser = await prisma.adminUser.findFirst({
      where: { email: normalizedEmail },
      include: { tenant: true },
    });

    if (!adminUser) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, adminUser.password_hash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign({
      userId: adminUser.id,
      tenantId: adminUser.tenant_id,
      email: adminUser.email,
      role: adminUser.role,
    });

    return reply.send({
      token,
      user: { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      tenant: { id: adminUser.tenant.id, name: adminUser.tenant.name, plan: adminUser.tenant.plan },
    });
  });

  // Protected Admin Routes Group
  fastify.register(async (adminProtected) => {
    adminProtected.addHook('preHandler', adminAuthMiddleware);

    // Current Merchant Profile
    adminProtected.get('/api/v1/admin/auth/me', async (req, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        include: { botConfig: true, subscriptions: true },
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'Tenant not found' });
      }

      return reply.send({
        user: req.adminUser,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          plan: tenant.plan,
          isActive: tenant.is_active,
          ownerTelegramId: tenant.owner_telegram_id,
          botConfig: {
            botUsername: tenant.botConfig?.bot_username,
            currency: tenant.botConfig?.currency,
            themeConfig: tenant.botConfig?.theme_config,
          },
          subscriptions: tenant.subscriptions,
        },
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

      const paidOrders = orders.filter((o) => o.status === ORDER_STATUS.PAID || o.status === ORDER_STATUS.DELIVERED);
      const pendingOrders = orders.filter((o) => o.status === ORDER_STATUS.PENDING);
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
        category?: string;
        isActive?: boolean;
        is_active?: boolean;
      };
    }>('/api/v1/admin/products', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const { title, description, price, stock, images, category, isActive } = req.body;
      const resolvedActive = isActive !== undefined ? isActive : (req.body as any).is_active;

      const product = await tenantDb.product.create({
        data: {
          title,
          description: description || '',
          price: price as any,
          stock: stock ?? 0,
          images: images || [],
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
        category?: string;
        isActive?: boolean;
        is_active?: boolean;
      };
    }>('/api/v1/admin/products/:id', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const { id } = req.params;
      const { title, description, price, stock, images, category, isActive } = req.body;
      const resolvedActive = isActive !== undefined ? isActive : (req.body as any).is_active;

      const product = await tenantDb.product.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price: price as any }),
          ...(stock !== undefined && { stock }),
          ...(images !== undefined && { images }),
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

    // Orders List & Status Update
    adminProtected.get('/api/v1/admin/orders', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const orders = await tenantDb.order.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return reply.send({ orders });
    });

    adminProtected.patch<{
      Params: { id: string };
      Body: { status: string };
    }>('/api/v1/admin/orders/:id/status', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const { id } = req.params;
      const { status } = req.body;

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

      if (existingOrder.status === status) {
        return reply.send({ order: existingOrder });
      }

      const order = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.order.updateMany({
          where: {
            id,
            tenant_id: req.tenantId,
            status: existingOrder.status as any,
          },
          data: { status: status as any },
        });

        if (
          updateResult.count === 1 &&
          existingOrder.status === ORDER_STATUS.PENDING &&
          status === ORDER_STATUS.CANCELLED
        ) {
          const items = Array.isArray(existingOrder.items) ? (existingOrder.items as any[]) : [];
          for (const item of items) {
            const qty = Number(item?.quantity || 0);
            if (item?.productId && qty > 0) {
              await tx.$executeRaw`
                UPDATE "Product"
                SET "stock" = "stock" + ${qty}
                WHERE "id" = ${String(item.productId)}
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

      const notifyKeyMap: Record<string, string> = {
        [ORDER_STATUS.PAID]: 'orders.notify_paid',
        [ORDER_STATUS.DELIVERED]: 'orders.notify_delivered',
        [ORDER_STATUS.CANCELLED]: 'orders.notify_cancelled',
      };
      const notifyKey = notifyKeyMap[status];

      if (
        notifyKey &&
        order &&
        order.customer_telegram_id &&
        /^\d+$/.test(order.customer_telegram_id)
      ) {
        try {
          const botData = await getOrInitBot(req.tenantId);
          if (botData) {
            const message = t('ru', notifyKey, { orderId: order.id.slice(0, 8) });
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

      return reply.send({ order });
    });

    // Settings & Theme update
    adminProtected.get('/api/v1/admin/settings', async (req, reply) => {
      const botConfig = await prisma.botConfig.findUnique({
        where: { tenant_id: req.tenantId },
      });
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
      });

      const mergedTheme = {
        ...DEFAULT_THEME_CONFIG,
        ...((botConfig?.theme_config as any) || {}),
      };

      return reply.send({
        tenant,
        botConfig: {
          botUsername: botConfig?.bot_username,
          currency: botConfig?.currency,
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
      };
    }>('/api/v1/admin/settings', async (req, reply) => {
      const { storeName, currency, themeConfig, ownerTelegramId } = req.body;

      if (storeName || ownerTelegramId) {
        await prisma.tenant.update({
          where: { id: req.tenantId },
          data: {
            ...(storeName && { name: storeName }),
            ...(ownerTelegramId && { owner_telegram_id: ownerTelegramId }),
          },
        });
      }

      const botConfig = await prisma.botConfig.update({
        where: { tenant_id: req.tenantId },
        data: {
          ...(currency && { currency }),
          ...(themeConfig && { theme_config: themeConfig }),
        },
      });

      await invalidateTenantBot(req.tenantId);

      return reply.send({ success: true, botConfig });
    });

    // Bot token registration / update
    adminProtected.post<{
      Body: { botToken: string };
    }>('/api/v1/admin/settings/bot-token', async (req, reply) => {
      const { botToken } = req.body;
      if (!botToken) {
        return reply.status(400).send({ error: 'botToken is required' });
      }

      const env = getEnv();
      const encryptedToken = encryptBotToken(botToken);

      // Verify token with Telegram Bot API
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const meData = (await res.json()) as any;
        if (!meData.ok) {
          return reply.status(400).send({ error: 'Invalid Telegram bot token. getMe failed.' });
        }

        const botUsername = meData.result.username;
        const webhookSecret = generateWebhookSecret();

        await prisma.botConfig.upsert({
          where: { tenant_id: req.tenantId },
          create: {
            tenant_id: req.tenantId,
            bot_token_encrypted: encryptedToken,
            bot_username: botUsername,
            webhook_secret: webhookSecret,
            currency: 'UZS',
            theme_config: DEFAULT_THEME_CONFIG,
          },
          update: {
            bot_token_encrypted: encryptedToken,
            bot_username: botUsername,
            webhook_secret: webhookSecret,
          },
        });

        // Set Telegram webhook
        const webhookUrl = `${env.PUBLIC_API_URL}/api/v1/webhooks/${req.tenantId}`;
        const setHookRes = await fetch(
          `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${webhookSecret}`
        );
        const hookData = (await setHookRes.json()) as any;

        // Register standard bot commands
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

        // Configure Mini App menu button when HTTPS URL is available
        if (isHttpsUrl(env.PUBLIC_MINIAPP_URL)) {
          const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=${req.tenantId}`;
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

        await invalidateTenantBot(req.tenantId);

        return reply.send({
          success: true,
          botUsername,
          webhookConfigured: hookData.ok,
        });
      } catch (err: any) {
        return reply.status(500).send({ error: `Bot setup error: ${err.message}` });
      }
    });
  });
};
