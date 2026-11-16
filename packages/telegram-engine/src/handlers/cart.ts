import { InlineKeyboard } from 'grammy';
import { BotContext, CartItem } from '../types.js';
import { getCartInlineKeyboard } from '../keyboards/index.js';
import { prisma } from '@telegram-commerce/database';
import { DEFAULT_PAYNET_QR_URL, ORDER_STATUS, PAYMENT_METHODS, isSafeTelegramUrl } from '@telegram-commerce/config';
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
  const currency = tenant.currency || 'UZS';

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
  const { tenant, from } = ctx;
  const locale = ctx.locale;
  const cart: CartItem[] = ctx.session.cart || [];
  const currency = tenant.currency || 'UZS';

  if (cart.length === 0) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'cart.empty_alert'), show_alert: true });
    } else {
      await ctx.reply(t(locale, 'cart.empty'), { parse_mode: 'HTML' });
    }
    return;
  }

  const telegramUserId = from?.id ? String(from.id) : 'unknown_user';
  const customerName = `${from?.first_name || ''} ${from?.last_name || ''}`.trim() || 'Telegram Customer';

  let order: { id: string; totalAmount: number };

  try {
    order = await prisma.$transaction(async (tx) => {
      const verifiedItems: Array<{
        productId: string;
        title: string;
        price: number;
        quantity: number;
      }> = [];
      let totalAmount = 0;

      for (const item of cart) {
        if (!item.quantity || item.quantity <= 0) {
          throw new Error(
            locale === 'uz'
              ? "Noto'g'ri mahsulot miqdori."
              : locale === 'en'
                ? 'Invalid item quantity.'
                : 'Некорректное количество товара.'
          );
        }

        const product = await tx.product.findFirst({
          where: { id: item.productId, tenant_id: tenant.id, is_active: true },
        });

        if (!product) {
          throw new Error(
            locale === 'uz'
              ? `«${item.title}» mahsuloti topilmadi yoki sotuvda emas.`
              : locale === 'en'
                ? `Product "${item.title}" is not found or unavailable.`
                : `Товар «${item.title}» не найден или недоступен.`
          );
        }

        const affectedRows = await tx.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" - ${item.quantity}
          WHERE "id" = ${item.productId}
            AND "tenant_id" = ${tenant.id}
            AND "stock" >= ${item.quantity}
            AND "is_active" = true
        `;

        if (affectedRows !== 1) {
          throw new Error(
            locale === 'uz'
              ? `«${product.title}» yetarli emas (qoldiq: ${product.stock} dona).`
              : locale === 'en'
                ? `Insufficient stock for "${product.title}" (available: ${product.stock}).`
                : `Недостаточно товара «${product.title}» на складе (доступно: ${product.stock} шт.).`
          );
        }

        const unitPrice = Number(product.price);
        totalAmount += unitPrice * item.quantity;
        verifiedItems.push({
          productId: product.id,
          title: product.title,
          price: unitPrice,
          quantity: item.quantity,
        });
      }

      const createdOrder = await tx.order.create({
        data: {
          tenant_id: tenant.id,
          customer_telegram_id: telegramUserId,
          customer_name: customerName,
          total_amount: totalAmount as any,
          status: ORDER_STATUS.PENDING as any,
          payment_method: PAYMENT_METHODS.PAYNET_XOLIS,
          items: verifiedItems as any,
          shipping_address: ctx.session.shippingAddress || '',
          customer_phone: ctx.session.customerPhone,
        },
      });

      return { id: createdOrder.id, totalAmount };
    });
  } catch (err: any) {
    const errorMsg = err?.message || 'Insufficient stock';
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: errorMsg.slice(0, 190), show_alert: true }).catch(() => {});
    }
    await ctx.reply(`⚠️ ${t(locale, 'checkout.failed', { error: escapeHtml(errorMsg) })}`, {
      parse_mode: 'HTML',
    });
    return;
  }

  const rawPaynetUrl = tenant.themeConfig?.paynetQrUrl || DEFAULT_PAYNET_QR_URL;
  const paynetUrl = isSafeTelegramUrl(rawPaynetUrl) ? rawPaynetUrl : DEFAULT_PAYNET_QR_URL;

  const payKeyboard = new InlineKeyboard()
    .url(t(locale, 'checkout.paynet_btn'), paynetUrl)
    .row()
    .text(t(locale, 'checkout.paynet_confirm_btn'), `order:pay:${order.id}`);

  const text = `
${t(locale, 'checkout.created')}

${t(locale, 'checkout.order_id', { orderId: order.id.slice(0, 8) })}
${t(locale, 'checkout.total', { total: formatCurrency(order.totalAmount, currency, locale) })}

${t(locale, 'checkout.paynet_instructions')}
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
