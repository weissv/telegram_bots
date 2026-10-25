import { prisma } from '@telegram-commerce/database';
import { createOrderCheckoutSession, createMockPaymentSession, PaymentSessionResult } from '@telegram-commerce/payments';
import { getEnv, ORDER_STATUS, DEFAULT_PAYNET_QR_URL, PAYMENT_METHODS } from '@telegram-commerce/config';
import { sendMerchantOrderAlert, sendCustomerOrderReceipt } from '@telegram-commerce/telegram-engine';
import { getOrInitBot, getTenantBotData } from './botManager.js';
import { enqueueReservationExpiry, cancelReservationExpiry } from './reservationWorker.js';

export interface CheckoutOrderItem {
  productId: string;
  quantity: number;
}

export interface CheckoutParams {
  tenantId: string;
  customerTelegramId: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: string;
  items: CheckoutOrderItem[];
  paymentMethod?: 'STRIPE' | 'MOCK' | 'TELEGRAM_STARS' | 'PAYNET_XOLIS';
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResult {
  orderId: string;
  totalAmount: number;
  currency: string;
  payment: PaymentSessionResult;
  paynetQrUrl?: string;
}

/**
 * Executes a concurrency-safe atomic checkout with race-condition stock guard.
 */
export async function createCheckoutOrder(params: CheckoutParams): Promise<CheckoutResult> {
  const { tenantId, customerTelegramId, customerName, customerPhone, shippingAddress, items, paymentMethod } = params;

  if (!items || items.length === 0) {
    throw new Error('Cannot checkout with an empty cart');
  }

  // 1. Fetch tenant bot data for currency and validation
  const tenantData = await getTenantBotData(tenantId);
  if (!tenantData || !tenantData.isActive) {
    throw new Error('Tenant storefront is not active or unavailable');
  }

  const currency = tenantData.tenant.currency || 'USD';

  // 2. Interactive transaction with atomic stock decrement
  const order = await prisma.$transaction(async (tx) => {
    // Verify and decrement each item atomically
    const fullItemsDetails: Array<{
      productId: string;
      title: string;
      price: number;
      quantity: number;
      image?: string;
    }> = [];

    let totalAmount = 0;

    for (const item of items) {
      if (item.quantity <= 0) {
        throw new Error('Invalid item quantity');
      }

      // Fetch product details
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenant_id: tenantId, is_active: true },
      });

      if (!product) {
        throw new Error(`Product ${item.productId} not found or unavailable`);
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

      const itemTotal = Number(product.price) * item.quantity;
      totalAmount += itemTotal;

      fullItemsDetails.push({
        productId: product.id,
        title: product.title,
        price: Number(product.price),
        quantity: item.quantity,
        image: product.images?.[0],
      });
    }

    // Create order record inside the same transaction
    const newOrder = await tx.order.create({
      data: {
        tenant_id: tenantId,
        customer_telegram_id: String(customerTelegramId),
        customer_name: customerName || 'Telegram Customer',
        customer_phone: customerPhone,
        shipping_address: shippingAddress || 'Digital / Default delivery',
        total_amount: totalAmount as any,
        status: ORDER_STATUS.PENDING as any,
        payment_method: paymentMethod || 'STRIPE',
        items: fullItemsDetails as any,
      },
    });

    return {
      id: newOrder.id,
      totalAmount,
      items: fullItemsDetails,
    };
  });

  // Enqueue 15-minute reservation expiry job
  await enqueueReservationExpiry({
    orderId: order.id,
    tenantId,
    customerTelegramId: String(customerTelegramId),
    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  });

  const env = getEnv();
  const defaultSuccessUrl = params.successUrl || `${env.PUBLIC_API_URL}/api/v1/shop/orders/${order.id}/success`;
  const defaultCancelUrl = params.cancelUrl || `${env.PUBLIC_API_URL}/api/v1/shop/orders/${order.id}/cancel`;

  let paymentResult: PaymentSessionResult;
  let paynetQrUrl: string | undefined;

  if (paymentMethod === 'PAYNET_XOLIS') {
    const rawQr =
      (tenantData.tenant.themeConfig as any)?.paynetQrUrl ||
      DEFAULT_PAYNET_QR_URL;
    paynetQrUrl = String(rawQr);

    paymentResult = {
      sessionId: `paynet_${order.id}`,
      paymentUrl: paynetQrUrl,
      provider: 'paynet',
    };
  } else if (paymentMethod === 'STRIPE' && env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.includes('placeholder')) {
    try {
      paymentResult = await createOrderCheckoutSession({
        orderId: order.id,
        tenantId,
        amount: order.totalAmount,
        currency,
        customerTelegramId: String(customerTelegramId),
        successUrl: defaultSuccessUrl,
        cancelUrl: defaultCancelUrl,
      });
    } catch {
      paymentResult = createMockPaymentSession({
        orderId: order.id,
        tenantId,
        amount: order.totalAmount,
        currency,
        customerTelegramId: String(customerTelegramId),
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
      customerTelegramId: String(customerTelegramId),
      successUrl: defaultSuccessUrl,
      cancelUrl: defaultCancelUrl,
    });
  }

  return {
    orderId: order.id,
    totalAmount: order.totalAmount,
    currency,
    payment: paymentResult,
    paynetQrUrl,
  };
}

/**
 * Fulfills a paid order and broadcasts Telegram alert to the merchant.
 */
export async function fulfillOrder(orderId: string, paymentId?: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { tenant: { include: { botConfig: true } } },
  });

  if (!order || order.status === ORDER_STATUS.PAID) {
    return;
  }

  // Cancel the pending reservation expiry job since order is now paid
  await cancelReservationExpiry(orderId);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: ORDER_STATUS.PAID as any,
      payment_id: paymentId,
    },
  });

  // Notify merchant and customer via Telegram bot
  try {
    const botData = await getOrInitBot(order.tenant_id);
    if (botData) {
      const items = Array.isArray(order.items) ? (order.items as any[]) : [];
      const currency = order.tenant.botConfig?.currency || 'USD';

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

      // Notify customer if customer_telegram_id is a numeric Telegram user ID
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
 * Marks the order as PAID and alerts merchant via Telegram.
 */
export async function confirmPaynetPayment(orderId: string): Promise<{ success: boolean; order: any }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { tenant: { include: { botConfig: true } } },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  // Cancel reservation timer
  await cancelReservationExpiry(orderId);

  // Fulfill order
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: ORDER_STATUS.PAID as any,
      payment_id: `paynet_${Date.now()}`,
    },
  });

  // Notify merchant and customer
  try {
    const botData = await getOrInitBot(order.tenant_id);
    if (botData) {
      const items = Array.isArray(order.items) ? (order.items as any[]) : [];
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
    console.error(`Failed to send order alert for Paynet order ${orderId}:`, err);
  }

  return { success: true, order: updatedOrder };
}

