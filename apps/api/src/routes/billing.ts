import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@telegram-commerce/database';
import { constructStripeEvent } from '@telegram-commerce/payments';
import { getEnv, PLAN_TIERS, PLAN_PRICING, PLATFORM_PAYNET_QR_URL, type PlanTier } from '@telegram-commerce/config';
import { fulfillOrder } from '../services/orderService.js';
import { invalidateTenantBot } from '../services/botManager.js';

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  // Create SaaS subscription checkout (Paynet QR-Online primary)
  fastify.post<{
    Body: {
      telegramUserId?: string;
      plan?: 'BASIC_20' | 'PRO_30' | 'STANDALONE_LIFETIME';
      successUrl?: string;
      cancelUrl?: string;
      customerEmail?: string;
    };
  }>('/api/v1/billing/checkout', async (req, reply) => {
    const { plan } = req.body || {};

    if (plan && !(plan in PLAN_PRICING)) {
      return reply.status(400).send({ error: 'Invalid plan selected' });
    }

    const resolvedPlan: PlanTier = (plan && plan in PLAN_PRICING ? plan : PLAN_TIERS.PRO_30) as PlanTier;
    const planInfo = PLAN_PRICING[resolvedPlan];
    const sessionId = `paynet_bill_${resolvedPlan}_${Date.now()}`;

    return reply.send({
      sessionId,
      paymentUrl: PLATFORM_PAYNET_QR_URL,
      paynetQrUrl: PLATFORM_PAYNET_QR_URL,
      provider: 'paynet',
      plan: resolvedPlan,
      priceUsd: planInfo.price,
      priceUzs: planInfo.priceUzs,
    });
  });

  // Confirm Paynet QR-Online subscription payment & notify platform owner
  fastify.post<{
    Body: {
      tenantId?: string;
      telegramUserId?: string;
      plan: 'BASIC_20' | 'PRO_30' | 'STANDALONE_LIFETIME';
      customerEmail?: string;
      storeName?: string;
    };
  }>('/api/v1/billing/confirm-paynet', async (req, reply) => {
    const { tenantId, telegramUserId, plan, customerEmail, storeName } = req.body || ({} as any);

    if (!plan || !(plan in PLAN_PRICING)) {
      return reply.status(400).send({ error: 'Valid plan is required' });
    }

    const resolvedPlan = plan as PlanTier;
    const planInfo = PLAN_PRICING[resolvedPlan];
    const env = getEnv();

    const periodEnd = new Date();
    if (resolvedPlan === PLAN_TIERS.STANDALONE_LIFETIME) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 100);
    } else {
      periodEnd.setDate(periodEnd.getDate() + 30);
    }

    let tenant = tenantId
      ? await prisma.tenant.findUnique({ where: { id: tenantId } })
      : null;

    if (!tenant && telegramUserId && String(telegramUserId).trim()) {
      tenant = await prisma.tenant.findFirst({
        where: { owner_telegram_id: String(telegramUserId).trim() },
      });
    }

    if (tenant) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          plan: resolvedPlan as any,
          is_active: true,
        },
      });

      const existingSub = await prisma.subscription.findFirst({
        where: { tenant_id: tenant.id },
        orderBy: { createdAt: 'desc' },
      });

      if (existingSub) {
        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            status: 'ACTIVE',
            current_period_end: periodEnd,
            cancel_at_period_end: false,
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            tenant_id: tenant.id,
            status: 'ACTIVE',
            current_period_end: periodEnd,
          },
        });
      }

      await invalidateTenantBot(tenant.id);
    }

    // Notify platform owner via Master Bot Telegram API
    const adminTelegramId = env.STANDALONE_ADMIN_TELEGRAM_ID || '8240936731';
    const masterBotToken = env.MASTER_BOT_TOKEN;

    if (masterBotToken && !masterBotToken.includes('placeholder') && adminTelegramId) {
      const displayStore = escapeHtml(tenant?.name || storeName || 'Новый клиент');
      const displayTg = escapeHtml(String(telegramUserId || tenant?.owner_telegram_id || 'не указан'));
      const displayEmail = customerEmail ? `\n📧 <b>Email:</b> ${escapeHtml(customerEmail)}` : '';
      const displayTenantId = tenant ? `\n🆔 <b>Tenant ID:</b> <code>${tenant.id}</code>` : '';

      const message = `
💳 <b>ОПЛАТА ТАРИФА ЧЕРЕЗ PAYNET QR</b>

📦 <b>Тариф:</b> ${escapeHtml(planInfo.name)} (<code>${resolvedPlan}</code>)
💰 <b>Сумма:</b> $${planInfo.price} · ${planInfo.priceUzs.toLocaleString('ru-RU')} сум
🏪 <b>Магазин:</b> ${displayStore}${displayTenantId}
📱 <b>Telegram ID:</b> <code>${displayTg}</code>${displayEmail}
✅ <b>Статус подписки:</b> ACTIVE
`.trim();

      let replyMarkup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | undefined;
      if (tenant) {
        const compactId = tenant.id.replace(/-/g, '');
        const shortPlan = resolvedPlan === PLAN_TIERS.STANDALONE_LIFETIME ? 'STANDALONE' : resolvedPlan;
        replyMarkup = {
          inline_keyboard: [
            [{ text: '✅ Подтвердить тариф', callback_data: `admin:sub:approve:${compactId}:${shortPlan}` }],
            [{ text: '⛔ Приостановить магазин', callback_data: `admin:sub:suspend:${compactId}` }],
          ],
        };
      }

      try {
        await fetch(`https://api.telegram.org/bot${masterBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminTelegramId,
            text: message,
            parse_mode: 'HTML',
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          }),
        });
      } catch (err) {
        req.log.warn({ err }, 'Failed to send Paynet billing confirmation alert to platform owner');
      }
    }

    return reply.send({
      success: true,
      plan: resolvedPlan,
      subscriptionStatus: 'ACTIVE',
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
            // Fulfill merchant shop order
            await fulfillOrder(metadata.orderId, session.payment_intent || session.id);
          } else if (metadata.type === 'saas_subscription') {
            // SaaS Subscription creation
            const telegramUserId = metadata.telegramUserId;
            const plan = metadata.plan;

            // Find tenant owned by this Telegram ID or create draft
            let tenant = await prisma.tenant.findFirst({
              where: { owner_telegram_id: String(telegramUserId) },
            });

            if (tenant) {
              await prisma.tenant.update({
                where: { id: tenant.id },
                data: {
                  plan: plan as any,
                  is_active: true,
                },
              });

              if (session.subscription) {
                await prisma.subscription.upsert({
                  where: { stripe_subscription_id: String(session.subscription) },
                  create: {
                    tenant_id: tenant.id,
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
              data: { is_active: false },
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
