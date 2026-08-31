import { InlineKeyboard } from 'grammy';
import { BotContext, CartItem } from '../types.js';
import { getCartInlineKeyboard } from '../keyboards/index.js';
import { createOrderCheckoutSession, createMockPaymentSession } from '@telegram-commerce/payments';
import { getEnv, ORDER_STATUS } from '@telegram-commerce/config';

export async function handleAddToCart(ctx: BotContext, productId: string) {
  const { db } = ctx;
  const product = await db.product.findFirst({
    where: { id: productId, is_active: true },
  });

  if (!product) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: 'Product not found or unavailable.', show_alert: true });
    }
    return;
  }

  if (product.stock <= 0) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: 'Sorry, this product is currently out of stock!', show_alert: true });
    }
    return;
  }

  if (!ctx.session.cart) {
    ctx.session.cart = [];
  }

  const existing = ctx.session.cart.find((item: CartItem) => item.productId === productId);
  if (existing) {
    if (existing.quantity >= product.stock) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: `Cannot add more. Only ${product.stock} available.`, show_alert: true });
      }
      return;
    }
    existing.quantity += 1;
  } else {
    ctx.session.cart.push({
      productId: product.id,
      title: product.title,
      price: Number(product.price),
      quantity: 1,
    });
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: `Added "${product.title}" to cart! 🛒`,
    });
  }
}

export async function handleViewCart(ctx: BotContext) {
  const { tenant } = ctx;
  const cart: CartItem[] = ctx.session.cart || [];
  const currency = tenant.currency || 'USD';

  if (cart.length === 0) {
    const text = '🛒 <b>Your cart is currently empty!</b>\n\nBrowse our catalog to add items.';
    const keyboard = new InlineKeyboard().text('📦 Browse Catalog', 'catalog:browse');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard }).catch(async () => {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      });
      await ctx.answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return;
  }

  const total = cart.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);

  const itemsList = cart
    .map(
      (item: CartItem, idx: number) =>
        `${idx + 1}. <b>${escapeHtml(item.title)}</b>\n   ${item.quantity} × ${item.price.toFixed(2)} = <code>${(item.quantity * item.price).toFixed(2)} ${currency}</code>`
    )
    .join('\n\n');

  const text = `
🛒 <b>YOUR SHOPPING CART</b>

${itemsList}

━━━━━━━━━━━━━━━━━━━
💰 <b>Total:</b> <b>${total.toFixed(2)} ${currency}</b>
━━━━━━━━━━━━━━━━━━━
`.trim();

  const keyboard = getCartInlineKeyboard(cart, currency);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard }).catch(async () => {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    });
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }
}

export async function handleCartCheckout(ctx: BotContext) {
  const { db, tenant, from } = ctx;
  const cart: CartItem[] = ctx.session.cart || [];
  const currency = tenant.currency || 'USD';

  if (cart.length === 0) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: 'Your cart is empty!', show_alert: true });
    }
    return;
  }

  const total = cart.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);
  const telegramUserId = from?.id ? String(from.id) : 'unknown_user';
  const customerName = `${from?.first_name || ''} ${from?.last_name || ''}`.trim() || 'Telegram Customer';

  // Atomic order draft creation
  const order = await db.order.create({
    data: {
      tenant_id: tenant.id,
      customer_telegram_id: telegramUserId,
      customer_name: customerName,
      total_amount: total as any,
      status: ORDER_STATUS.PENDING as any,
      payment_method: 'STRIPE_OR_MOCK',
      items: cart as any,
      shipping_address: ctx.session.shippingAddress || 'To be specified',
      customer_phone: ctx.session.customerPhone,
    },
  });

  const env = getEnv();
  const successUrl = `${env.PUBLIC_API_URL}/api/v1/shop/orders/${order.id}/success`;
  const cancelUrl = `${env.PUBLIC_API_URL}/api/v1/shop/orders/${order.id}/cancel`;

  let sessionResult;
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.includes('placeholder')) {
    try {
      sessionResult = await createOrderCheckoutSession({
        orderId: order.id,
        tenantId: tenant.id,
        amount: total,
        currency,
        customerTelegramId: telegramUserId,
        successUrl,
        cancelUrl,
      });
    } catch {
      sessionResult = createMockPaymentSession({
        orderId: order.id,
        tenantId: tenant.id,
        amount: total,
        currency,
        customerTelegramId: telegramUserId,
        successUrl,
        cancelUrl,
      });
    }
  } else {
    sessionResult = createMockPaymentSession({
      orderId: order.id,
      tenantId: tenant.id,
      amount: total,
      currency,
      customerTelegramId: telegramUserId,
      successUrl,
      cancelUrl,
    });
  }

  const payKeyboard = new InlineKeyboard().url('💳 Pay Now', sessionResult.paymentUrl);

  const text = `
🎉 <b>Order Created!</b>

🧾 <b>Order:</b> <code>#${order.id.slice(0, 8)}</code>
💰 <b>Total:</b> <b>${total.toFixed(2)} ${currency}</b>

Please click the button below to complete your secure payment.
`.trim();

  // Clear cart after checkout initiation
  ctx.session.cart = [];

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: payKeyboard }).catch(async () => {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: payKeyboard });
    });
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: payKeyboard });
  }
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
