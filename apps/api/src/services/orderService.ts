import crypto from 'node:crypto';
import { prisma } from '@telegram-commerce/database';
import { createOrderCheckoutSession, createMockPaymentSession, PaymentSessionResult } from '@telegram-commerce/payments';
import {
  getEnv,
  ORDER_STATUS,
  PAYMENT_METHODS,
  DEFAULT_THEME_CONFIG,
  isValidPaynetQrUrl,
} from '@telegram-commerce/config';
import { t } from '@telegram-commerce/i18n';
import { sendMerchantOrderAlert, sendCustomerOrderReceipt } from '@telegram-commerce/telegram-engine';
import { getOrInitBot, getTenantBotData } from './botManager.js';
import { enqueueReservationExpiry, cancelReservationExpiry } from './reservationWorker.js';

export interface CheckoutOrderItem {
  productId: string;
  quantity: number;
  variant?: string;
}

export interface CheckoutParams {
  tenantId: string;
  customerTelegramId: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: string;
  deliveryMethod?: 'COURIER' | 'PICKUP' | string;
  items: CheckoutOrderItem[];
  paymentMethod?: 'STRIPE' | 'MOCK' | 'TELEGRAM_STARS' | 'PAYNET_XOLIS';
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResult {
  orderId: string;
  accessToken: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  deliveryMethod: string;
  totalAmount: number;
  currency: string;
  payment: PaymentSessionResult;
  paynetQrUrl?: string;
  provider?: PaymentSessionResult['provider'];
}

/**
 * Executes a concurrency-safe atomic checkout with strict storefront readiness,
 * merchant Paynet QR validation (no platform fallback), delivery fee calculation,
 * and race-condition stock guard.
 */
export async function createCheckoutOrder(params: CheckoutParams): Promise<CheckoutResult> {
  const {
    tenantId,
    customerTelegramId,
    customerName,
    customerPhone,
    shippingAddress,
    items,
    paymentMethod,
  } = params;

  if (!items || items.length === 0) {
    throw new Error('Cannot checkout with an empty cart');
  }

  // 1. Fetch tenant bot data and validate storefront status & Paynet configuration
  const tenantData = await getTenantBotData(tenantId);
  if (!tenantData) {
    throw new Error('STORE_NOT_FOUND: Storefront not found');
  }

  const env = getEnv();
  const themeConfig = ((tenantData.tenant.themeConfig as Record<string, any>) || {});
  const isDemo = Boolean(
    themeConfig.isDemo || (env.MODE !== 'standalone' && tenantId === env.STANDALONE_TENANT_ID)
  );
  if (isDemo) {
    throw new Error('DEMO_CHECKOUT_DISABLED: Демо-витрина: приём реальных заказов и оплат отключён');
  }

  const subscriptionAllowed =
    tenantData.subscriptionStatus === 'ACTIVE' || tenantData.subscriptionStatus === 'TRIALING';
  if (!tenantData.tenantActive || !subscriptionAllowed) {
    throw new Error('STORE_SUSPENDED: Магазин временно приостановлен или ожидает активации подписки');
  }

  if (!tenantData.botActive) {
    throw new Error('STORE_NOT_PUBLISHED: Магазин ещё не опубликован продавцом');
  }

  const merchantPaynetQr = typeof themeConfig.paynetQrUrl === 'string' ? themeConfig.paynetQrUrl.trim() : '';
  if (!themeConfig.paynetEnabled || !isValidPaynetQrUrl(merchantPaynetQr)) {
    throw new Error('PAYNET_NOT_CONFIGURED: Онлайн-оплата Paynet не настроена продавцом');
  }

  const trimmedPhone = typeof customerPhone === 'string' ? customerPhone.trim() : '';
  if (!trimmedPhone || trimmedPhone.replace(/\D/g, '').length < 7) {
    throw new Error('PHONE_REQUIRED: Укажите корректный контактный номер телефона');
  }

  const deliveryMethod = params.deliveryMethod === 'PICKUP' ? 'PICKUP' : 'COURIER';
  const trimmedAddress = typeof shippingAddress === 'string' ? shippingAddress.trim() : '';
  if (deliveryMethod !== 'PICKUP' && !trimmedAddress) {
    throw new Error('ADDRESS_REQUIRED: Укажите адрес доставки');
  }

  const currency = tenantData.tenant.currency || 'UZS';
  const hasStripeKey = Boolean(env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.includes('placeholder'));
  const resolvedPaymentMethod =
    !paymentMethod || (paymentMethod === PAYMENT_METHODS.STRIPE && !hasStripeKey)
      ? PAYMENT_METHODS.PAYNET_XOLIS
      : paymentMethod;

  const rawFee =
    themeConfig.deliveryFeeUzs !== undefined && themeConfig.deliveryFeeUzs !== null
      ? Number(themeConfig.deliveryFeeUzs)
      : DEFAULT_THEME_CONFIG.deliveryFeeUzs;
  const feeUzs = Number.isFinite(rawFee) && rawFee > 0 ? rawFee : 0;

  const rawThreshold =
    themeConfig.freeDeliveryThresholdUzs !== undefined && themeConfig.freeDeliveryThresholdUzs !== null
      ? Number(themeConfig.freeDeliveryThresholdUzs)
      : DEFAULT_THEME_CONFIG.freeDeliveryThresholdUzs;
  const thresholdUzs = Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 0;

  const accessToken = crypto.randomBytes(24).toString('hex');
  const nowIso = new Date().toISOString();

  // 2. Interactive transaction with atomic stock decrement
  const order = await prisma.$transaction(async (tx) => {
    const fullItemsDetails: Array<{
      productId: string;
      title: string;
      price: number;
      quantity: number;
      variant?: string;
      image?: string;
    }> = [];

    let subtotal = 0;

    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        throw new Error('Invalid item quantity');
      }

      const product = await tx.product.findFirst({
        where: { id: item.productId, tenant_id: tenantId, is_active: true },
      });

      if (!product) {
        throw new Error(`Product ${item.productId} not found or unavailable`);
      }

      const productVariants = Array.isArray((product as any).variants)
        ? ((product as any).variants as any[]).map((v) => String(v))
        : [];
      const selectedVariant = typeof item.variant === 'string' ? item.variant.trim() : '';
      if (selectedVariant && productVariants.length > 0 && !productVariants.includes(selectedVariant)) {
        throw new Error(`Invalid variant "${selectedVariant}" for product "${product.title}"`);
      }

      // Atomic conditional update to guard against race conditions
      const affectedRows = await tx.$executeRaw`
        UPDATE "Product"
        SET "stock" = "stock" - ${item.quantity}
        WHERE "id" = ${item.productId}
          AND "tenant_id" = ${tenantId}
          AND "stock" >= ${item.quantity}
          AND "is_active" = true
      `;

      if (affectedRows !== 1) {
        throw new Error(`Insufficient stock for "${product.title}". Only ${product.stock} left.`);
      }

      const unitPrice = Number(product.price);
      subtotal += unitPrice * item.quantity;

      fullItemsDetails.push({
        productId: product.id,
        title: product.title,
        price: unitPrice,
        quantity: item.quantity,
        ...(selectedVariant ? { variant: selectedVariant } : {}),
        image: product.images?.[0],
      });
    }

    const deliveryFee =
      deliveryMethod === 'PICKUP' || feeUzs === 0 || (thresholdUzs > 0 && subtotal >= thresholdUzs)
        ? 0
        : feeUzs;
    const totalAmount = subtotal + deliveryFee;
    const initialHistory = [{ status: ORDER_STATUS.PENDING, at: nowIso, by: 'customer' }];

    const newOrder = await tx.order.create({
      data: {
        tenant_id: tenantId,
        customer_telegram_id: String(customerTelegramId || 'web_guest'),
        customer_name: customerName?.trim() || 'Telegram Customer',
        customer_phone: trimmedPhone,
        shipping_address: deliveryMethod === 'PICKUP' ? trimmedAddress || 'Самовывоз' : trimmedAddress,
        delivery_method: deliveryMethod,
        delivery_fee: deliveryFee as any,
        total_amount: totalAmount as any,
        status: ORDER_STATUS.PENDING as any,
        payment_method: resolvedPaymentMethod,
        access_token: accessToken,
        status_history: initialHistory as any,
        items: fullItemsDetails as any,
      },
    });

    return {
      id: newOrder.id,
      subtotal,
      deliveryFee,
      totalAmount,
      items: fullItemsDetails,
    };
  });

  // Enqueue 15-minute reservation expiry job
  await enqueueReservationExpiry({
    orderId: order.id,
    tenantId,
    customerTelegramId: String(customerTelegramId || 'web_guest'),
    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  });

  const defaultSuccessUrl = params.successUrl || `${env.PUBLIC_API_URL}/api/v1/shop/orders/${order.id}/success`;
  const defaultCancelUrl = params.cancelUrl || `${env.PUBLIC_API_URL}/api/v1/shop/orders/${order.id}/cancel`;

  let paymentResult: PaymentSessionResult;
  let paynetQrUrl: string | undefined;

  if (
    resolvedPaymentMethod === PAYMENT_METHODS.PAYNET_XOLIS ||
    (paymentMethod === PAYMENT_METHODS.STRIPE && !hasStripeKey)
  ) {
    paynetQrUrl = merchantPaynetQr;
    paymentResult = {
      sessionId: `paynet_${order.id}`,
      paymentUrl: paynetQrUrl,
      provider: 'paynet',
    };
  } else if (resolvedPaymentMethod === PAYMENT_METHODS.STRIPE && hasStripeKey) {
    try {
      paymentResult = await createOrderCheckoutSession({
        orderId: order.id,
        tenantId,
        amount: order.totalAmount,
        currency,
        customerTelegramId: String(customerTelegramId || 'web_guest'),
        successUrl: defaultSuccessUrl,
        cancelUrl: defaultCancelUrl,
      });
    } catch {
      paymentResult = createMockPaymentSession({
        orderId: order.id,
        tenantId,
        amount: order.totalAmount,
        currency,
        customerTelegramId: String(customerTelegramId || 'web_guest'),
        successUrl: defaultSuccessUrl,
        cancelUrl: defaultCancelUrl,
      });
    }
  } else {
    paymentResult = createMockPaymentSession({
      orderId: order.id,
      tenantId,
      amount: order.totalAmount,
      currency,
      customerTelegramId: String(customerTelegramId || 'web_guest'),
      successUrl: defaultSuccessUrl,
      cancelUrl: defaultCancelUrl,
    });
  }

  return {
    orderId: order.id,
    accessToken,
    status: ORDER_STATUS.PENDING,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    deliveryMethod,
    totalAmount: order.totalAmount,
    currency,
    payment: paymentResult,
    paynetQrUrl,
    provider: paymentResult.provider,
  };
}

/**
 * Fulfills a verified Stripe/external payment order and broadcasts Telegram alerts.
 */
export async function fulfillOrder(orderId: string, paymentId?: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { tenant: { include: { botConfig: true } } },
  });

  if (!order || order.status === ORDER_STATUS.PAID || order.status === ORDER_STATUS.DELIVERED) {
    return;
  }

  // Cancel the pending reservation expiry job since order is now paid
  await cancelReservationExpiry(orderId);

  const prevHistory = Array.isArray((order as any).status_history)
    ? ((order as any).status_history as any[])
    : [];
  const nextHistory = [
    ...prevHistory,
    {
      status: ORDER_STATUS.PAID,
      at: new Date().toISOString(),
      by: 'stripe',
      ...(paymentId ? { paymentId } : {}),
    },
  ];

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: ORDER_STATUS.PAID as any,
      payment_id: paymentId,
      verified_at: new Date(),
      verified_by: 'stripe',
      status_history: nextHistory as any,
    },
  });

  // Notify merchant and customer via Telegram bot
  try {
    const botData = await getOrInitBot(order.tenant_id);
    if (botData) {
      const rawItems = Array.isArray(order.items) ? (order.items as any[]) : [];
      const items = rawItems.map((i) => ({
        title: String(i?.title || 'Товар') + (i?.variant ? ` (${i.variant})` : ''),
        quantity: Number(i?.quantity || 1),
        price: Number(i?.price || 0),
      }));
      const currency = order.tenant.botConfig?.currency || 'UZS';

      if (order.tenant.owner_telegram_id) {
        await sendMerchantOrderAlert(botData.bot, order.tenant.owner_telegram_id, {
          orderId: order.id,
          totalAmount: Number(order.total_amount),
          currency,
          customerTelegramId: order.customer_telegram_id,
          customerName: order.customer_name || undefined,
          customerPhone: order.customer_phone || undefined,
          shippingAddress: order.shipping_address || undefined,
          items,
        });
      }

      if (order.customer_telegram_id && /^\d+$/.test(order.customer_telegram_id)) {
        await sendCustomerOrderReceipt(botData.bot, order.customer_telegram_id, {
          orderId: order.id,
          totalAmount: Number(order.total_amount),
          currency,
          items,
        });
      }
    }
  } catch (err) {
    console.error(`Failed to send order alerts for order ${orderId}:`, err);
  }
}

/**
 * Handles customer's "I Paid via Paynet" confirmation.
 * Strictly transitions ONLY PENDING -> PAYMENT_REVIEW (never PAID) and alerts merchant for review.
 */
export async function confirmPaynetPayment(
  orderId: string,
  tenantId?: string,
  options?: { note?: string }
): Promise<{ success: boolean; order: any }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { tenant: { include: { botConfig: true } } },
  });

  if (!order || (tenantId && order.tenant_id !== tenantId)) {
    throw new Error('Order not found');
  }

  if (order.status === ORDER_STATUS.PAYMENT_REVIEW) {
    return { success: true, order };
  }

  if (order.status !== ORDER_STATUS.PENDING) {
    throw new Error(`Order cannot enter payment review from status ${order.status}`);
  }

  // Cancel reservation timer so order is not auto-cancelled while merchant checks receipt
  await cancelReservationExpiry(orderId);

  const prevHistory = Array.isArray((order as any).status_history)
    ? ((order as any).status_history as any[])
    : [];
  const nextHistory = [
    ...prevHistory,
    {
      status: ORDER_STATUS.PAYMENT_REVIEW,
      at: new Date().toISOString(),
      by: 'customer',
      ...(options?.note ? { note: options.note } : {}),
    },
  ];

  // Transition to PAYMENT_REVIEW only; never forge payment_id
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: ORDER_STATUS.PAYMENT_REVIEW as any,
      status_history: nextHistory as any,
    },
  });

  // Notify merchant (and send polite review notice to customer if numeric Telegram ID), catching errors cleanly
  try {
    const botData = await getOrInitBot(order.tenant_id);
    if (botData) {
      const rawItems = Array.isArray(order.items) ? (order.items as any[]) : [];
      const items = rawItems.map((i) => ({
        title: String(i?.title || 'Товар') + (i?.variant ? ` (${i.variant})` : ''),
        quantity: Number(i?.quantity || 1),
        price: Number(i?.price || 0),
      }));
      const currency = order.tenant.botConfig?.currency || 'UZS';

      if (order.tenant.owner_telegram_id) {
        try {
          await sendMerchantOrderAlert(botData.bot, order.tenant.owner_telegram_id, {
            orderId: order.id,
            totalAmount: Number(order.total_amount),
            currency,
            customerTelegramId: order.customer_telegram_id,
            customerName: order.customer_name || undefined,
            customerPhone: order.customer_phone || undefined,
            shippingAddress: order.shipping_address || undefined,
            items,
          });
        } catch (alertErr) {
          console.error(`Failed to send merchant alert for Paynet review order ${orderId}:`, alertErr);
        }
      }

      if (order.customer_telegram_id && /^\d+$/.test(order.customer_telegram_id)) {
        try {
          await botData.bot.api.sendMessage(
            order.customer_telegram_id,
            t('ru', 'orders.notify_payment_review', { orderId: order.id.slice(0, 8) }),
            { parse_mode: 'HTML' }
          );
        } catch (custErr) {
          console.warn(`Failed to send customer review notice for order ${orderId}:`, custErr);
        }
      }
    }
  } catch (err) {
    console.error(`Failed to initialize bot for Paynet order review ${orderId}:`, err);
  }

  return { success: true, order: updatedOrder };
}

/**
 * Allows buyer to cancel their own PENDING order and atomically restores product stock.
 */
export async function cancelBuyerOrder(orderId: string, tenantId: string): Promise<any> {
  const updatedOrder = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
    });

    if (!existing) {
      throw new Error('Order not found');
    }

    if (existing.status !== ORDER_STATUS.PENDING) {
      throw new Error('Only PENDING orders can be cancelled by buyer');
    }

    const prevHistory = Array.isArray((existing as any).status_history)
      ? ((existing as any).status_history as any[])
      : [];
    const nextHistory = [
      ...prevHistory,
      {
        status: ORDER_STATUS.CANCELLED,
        at: new Date().toISOString(),
        by: 'customer',
      },
    ];

    const updateRes = await tx.order.updateMany({
      where: {
        id: orderId,
        tenant_id: tenantId,
        status: ORDER_STATUS.PENDING as any,
      },
      data: {
        status: ORDER_STATUS.CANCELLED as any,
        status_history: nextHistory as any,
      },
    });

    if (updateRes.count !== 1) {
      throw new Error('Order status changed concurrently');
    }

    const items = Array.isArray(existing.items) ? (existing.items as any[]) : [];
    for (const item of items) {
      const productId = item?.productId || item?.id;
      const qty = Number(item?.quantity || 0);
      if (productId && qty > 0) {
        await tx.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" + ${qty}
          WHERE "id" = ${String(productId)}
            AND "tenant_id" = ${tenantId}
        `;
      }
    }

    return tx.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
    });
  });

  await cancelReservationExpiry(orderId);
  return updatedOrder;
}

