import Stripe from 'stripe';
import { getEnv, PLAN_PRICING, PLAN_TIERS } from '@telegram-commerce/config';
import { PaymentSessionOptions, PaymentSessionResult, SubscriptionCheckoutOptions } from './types.js';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const env = getEnv();
    const apiKey = env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_for_dev_mode';
    stripeClient = new Stripe(apiKey, {
      apiVersion: '2024-12-18.acacia' as any,
    });
  }
  return stripeClient;
}

/**
 * Creates a Stripe Checkout session for a SaaS Subscription (Basic, Pro, or Lifetime Standalone).
 */
export async function createSubscriptionCheckoutSession(
  options: SubscriptionCheckoutOptions
): Promise<PaymentSessionResult> {
  const env = getEnv();
  const stripe = getStripeClient();

  const planInfo = PLAN_PRICING[options.plan];
  const isOneTime = options.plan === PLAN_TIERS.STANDALONE_LIFETIME;

  let priceId: string | undefined;
  if (options.plan === PLAN_TIERS.BASIC_20) priceId = env.STRIPE_BASIC_PLAN_PRICE_ID;
  else if (options.plan === PLAN_TIERS.PRO_30) priceId = env.STRIPE_PRO_PLAN_PRICE_ID;
  else if (options.plan === PLAN_TIERS.STANDALONE_LIFETIME) priceId = env.STRIPE_STANDALONE_PRICE_ID;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Telegram Commerce - ${planInfo.name}`,
              description: `Automated Telegram E-Commerce Engine (${options.plan})`,
            },
            unit_amount: planInfo.price * 100, // Cents
            ...(isOneTime ? {} : { recurring: { interval: 'month' } }),
          },
          quantity: 1,
        },
      ];

  const session = await stripe.checkout.sessions.create({
    mode: isOneTime ? 'payment' : 'subscription',
    payment_method_types: ['card'],
    line_items: lineItems,
    customer_email: options.customerEmail,
    success_url: `${options.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: options.cancelUrl,
    metadata: {
      telegramUserId: options.telegramUserId,
      plan: options.plan,
      type: 'saas_subscription',
    },
    subscription_data: isOneTime
      ? undefined
      : {
          metadata: {
            telegramUserId: options.telegramUserId,
            plan: options.plan,
          },
        },
  });

  return {
    sessionId: session.id,
    paymentUrl: session.url || '',
    provider: 'stripe',
  };
}

/**
 * Creates a Stripe Checkout session for a merchant customer order.
 */
export async function createOrderCheckoutSession(
  options: PaymentSessionOptions
): Promise<PaymentSessionResult> {
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: options.currency.toLowerCase(),
          product_data: {
            name: `Order #${options.orderId.slice(0, 8)}`,
          },
          unit_amount: Math.round(options.amount * 100),
        },
        quantity: 1,
      },
    ],
    customer_email: options.customerEmail,
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: {
      orderId: options.orderId,
      tenantId: options.tenantId,
      customerTelegramId: options.customerTelegramId || '',
      type: 'shop_order',
      ...options.metadata,
    },
  });

  return {
    sessionId: session.id,
    paymentUrl: session.url || '',
    provider: 'stripe',
  };
}

/**
 * Constructs and verifies Stripe webhook events.
 */
export function constructStripeEvent(
  payload: string | Buffer,
  signature: string,
  secret?: string
): Stripe.Event {
  const env = getEnv();
  const webhookSecret = secret || env.STRIPE_WEBHOOK_SECRET || '';
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
