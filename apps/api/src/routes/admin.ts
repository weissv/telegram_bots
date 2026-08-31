import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma, getTenantDb } from '@telegram-commerce/database';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { encryptBotToken, generateWebhookSecret, getEnv, ORDER_STATUS } from '@telegram-commerce/config';
import { invalidateTenantBot } from '../services/botManager.js';

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
            currency: 'USD',
            theme_config: {
              storeName,
              primaryColor: '#0ea5e9',
              description: `Official ${storeName} Telegram Store`,
            },
          },
        },
        adminUsers: {
          create: {
            email,
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

    const adminUser = await prisma.adminUser.findFirst({
      where: { email },
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

      return reply.send({
        metrics: {
          totalRevenue,
          paidOrdersCount: paidOrders.length,
          pendingOrdersCount: pendingOrders.length,
          totalProductsCount: productsCount,
          averageOrderValue: paidOrders.length ? totalRevenue / paidOrders.length : 0,
        },
        recentOrders: orders.slice(0, 10),
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
      };
    }>('/api/v1/admin/products', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const { title, description, price, stock, images, category, isActive } = req.body;

      const product = await tenantDb.product.create({
        data: {
          title,
          description: description || '',
          price: price as any,
          stock: stock ?? 0,
          images: images || [],
          category: category || 'General',
          is_active: isActive !== undefined ? isActive : true,
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
      };
    }>('/api/v1/admin/products/:id', async (req, reply) => {
      const tenantDb = getTenantDb(req.tenantId);
      const { id } = req.params;
      const { title, description, price, stock, images, category, isActive } = req.body;

      const product = await tenantDb.product.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price: price as any }),
          ...(stock !== undefined && { stock }),
          ...(images !== undefined && { images }),
          ...(category !== undefined && { category }),
          ...(isActive !== undefined && { is_active: isActive }),
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

      const order = await tenantDb.order.update({
        where: { id },
        data: { status: status as any },
      });

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

      return reply.send({
        tenant,
        botConfig: {
          botUsername: botConfig?.bot_username,
          currency: botConfig?.currency,
          themeConfig: botConfig?.theme_config,
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
            currency: 'USD',
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
