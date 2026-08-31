import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@telegram-commerce/database';
import { constructStripeEvent, createSubscriptionCheckoutSession } from '@telegram-commerce/payments';
import { getEnv, PLAN_TIERS } from '@telegram-commerce/config';
import { fulfillOrder } from '../services/orderService.js';
import { invalidateTenantBot } from '../services/botManager.js';

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  // Create SaaS subscription checkout
  fastify.post<{
    Body: {
      telegramUserId: string;
      plan: 'BASIC_20' | 'PRO_30' | 'STANDALONE_LIFETIME';
      successUrl?: string;
      cancelUrl?: string;
      customerEmail?: string;
    };
  }>('/api/v1/billing/checkout', async (req, reply) => {
    const { telegramUserId, plan, successUrl, cancelUrl, customerEmail } = req.body;
    const env = getEnv();

    const result = await createSubscriptionCheckoutSession({
      telegramUserId,
      plan: plan || PLAN_TIERS.PRO_30,
      successUrl: successUrl || `${env.PUBLIC_LANDING_URL}/billing/success`,
      cancelUrl: cancelUrl || `${env.PUBLIC_LANDING_URL}/billing/cancel`,
      customerEmail,
    });

    return reply.send(result);
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
