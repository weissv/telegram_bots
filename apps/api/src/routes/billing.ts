import crypto from 'node:crypto';
import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma, SubscriptionStatus } from '@telegram-commerce/database';
import { constructStripeEvent } from '@telegram-commerce/payments';
import {
  getEnv,
  PLAN_TIERS,
  PLAN_PRICING,
  SELF_SERVE_PLANS,
  PLATFORM_PAYNET_QR_URL,
  DEFAULT_THEME_CONFIG,
  encryptBotToken,
  generateWebhookSecret,
  createBindToken,
  type PlanTier,
  type SelfServePlanTier,
} from '@telegram-commerce/config';
import { fulfillOrder } from '../services/orderService.js';
import { invalidateTenantBot } from '../services/botManager.js';

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isSelfServePlan(plan: unknown): plan is SelfServePlanTier {
  return typeof plan === 'string' && (SELF_SERVE_PLANS as readonly string[]).includes(plan);
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const rand = crypto.randomInt(1000, 9999);
  return `INV-${y}${m}${d}-${rand}`;
}

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  // Unified SaaS subscription checkout: creates/reuses merchant account + Subscription invoice + bind deep link
  fastify.post<{
    Body: {
      plan?: string;
      email?: string;
      password?: string;
      storeName?: string;
      phone?: string;
      telegramUserId?: string;
      customerEmail?: string;
    };
  }>('/api/v1/billing/checkout', async (req, reply) => {
    const body = req.body || ({} as any);
    const requestedPlan = body.plan ?? PLAN_TIERS.PRO_30;

    if (requestedPlan === PLAN_TIERS.STANDALONE_LIFETIME) {
      return reply.status(400).send({
        error: 'Standalone VPS Lifetime не оформляется автоматически. Запросите внедрение у менеджера @miraiedu_bot.',
      });
    }

    if (!isSelfServePlan(requestedPlan)) {
      return reply.status(400).send({ error: 'Invalid plan selected' });
    }

    const resolvedPlan: SelfServePlanTier = requestedPlan;
    const planInfo = PLAN_PRICING[resolvedPlan];
    const env = getEnv();

    let tenant: any = null;
    let adminUser: any = null;

    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const payload = await req.jwtVerify<{ userId: string; tenantId: string; email: string; role: string }>();
        tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId } });
        adminUser = await prisma.adminUser.findFirst({
          where: { id: payload.userId, tenant_id: payload.tenantId },
        });
        if (!tenant || !adminUser) {
          return reply.status(404).send({ error: 'Merchant account not found' });
        }
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired authorization token' });
      }
    } else {
      const rawEmail = body.email || body.customerEmail;
      const rawPassword = body.password;
      if (!rawEmail || !rawPassword) {
        return reply.status(400).send({ error: 'Email and password are required to create checkout invoice' });
      }

      const normalizedEmail = String(rawEmail).trim().toLowerCase();
      const existingUser = await prisma.adminUser.findFirst({
        where: { email: normalizedEmail },
        include: { tenant: true },
      });

      if (existingUser) {
        const passwordMatches = await bcrypt.compare(String(rawPassword), existingUser.password_hash);
        if (!passwordMatches) {
          return reply.status(409).send({
            error: 'Этот email уже зарегистрирован. Войдите в аккаунт или укажите верный пароль.',
            code: 'EMAIL_EXISTS',
          });
        }
        adminUser = existingUser;
        tenant = existingUser.tenant;
      } else {
        const resolvedStoreName =
          (typeof body.storeName === 'string' ? body.storeName.trim() : '') ||
          normalizedEmail.split('@')[0] ||
          'Мой магазин';
        const passwordHash = await bcrypt.hash(String(rawPassword), 10);
        const webhookSecret = generateWebhookSecret();
        const encryptedPlaceholder = encryptBotToken('PLACEHOLDER_TOKEN_TO_UPDATE');

        const createdTenant = await prisma.tenant.create({
          data: {
            name: resolvedStoreName,
            owner_telegram_id: body.telegramUserId ? String(body.telegramUserId).trim() : '',
            plan: resolvedPlan as any,
            subscription_status: SubscriptionStatus.PENDING_PAYMENT as any,
            is_active: true,
            botConfig: {
              create: {
                bot_token_encrypted: encryptedPlaceholder,
                webhook_secret: webhookSecret,
                is_active: false,
                currency: 'UZS',
                theme_config: {
                  ...DEFAULT_THEME_CONFIG,
                  storeName: resolvedStoreName,
                  description: `Официальный Telegram-магазин ${resolvedStoreName}`,
                  ...(body.phone ? { supportContact: String(body.phone).trim() } : {}),
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
          include: { adminUsers: true },
        });

        tenant = createdTenant;
        adminUser = createdTenant.adminUsers[0];
      }
    }

    const invoiceNumber = generateInvoiceNumber();
    const subscription = await prisma.subscription.create({
      data: {
        tenant_id: tenant.id,
        plan: resolvedPlan as any,
        invoice_number: invoiceNumber,
        amount_uzs: planInfo.priceUzs,
        status: SubscriptionStatus.PENDING_PAYMENT as any,
      },
    });

    const token = fastify.jwt.sign({
      userId: adminUser.id,
      tenantId: tenant.id,
      email: adminUser.email,
      role: adminUser.role,
    });

    const bindToken = createBindToken(tenant.id, env.JWT_SECRET);
    const botUsername = env.MASTER_BOT_USERNAME || 'miraiedu_bot';
    const botDeepLink = `https://t.me/${botUsername}?start=${bindToken}`;

    return reply.send({
      token,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        subscriptionStatus: tenant.subscription_status,
      },
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        invoiceNumber: subscription.invoice_number,
        invoice_number: subscription.invoice_number,
        amountUzs: subscription.amount_uzs,
        amount_uzs: subscription.amount_uzs,
        status: subscription.status,
      },
      subscriptionId: subscription.id,
      invoiceNumber: subscription.invoice_number,
      bindToken,
      botDeepLink,
      sessionId: invoiceNumber,
      paymentUrl: PLATFORM_PAYNET_QR_URL,
      paynetQrUrl: PLATFORM_PAYNET_QR_URL,
      provider: 'paynet',
      plan: resolvedPlan,
      priceUsd: planInfo.price,
      priceUzs: planInfo.priceUzs,
    });
  });

  // Confirm Paynet QR-Online subscription payment: transitions to PENDING_REVIEW (NEVER ACTIVE) & alerts superadmin
  fastify.post<{
    Body: {
      subscriptionId?: string;
      invoiceNumber?: string;
      tenantId?: string;
      telegramUserId?: string;
      customerEmail?: string;
      plan?: string;
      paymentReference?: string;
      storeName?: string;
    };
  }>('/api/v1/billing/confirm-paynet', async (req, reply) => {
    const {
      subscriptionId,
      invoiceNumber,
      tenantId,
      telegramUserId,
      customerEmail,
      plan,
      paymentReference,
      storeName,
    } = req.body || ({} as any);

    if (plan === PLAN_TIERS.STANDALONE_LIFETIME) {
      return reply.status(400).send({
        error: 'Standalone VPS Lifetime не оформляется автоматически. Обратитесь к менеджеру @miraiedu_bot.',
      });
    }

    if (plan !== undefined && !isSelfServePlan(plan)) {
      return reply.status(400).send({ error: 'Valid self-serve plan (BASIC_20 or PRO_30) is required' });
    }

    let authTenantId: string | undefined;
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const payload = await req.jwtVerify<{ tenantId: string }>();
        authTenantId = payload.tenantId;
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired authorization token' });
      }
    }

    let subscription: any = null;
    let tenant: any = null;

    if (subscriptionId) {
      subscription = await prisma.subscription.findUnique({
        where: { id: String(subscriptionId) },
        include: { tenant: true },
      });
      if (subscription && authTenantId && subscription.tenant_id !== authTenantId) {
        return reply.status(403).send({ error: 'Forbidden: cross-tenant subscription access' });
      }
      tenant = subscription?.tenant || null;
    } else if (invoiceNumber) {
      subscription = await prisma.subscription.findUnique({
        where: { invoice_number: String(invoiceNumber).trim() },
        include: { tenant: true },
      });
      if (subscription && authTenantId && subscription.tenant_id !== authTenantId) {
        return reply.status(403).send({ error: 'Forbidden: cross-tenant subscription access' });
      }
      tenant = subscription?.tenant || null;
    } else {
      const targetTenantId = authTenantId || (tenantId ? String(tenantId).trim() : undefined);
      if (targetTenantId) {
        tenant = await prisma.tenant.findUnique({ where: { id: targetTenantId } });
      }
      if (!tenant && telegramUserId && String(telegramUserId).trim()) {
        tenant = await prisma.tenant.findFirst({
          where: { owner_telegram_id: String(telegramUserId).trim() },
          orderBy: { createdAt: 'desc' },
        });
      }
      if (!tenant && customerEmail && String(customerEmail).trim()) {
        const admin = await prisma.adminUser.findFirst({
          where: { email: String(customerEmail).trim().toLowerCase() },
          include: { tenant: true },
        });
        tenant = admin?.tenant || null;
      }

      if (tenant) {
        subscription = await prisma.subscription.findFirst({
          where: { tenant_id: tenant.id },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    if (!tenant || !subscription) {
      return reply.status(404).send({
        error: 'Invoice / subscription not found. Please initiate /api/v1/billing/checkout first.',
      });
    }

    const resolvedPlan: SelfServePlanTier = isSelfServePlan(plan)
      ? plan
      : isSelfServePlan(subscription.plan)
        ? subscription.plan
        : PLAN_TIERS.PRO_30;
    const planInfo = PLAN_PRICING[resolvedPlan];
    const env = getEnv();

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return reply.send({
        success: true,
        alreadyActive: true,
        plan: resolvedPlan,
        invoiceNumber: subscription.invoice_number,
        subscriptionId: subscription.id,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      });
    }

    const trimmedRef = typeof paymentReference === 'string' ? paymentReference.trim() : '';

    const updatedSub = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: resolvedPlan as any,
        amount_uzs: subscription.amount_uzs || planInfo.priceUzs,
        status: SubscriptionStatus.PENDING_REVIEW as any,
        ...(trimmedRef ? { payment_reference: trimmedRef } : {}),
      },
    });

    if (tenant.subscription_status !== SubscriptionStatus.ACTIVE) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          plan: resolvedPlan as any,
          subscription_status: SubscriptionStatus.PENDING_REVIEW as any,
        },
      });
    }

    await invalidateTenantBot(tenant.id);

    // Notify Superadmin via Master Bot Telegram API
    const adminTelegramId =
      env.SUPERADMIN_TELEGRAM_ID || env.STANDALONE_ADMIN_TELEGRAM_ID || '8240936731';
    const masterBotToken = env.MASTER_BOT_TOKEN;

    if (masterBotToken && !masterBotToken.includes('placeholder') && adminTelegramId) {
      const displayStore = escapeHtml(tenant.name || storeName || 'Магазин');
      const displayTg = escapeHtml(String(telegramUserId || tenant.owner_telegram_id || 'не привязан'));
      const displayEmail = customerEmail ? `\n📧 <b>Email:</b> ${escapeHtml(String(customerEmail))}` : '';
      const displayRef = trimmedRef ? `\n🧾 <b>Чек / Ref:</b> <code>${escapeHtml(trimmedRef)}</code>` : '';
      const displayInvoice = updatedSub.invoice_number
        ? `\n📄 <b>Счёт:</b> <code>${escapeHtml(updatedSub.invoice_number)}</code>`
        : '';

      const message = `
💳 <b>ЗАЯВКА НА ПРОВЕРКУ ОПЛАТЫ ТАРИФА (PAYNET)</b>
${displayInvoice}
📦 <b>Тариф:</b> ${escapeHtml(planInfo.name)} (<code>${resolvedPlan}</code>)
💰 <b>Сумма:</b> $${planInfo.price} · ${planInfo.priceUzs.toLocaleString('ru-RU')} сум
🏪 <b>Магазин:</b> ${displayStore} (<code>${tenant.id}</code>)
📱 <b>Telegram ID:</b> <code>${displayTg}</code>${displayEmail}${displayRef}
🔍 <b>Статус:</b> PENDING_REVIEW (ожидает подтверждения)
`.trim();

      const compactId = tenant.id.replace(/-/g, '');
      const replyMarkup = {
        inline_keyboard: [
          [{ text: '✅ Подтвердить и активировать (+30д)', callback_data: `admin:sub:approve:${compactId}:${resolvedPlan}` }],
          [{ text: '⛔ Приостановить магазин', callback_data: `admin:sub:suspend:${compactId}` }],
        ],
      };

      try {
        await fetch(`https://api.telegram.org/bot${masterBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminTelegramId,
            text: message,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          }),
        });
      } catch (err) {
        req.log.warn({ err }, 'Failed to send Paynet billing review alert to superadmin');
      }
    }

    return reply.send({
      success: true,
      plan: resolvedPlan,
      invoiceNumber: updatedSub.invoice_number,
      subscriptionId: updatedSub.id,
      subscriptionStatus: SubscriptionStatus.PENDING_REVIEW,
    });
  });

  // Superadmin / internal helper to approve a subscription and extend period additively by +30 days
  fastify.post<{
    Body: {
      subscriptionId?: string;
      invoiceNumber?: string;
      tenantId?: string;
      plan?: PlanTier;
      reviewedBy?: string;
    };
  }>('/api/v1/billing/approve', async (req, reply) => {
    const env = getEnv();
    const expectedSecret = process.env.SUPERADMIN_API_SECRET || env.JWT_SECRET;
    const providedSecret =
      (req.headers['x-superadmin-secret'] as string) ||
      (req.headers['x-internal-secret'] as string) ||
      '';

    let authorized = Boolean(expectedSecret && providedSecret && providedSecret === expectedSecret);
    if (!authorized && typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const payload = await req.jwtVerify<{ role?: string; isSuperAdmin?: boolean }>();
        if (payload.role === 'SUPERADMIN' || payload.isSuperAdmin === true) {
          authorized = true;
        }
      } catch {
        authorized = false;
      }
    }

    if (!authorized) {
      return reply.status(403).send({ error: 'Forbidden: superadmin authorization required' });
    }

    const { subscriptionId, invoiceNumber, tenantId, plan, reviewedBy } = req.body || ({} as any);

    let subscription: any = null;
    if (subscriptionId) {
      subscription = await prisma.subscription.findUnique({ where: { id: String(subscriptionId) } });
    } else if (invoiceNumber) {
      subscription = await prisma.subscription.findUnique({
        where: { invoice_number: String(invoiceNumber).trim() },
      });
    } else if (tenantId) {
      subscription = await prisma.subscription.findFirst({
        where: { tenant_id: String(tenantId) },
        orderBy: { createdAt: 'desc' },
      });
    }

    const targetTenantId = subscription?.tenant_id || tenantId;
    if (!targetTenantId) {
      return reply.status(400).send({ error: 'subscriptionId, invoiceNumber, or tenantId is required' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: String(targetTenantId) } });
    if (!tenant) {
      return reply.status(404).send({ error: 'Tenant not found' });
    }

    const resolvedPlan: PlanTier =
      plan && plan in PLAN_PRICING
        ? plan
        : subscription?.plan && subscription.plan in PLAN_PRICING
          ? subscription.plan
          : (tenant.plan as PlanTier);

    // Find current active period end to compute additive +30 days
    const activeSubs = await prisma.subscription.findMany({
      where: {
        tenant_id: tenant.id,
        status: SubscriptionStatus.ACTIVE as any,
        current_period_end: { not: null },
      },
      orderBy: { current_period_end: 'desc' },
      take: 1,
    });
    const latestActiveEnd = activeSubs[0]?.current_period_end?.getTime() || 0;
    const currentSubEnd = subscription?.current_period_end?.getTime() || 0;
    const baseTimeMs = Math.max(Date.now(), latestActiveEnd, currentSubEnd);

    const newPeriodEnd =
      resolvedPlan === PLAN_TIERS.STANDALONE_LIFETIME
        ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)
        : new Date(baseTimeMs + 30 * 24 * 60 * 60 * 1000);

    const reviewer = (typeof reviewedBy === 'string' && reviewedBy.trim()) || 'superadmin';
    const reviewedAt = new Date();

    const updatedSub = subscription
      ? await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            plan: resolvedPlan as any,
            status: SubscriptionStatus.ACTIVE as any,
            current_period_end: newPeriodEnd,
            cancel_at_period_end: false,
            reviewed_by: reviewer,
            reviewed_at: reviewedAt,
          },
        })
      : await prisma.subscription.create({
          data: {
            tenant_id: tenant.id,
            plan: resolvedPlan as any,
            invoice_number: generateInvoiceNumber(),
            amount_uzs: PLAN_PRICING[resolvedPlan].priceUzs,
            status: SubscriptionStatus.ACTIVE as any,
            current_period_end: newPeriodEnd,
            reviewed_by: reviewer,
            reviewed_at: reviewedAt,
          },
        });

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        plan: resolvedPlan as any,
        subscription_status: SubscriptionStatus.ACTIVE as any,
        is_active: true,
      },
    });

    await invalidateTenantBot(tenant.id);

    return reply.send({
      success: true,
      tenant: updatedTenant,
      subscription: updatedSub,
    });
  });

  // Stripe Webhook handler with raw body support & idempotency
  fastify.post('/api/v1/billing/webhook', {
    config: {
      rawBody: true,
    },
  }, async (req, reply) => {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = (req as any).rawBody || req.body;

    let event: any;
    try {
      if (signature) {
        event = constructStripeEvent(rawBody, signature);
      } else {
        event = req.body;
      }
    } catch (err: any) {
      req.log.error(err, 'Stripe webhook signature verification failed');
      return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
    }

    // Process event idempotently
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const metadata = session.metadata || {};

          if (metadata.type === 'shop_order' && metadata.orderId) {
            await fulfillOrder(metadata.orderId, session.payment_intent || session.id);
          } else if (metadata.type === 'saas_subscription') {
            const telegramUserId = metadata.telegramUserId;
            const plan = metadata.plan;

            const tenant = await prisma.tenant.findFirst({
              where: { owner_telegram_id: String(telegramUserId) },
            });

            if (tenant) {
              await prisma.tenant.update({
                where: { id: tenant.id },
                data: {
                  plan: plan as any,
                  subscription_status: SubscriptionStatus.ACTIVE as any,
                  is_active: true,
                },
              });

              if (session.subscription) {
                await prisma.subscription.upsert({
                  where: { stripe_subscription_id: String(session.subscription) },
                  create: {
                    tenant_id: tenant.id,
                    plan: (plan as any) || PLAN_TIERS.PRO_30,
                    stripe_customer_id: String(session.customer),
                    stripe_subscription_id: String(session.subscription),
                    status: 'ACTIVE',
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  },
                  update: {
                    status: 'ACTIVE',
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  },
                });
              }

              await invalidateTenantBot(tenant.id);
            }
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          if (invoice.subscription) {
            await prisma.subscription.updateMany({
              where: { stripe_subscription_id: String(invoice.subscription) },
              data: {
                status: 'ACTIVE',
                current_period_end: new Date((invoice.lines?.data?.[0]?.period?.end || 0) * 1000),
              },
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const subRecord = await prisma.subscription.findFirst({
            where: { stripe_subscription_id: String(subscription.id) },
          });

          if (subRecord) {
            await prisma.subscription.update({
              where: { id: subRecord.id },
              data: { status: 'CANCELED' },
            });
            await prisma.tenant.update({
              where: { id: subRecord.tenant_id },
              data: {
                is_active: false,
                subscription_status: SubscriptionStatus.CANCELED as any,
              },
            });
            await invalidateTenantBot(subRecord.tenant_id);
          }
          break;
        }
      }

      return reply.send({ received: true });
    } catch (err: any) {
      req.log.error(err, 'Error processing billing webhook event');
      return reply.status(500).send({ error: err.message });
    }
  });
};
