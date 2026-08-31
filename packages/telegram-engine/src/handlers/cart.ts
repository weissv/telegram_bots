import { InlineKeyboard } from 'grammy';
import { BotContext, CartItem } from '../types.js';
import { getCartInlineKeyboard } from '../keyboards/index.js';
import { createOrderCheckoutSession, createMockPaymentSession } from '@telegram-commerce/payments';
import { getEnv, ORDER_STATUS } from '@telegram-commerce/config';
import { t, formatCurrency } from '@telegram-commerce/i18n';

export async function handleAddToCart(ctx: BotContext, productId: string) {
  const { db } = ctx;
  const locale = ctx.locale;

  const product = await db.product.findFirst({
    where: { id: productId, is_active: true },
  });

  if (!product) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'cart.not_found'), show_alert: true });
    }
    return;
  }

  if (product.stock <= 0) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'cart.out_of_stock'), show_alert: true });
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
        await ctx.answerCallbackQuery({
          text: t(locale, 'cart.max_stock', { stock: product.stock }),
          show_alert: true,
        });
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
      text: t(locale, 'cart.added', { title: product.title }),
    });
  }
}

export async function handleViewCart(ctx: BotContext) {
  const { tenant } = ctx;
  const locale = ctx.locale;
  const cart: CartItem[] = ctx.session.cart || [];
  const currency = tenant.currency || 'USD';

  if (cart.length === 0) {
    const text = t(locale, 'cart.empty');
    const keyboard = new InlineKeyboard().text(t(locale, 'cart.continue'), 'catalog:browse');

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
    .map((item: CartItem, idx: number) =>
      t(locale, 'cart.item_line', {
        idx: idx + 1,
        title: escapeHtml(item.title),
        qty: item.quantity,
        price: formatCurrency(item.price, currency, locale),
        subtotal: formatCurrency(item.quantity * item.price, currency, locale),
      })
    )
    .join('\n\n');

  const text = `
${t(locale, 'cart.title')}

${itemsList}

━━━━━━━━━━━━━━━━━━━
${t(locale, 'cart.total', { total: formatCurrency(total, currency, locale) })}
━━━━━━━━━━━━━━━━━━━
`.trim();

  const keyboard = getCartInlineKeyboard(cart, currency, locale);

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
  const locale = ctx.locale;
  const cart: CartItem[] = ctx.session.cart || [];
  const currency = tenant.currency || 'USD';

  if (cart.length === 0) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'cart.empty_alert'), show_alert: true });
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
      shipping_address: ctx.session.shippingAddress || '',
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

  const payKeyboard = new InlineKeyboard().url(t(locale, 'checkout.pay_now'), sessionResult.paymentUrl);

  const text = `
${t(locale, 'checkout.created')}

${t(locale, 'checkout.order_id', { orderId: order.id.slice(0, 8) })}
${t(locale, 'checkout.total', { total: formatCurrency(total, currency, locale) })}

${t(locale, 'checkout.pay_prompt')}
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
