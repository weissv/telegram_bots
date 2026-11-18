import { Bot, session } from 'grammy';
import Redis from 'ioredis';
import { BotContext, SessionData, TenantInfo, CartItem } from './types.js';
import { getTenantDb, prisma } from '@telegram-commerce/database';
import { DEFAULT_THEME_CONFIG, ORDER_STATUS } from '@telegram-commerce/config';
import { t, detectLocale, type Locale } from '@telegram-commerce/i18n';
import {
  buildMerchantOrderKeyboard,
  restoreOrderUuid,
  sendMerchantOrderAlert,
  sendCustomerOrderReceipt,
} from './notifications/adminAlerts.js';
import { createRedisSessionStorage } from './session/redisStorage.js';
import { getCartItemKey, getMainMenuKeyboard } from './keyboards/index.js';
import { handleStart, handleLanguageSelection } from './handlers/start.js';
import { handleCatalog, handleCatalogSearch } from './handlers/catalog.js';
import {
  cancelCheckoutFlow,
  handleAddToCart,
  handleViewCart,
  handleCartCheckout,
  handleConfirmCartOrder,
  normalizePhoneNumber,
} from './handlers/cart.js';
import { handleOrders } from './handlers/orders.js';
import { handleWebApp } from './handlers/webapp.js';

export interface CreateTenantBotOptions {
  tenant: TenantInfo;
  botToken: string;
  redisUrl?: string;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isCancelText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === 'отмена' ||
    normalized === '❌ отмена' ||
    normalized === 'cancel' ||
    normalized === '❌ cancel' ||
    normalized === 'bekor qilish' ||
    normalized === '❌ bekor qilish' ||
    normalized === '/cancel'
  );
}

/**
 * Creates and configures a dynamic grammY Bot instance for a specific tenant.
 * Uses Redis-backed sessions with composite keys when REDIS_URL is available.
 */
export function createTenantBot(options: CreateTenantBotOptions): Bot<BotContext> {
  const { tenant, botToken, redisUrl } = options;
  const bot = new Bot<BotContext>(botToken);

  // Redis or in-memory session middleware
  if (redisUrl) {
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
    redis.connect().catch((err: any) => {
      console.warn(`[Session Redis] Connection failed for tenant ${tenant.id}, falling back to memory:`, err?.message);
    });

    bot.use(
      session({
        initial: (): SessionData => ({
          cart: [],
          catalogPage: 1,
          locale: 'ru',
          languageSelected: false,
        }),
        storage: createRedisSessionStorage<SessionData>(redis, tenant.id),
      })
    );
  } else {
    bot.use(
      session({
        initial: (): SessionData => ({
          cart: [],
          catalogPage: 1,
          locale: 'ru',
          languageSelected: false,
        }),
      })
    );
  }

  // Inject tenant, tenant-isolated database, and locale into context
  bot.use(async (ctx, next) => {
    ctx.tenant = tenant;
    ctx.db = getTenantDb(tenant.id);

    if (ctx.session?.locale) {
      ctx.locale = ctx.session.locale;
    } else {
      ctx.locale = detectLocale(ctx.from?.language_code);
    }

    await next();
  });

  // Error handling
  bot.catch((err) => {
    console.error(`[Bot Error - Tenant ${tenant.id}]:`, err.error);
  });

  // Commands (always exit any active checkout input state cleanly)
  bot.command('start', async (ctx) => {
    ctx.session.checkoutStep = undefined;
    await handleStart(ctx);
  });
  bot.command('cancel', cancelCheckoutFlow);
  bot.command('catalog', async (ctx) => {
    ctx.session.checkoutStep = undefined;
    await handleCatalog(ctx, 1);
  });
  bot.command('search', async (ctx) => {
    ctx.session.checkoutStep = undefined;
    const query = typeof (ctx as any).match === 'string' ? (ctx as any).match : '';
    await handleCatalogSearch(ctx, query);
  });
  bot.command('cart', async (ctx) => {
    ctx.session.checkoutStep = undefined;
    await handleViewCart(ctx);
  });
  bot.command('orders', async (ctx) => {
    ctx.session.checkoutStep = undefined;
    await handleOrders(ctx);
  });
  bot.command('webapp', async (ctx) => {
    ctx.session.checkoutStep = undefined;
    await handleWebApp(ctx);
  });
  bot.command('lang', async (ctx) => {
    ctx.session.checkoutStep = undefined;
    await handleLanguageSelection(ctx);
  });
  bot.command('help', async (ctx) => {
    ctx.session.checkoutStep = undefined;
    const locale = ctx.locale;
    await ctx.reply(
      `${t(locale, 'help.title')}\n\n${t(locale, 'help.commands')}`,
      { parse_mode: 'HTML' }
    );
  });

  // Text menu replies (support RU, EN and UZ button labels)
  bot.hears(['📦 Каталог', '📦 Catalog', '📦 Katalog'], async (ctx) => {
    ctx.session.checkoutStep = undefined;
    await handleCatalog(ctx, 1);
  });
  bot.hears(['🛒 Корзина', '🛒 Cart', '🛒 Savatcha'], async (ctx) => {
    ctx.session.checkoutStep = undefined;
    await handleViewCart(ctx);
  });
  bot.hears(['📋 Мои заказы', '📋 My Orders', '📋 Buyurtmalarim'], async (ctx) => {
    ctx.session.checkoutStep = undefined;
    await handleOrders(ctx);
  });
  bot.hears(['ℹ️ О магазине', 'ℹ️ About Store', "ℹ️ Do'kon haqida"], async (ctx) => {
    ctx.session.checkoutStep = undefined;
    const locale = ctx.locale;
    const theme = ctx.tenant.themeConfig || {};
    const info = theme.description || t(locale, 'store_info.default');
    const extras = [
      theme.legalName ? `🏢 <b>Продавец:</b> ${escapeHtml(theme.legalName)}` : '',
      theme.innOrPinfl ? `🆔 <b>ИНН / ПИНФЛ:</b> <code>${escapeHtml(theme.innOrPinfl)}</code>` : '',
      theme.supportContact ? `📞 <b>Поддержка:</b> ${escapeHtml(theme.supportContact)}` : '',
      `🚚 <b>Доставка:</b> ${escapeHtml(theme.deliveryTerms || DEFAULT_THEME_CONFIG.deliveryTerms)}`,
      `↩️ <b>Возврат:</b> ${escapeHtml(theme.returnPolicy || DEFAULT_THEME_CONFIG.returnPolicy)}`,
    ]
      .filter(Boolean)
      .join('\n');

    await ctx.reply(`${t(locale, 'store_info.title')}\n\n${escapeHtml(info)}\n\n${extras}`, {
      parse_mode: 'HTML',
    });
  });
  bot.hears(['🌐 Язык', '🌐 Language', '🌐 Til'], async (ctx) => {
    ctx.session.checkoutStep = undefined;
    await handleLanguageSelection(ctx);
  });

  // Handle shared Telegram contact during checkout phone step
  bot.on('message:contact', async (ctx) => {
    const contactPhone = normalizePhoneNumber(ctx.message.contact?.phone_number);
    if (!contactPhone) {
      return;
    }

    ctx.session.customerPhone = contactPhone;

    if (ctx.session.checkoutStep === 'awaiting_phone') {
      const locale = ctx.locale;
      ctx.session.checkoutStep = undefined;
      const savedText =
        locale === 'uz'
          ? `✅ Telefon saqlandi: <code>${escapeHtml(contactPhone)}</code>`
          : locale === 'en'
            ? `✅ Phone saved: <code>${escapeHtml(contactPhone)}</code>`
            : `✅ Телефон сохранён: <code>${escapeHtml(contactPhone)}</code>`;
      await ctx.reply(savedText, {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(ctx.tenant, locale),
      });
      await handleCartCheckout(ctx);
    }
  });

  // Handle text inputs during interactive checkout (phone / shipping address)
  bot.on('message:text', async (ctx, next) => {
    const step = ctx.session?.checkoutStep;
    if (step !== 'awaiting_phone' && step !== 'awaiting_address') {
      await next();
      return;
    }

    const text = ctx.message.text.trim();
    const locale = ctx.locale;

    if (isCancelText(text)) {
      await cancelCheckoutFlow(ctx);
      return;
    }

    if (step === 'awaiting_phone') {
      const normalized = normalizePhoneNumber(text);
      if (!normalized) {
        const retryMsg =
          locale === 'uz'
            ? "⚠️ Noto'g'ri telefon raqami. Iltimos, raqamni <code>+998901234567</code> ko'rinishida kiriting yoki quyidagi tugmani bosing:"
            : locale === 'en'
              ? '⚠️ Invalid phone number. Please enter a valid phone like <code>+998901234567</code> or tap the button below:'
              : '⚠️ Некорректный номер телефона. Введите номер в формате <code>+998901234567</code> или нажмите кнопку «Отправить мой номер телефона» ниже:';
        await ctx.reply(retryMsg, { parse_mode: 'HTML' });
        return;
      }

      ctx.session.customerPhone = normalized;
      ctx.session.checkoutStep = undefined;
      const savedText =
        locale === 'uz'
          ? `✅ Telefon saqlandi: <code>${escapeHtml(normalized)}</code>`
          : locale === 'en'
            ? `✅ Phone saved: <code>${escapeHtml(normalized)}</code>`
            : `✅ Телефон сохранён: <code>${escapeHtml(normalized)}</code>`;
      await ctx.reply(savedText, {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(ctx.tenant, locale),
      });
      await handleCartCheckout(ctx);
      return;
    }

    if (step === 'awaiting_address') {
      if (text.length < 5 || text.startsWith('/')) {
        const retryMsg =
          locale === 'uz'
            ? "⚠️ Iltimos, to'liq yetkazib berish manzilini kiriting (kamida 5 ta belgi):"
            : locale === 'en'
              ? '⚠️ Please enter a full shipping address (at least 5 characters):'
              : '⚠️ Пожалуйста, укажите полный адрес доставки (минимум 5 символов):';
        await ctx.reply(retryMsg, { parse_mode: 'HTML' });
        return;
      }

      ctx.session.shippingAddress = text;
      ctx.session.checkoutStep = undefined;
      await handleCartCheckout(ctx);
    }
  });

  // Callback queries
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data === 'noop') {
      await ctx.answerCallbackQuery();
      return;
    }

    // Language selection callbacks
    if (data === 'lang:ru' || data === 'lang:en' || data === 'lang:uz') {
      const newLocale = data.substring(5) as Locale;
      ctx.session.locale = newLocale;
      ctx.session.languageSelected = true;
      ctx.locale = newLocale;

      await ctx.answerCallbackQuery({ text: t(newLocale, 'lang.selected') });
      await handleStart(ctx);
      return;
    }

    if (data === 'catalog:browse') {
      await handleCatalog(ctx, 1);
      return;
    }

    if (data.startsWith('cat:')) {
      const category = data.substring(4);
      await handleCatalog(ctx, 1, category);
      return;
    }

    if (data.startsWith('page:')) {
      const page = Number.parseInt(data.substring(5), 10) || 1;
      await handleCatalog(ctx, page);
      return;
    }

    if (data.startsWith('cart:v:')) {
      const rest = data.substring(7);
      const lastColon = rest.lastIndexOf(':');
      if (lastColon > 0) {
        const rawProdId = rest.substring(0, lastColon);
        const variantIdx = Number.parseInt(rest.substring(lastColon + 1), 10);
        const productId = restoreOrderUuid(rawProdId);
        const product = await ctx.db.product.findFirst({
          where: { id: productId, is_active: true },
        });
        const variants = Array.isArray((product as any)?.variants)
          ? ((product as any).variants as any[]).map((v) => String(v).trim()).filter(Boolean)
          : [];
        const selectedVariant = Number.isInteger(variantIdx) ? variants[variantIdx] : undefined;
        await handleAddToCart(ctx, productId, selectedVariant);
        return;
      }
      await ctx.answerCallbackQuery();
      return;
    }

    if (data.startsWith('cart:add:')) {
      const productId = data.substring(9);
      await handleAddToCart(ctx, productId);
      return;
    }

    if (data === 'cart:view') {
      await handleViewCart(ctx);
      return;
    }

    if (data === 'cart:clear') {
      ctx.session.cart = [];
      ctx.session.checkoutStep = undefined;
      await handleViewCart(ctx);
      return;
    }

    if (data === 'cart:checkout') {
      await handleCartCheckout(ctx);
      return;
    }

    if (data === 'checkout:delivery:COURIER' || data === 'checkout:delivery:PICKUP') {
      const method = data.endsWith('PICKUP') ? 'PICKUP' : 'COURIER';
      ctx.session.deliveryMethod = method;
      if (method === 'PICKUP') {
        ctx.session.shippingAddress = 'Самовывоз';
      } else if (ctx.session.shippingAddress === 'Самовывоз') {
        ctx.session.shippingAddress = undefined;
      }
      await handleCartCheckout(ctx);
      return;
    }

    if (data === 'checkout:edit_phone') {
      ctx.session.customerPhone = undefined;
      await handleCartCheckout(ctx);
      return;
    }

    if (data === 'checkout:edit_delivery') {
      ctx.session.deliveryMethod = undefined;
      ctx.session.shippingAddress = undefined;
      await handleCartCheckout(ctx);
      return;
    }

    if (data === 'checkout:confirm') {
      await handleConfirmCartOrder(ctx);
      return;
    }

    if (data === 'checkout:cancel') {
      await cancelCheckoutFlow(ctx);
      return;
    }

    if (data.startsWith('cart:inc:')) {
      const itemKey = data.substring(9);
      const item = ctx.session.cart?.find(
        (i: CartItem) => getCartItemKey(i) === itemKey || i.productId === itemKey
      );
      if (item) {
        const product = await ctx.db.product.findFirst({
          where: { id: item.productId, is_active: true },
        });
        const totalQtyForProduct = ctx.session.cart
          .filter((c: CartItem) => c.productId === item.productId)
          .reduce((sum: number, c: CartItem) => sum + c.quantity, 0);
        if (product && totalQtyForProduct >= product.stock) {
          await ctx.answerCallbackQuery({
            text: t(ctx.locale, 'cart.max_stock', { stock: product.stock }),
            show_alert: true,
          });
          return;
        }
        item.quantity += 1;
      }
      await handleViewCart(ctx);
      return;
    }

    if (data.startsWith('cart:dec:')) {
      const itemKey = data.substring(9);
      const item = ctx.session.cart?.find(
        (i: CartItem) => getCartItemKey(i) === itemKey || i.productId === itemKey
      );
      if (item) {
        item.quantity -= 1;
        if (item.quantity <= 0) {
          ctx.session.cart = ctx.session.cart.filter(
            (i: CartItem) => !(getCartItemKey(i) === itemKey || i.productId === itemKey)
          );
        }
      }
      await handleViewCart(ctx);
      return;
    }

    if (data.startsWith('cart:remove:')) {
      const itemKey = data.substring(12);
      ctx.session.cart = ctx.session.cart.filter(
        (i: CartItem) => !(getCartItemKey(i) === itemKey || i.productId === itemKey)
      );
      await handleViewCart(ctx);
      return;
    }

    // Customer "I Paid" -> transitions ONLY from PENDING -> PAYMENT_REVIEW (never auto-PAID!)
    if (data.startsWith('order:pay:')) {
      const orderId = restoreOrderUuid(data.substring(10));
      const locale = ctx.locale;
      try {
        const existingOrder = await ctx.db.order.findFirst({
          where: { id: orderId },
        });

        if (!existingOrder) {
          await ctx.answerCallbackQuery({
            text: locale === 'uz' ? 'Buyurtma topilmadi' : locale === 'en' ? 'Order not found' : 'Заказ не найден',
            show_alert: true,
          });
          return;
        }

        if (
          existingOrder.customer_telegram_id &&
          /^\d+$/.test(existingOrder.customer_telegram_id) &&
          ctx.from?.id &&
          String(ctx.from.id) !== String(existingOrder.customer_telegram_id)
        ) {
          await ctx.answerCallbackQuery({
            text: '⛔ Доступно только автору заказа',
            show_alert: true,
          });
          return;
        }

        if (existingOrder.status === ORDER_STATUS.PAYMENT_REVIEW) {
          await ctx.answerCallbackQuery({
            text:
              locale === 'uz'
                ? "🔍 To'lov so'rovi allaqachon tekshiruvda!"
                : locale === 'en'
                  ? '🔍 Payment is already under operator review!'
                  : '🔍 Заявка об оплате уже отправлена на проверку!',
          });
          return;
        }

        if (existingOrder.status === ORDER_STATUS.PAID || existingOrder.status === ORDER_STATUS.DELIVERED) {
          await ctx.answerCallbackQuery({
            text:
              locale === 'uz'
                ? "✅ Buyurtma allaqachon to'langan!"
                : locale === 'en'
                  ? '✅ Order is already paid!'
                  : '✅ Заказ уже оплачен!',
          });
          return;
        }

        if (existingOrder.status === ORDER_STATUS.CANCELLED || existingOrder.status === ORDER_STATUS.REFUNDED) {
          await ctx.answerCallbackQuery({
            text:
              locale === 'uz'
                ? '❌ Buyurtma bekor qilingan'
                : locale === 'en'
                  ? '❌ Order was cancelled'
                  : '❌ Заказ был отменён',
            show_alert: true,
          });
          return;
        }

        const transition = await prisma.$transaction(async (tx) => {
          const current = await tx.order.findFirst({
            where: { id: orderId, tenant_id: ctx.tenant.id },
          });

          if (!current || current.status !== (ORDER_STATUS.PENDING as any)) {
            return { updated: false, order: current };
          }

          const prevHistory = Array.isArray((current as any).status_history)
            ? ((current as any).status_history as any[])
            : [];
          const nextHistory = [
            ...prevHistory,
            {
              status: ORDER_STATUS.PAYMENT_REVIEW,
              at: new Date().toISOString(),
              by: 'customer',
            },
          ];

          const updateRes = await tx.order.updateMany({
            where: {
              id: orderId,
              tenant_id: ctx.tenant.id,
              status: ORDER_STATUS.PENDING as any,
            },
            data: {
              status: ORDER_STATUS.PAYMENT_REVIEW as any,
              status_history: nextHistory as any,
            } as any,
          });

          if (updateRes.count !== 1) {
            return { updated: false, order: current };
          }

          const updated = await tx.order.findFirst({
            where: { id: orderId, tenant_id: ctx.tenant.id },
          });
          return { updated: true, order: updated || current };
        });

        if (!transition.updated || !transition.order) {
          await ctx.answerCallbackQuery({
            text: '🔍 Заявка уже находится в обработке',
          });
          return;
        }

        const updatedOrder = transition.order as any;
        const items = (Array.isArray(updatedOrder.items) ? updatedOrder.items : []).map((i: any) => ({
          title: String(i?.title || 'Товар'),
          quantity: Number(i?.quantity || 1),
          price: Number(i?.price || 0),
          ...(i?.variant ? { variant: String(i.variant) } : {}),
        }));
        const currency = ctx.tenant.currency || 'UZS';
        const totalAmount = Number(updatedOrder.total_amount);

        if (ctx.tenant.ownerTelegramId) {
          await sendMerchantOrderAlert(bot, ctx.tenant.ownerTelegramId, {
            orderId: updatedOrder.id,
            totalAmount,
            deliveryFee:
              updatedOrder.delivery_fee !== undefined ? Number(updatedOrder.delivery_fee) : undefined,
            deliveryMethod: updatedOrder.delivery_method || undefined,
            currency,
            customerTelegramId: updatedOrder.customer_telegram_id,
            customerName: updatedOrder.customer_name || undefined,
            shippingAddress: updatedOrder.shipping_address || undefined,
            customerPhone: updatedOrder.customer_phone || undefined,
            status: ORDER_STATUS.PAYMENT_REVIEW,
            items,
          });
        }

        const shortId = updatedOrder.id.slice(0, 8);
        const supportContact = ctx.tenant.themeConfig?.supportContact
          ? `\n📞 <b>${locale === 'uz' ? "Qo'llab-quvvatlash" : locale === 'en' ? 'Support' : 'Поддержка магазина'}:</b> ${escapeHtml(ctx.tenant.themeConfig.supportContact)}`
          : '';

        const reviewMessage =
          locale === 'uz'
            ? `✅ To'lov haqidagi so'rovingiz operator tekshiruviga yuborildi! Buyurtma raqami: <code>#${shortId}</code>. Mablag' tushishi tekshirilgandan so'ng tasdiqlash va chek yuboramiz.${supportContact}`
            : locale === 'en'
              ? `✅ Payment claim submitted for operator review! Order: <code>#${shortId}</code>. Once verified, we will send confirmation and your receipt.${supportContact}`
              : `✅ Заявка об оплате отправлена на проверку оператору! Номер заказа: #${shortId}. После проверки поступления средств мы отправим подтверждение и чек.${supportContact}`;

        await ctx.answerCallbackQuery({
          text:
            locale === 'uz'
              ? "🔍 So'rov tekshiruvga yuborildi!"
              : locale === 'en'
                ? '🔍 Sent for payment verification!'
                : '🔍 Заявка отправлена на проверку!',
        });

        await ctx.editMessageText(reviewMessage, { parse_mode: 'HTML' }).catch(async () => {
          await ctx.reply(reviewMessage, { parse_mode: 'HTML' });
        });
      } catch (err: any) {
        await ctx.answerCallbackQuery({
          text: `Ошибка: ${err?.message || 'Не удалось обновить заказ'}`.slice(0, 190),
          show_alert: true,
        });
      }
      return;
    }

    // Merchant confirms payment receipt -> atomic PENDING / PAYMENT_REVIEW -> PAID
    if (data.startsWith('merchant:order:confirm_pay:')) {
      const rawId = data.substring('merchant:order:confirm_pay:'.length);
      const orderId = restoreOrderUuid(rawId);

      if (!ctx.tenant.ownerTelegramId || String(ctx.from?.id || '') !== String(ctx.tenant.ownerTelegramId)) {
        await ctx.answerCallbackQuery({
          text: '⛔ Доступно только владельцу магазина',
          show_alert: true,
        });
        return;
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          const existing = await tx.order.findFirst({
            where: { id: orderId, tenant_id: ctx.tenant.id },
          });

          if (!existing) {
            return { state: 'not_found' as const, order: null };
          }

          if (existing.status === ORDER_STATUS.PAID || existing.status === ORDER_STATUS.DELIVERED) {
            return { state: 'already_paid' as const, order: existing };
          }

          if (existing.status === ORDER_STATUS.CANCELLED || existing.status === ORDER_STATUS.REFUNDED) {
            return { state: 'cancelled' as const, order: existing };
          }

          const prevHistory = Array.isArray((existing as any).status_history)
            ? ((existing as any).status_history as any[])
            : [];
          const verifier = `telegram:${ctx.from?.id || 'owner'}`;
          const nextHistory = [
            ...prevHistory,
            {
              status: ORDER_STATUS.PAID,
              at: new Date().toISOString(),
              by: verifier,
            },
          ];

          const updateRes = await tx.order.updateMany({
            where: {
              id: orderId,
              tenant_id: ctx.tenant.id,
              status: { in: [ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_REVIEW] as any },
            },
            data: {
              status: ORDER_STATUS.PAID as any,
              payment_id: existing.payment_id || `paynet_tg_${Date.now()}`,
              verified_at: new Date(),
              verified_by: verifier,
              status_history: nextHistory as any,
            } as any,
          });

          if (updateRes.count !== 1) {
            return { state: 'already_paid' as const, order: existing };
          }

          const fresh = await tx.order.findFirst({
            where: { id: orderId, tenant_id: ctx.tenant.id },
          });
          return { state: 'confirmed' as const, order: fresh || existing };
        });

        if (result.state === 'not_found') {
          await ctx.answerCallbackQuery({ text: 'Заказ не найден', show_alert: true });
          return;
        }

        if (result.state === 'already_paid') {
          await ctx.answerCallbackQuery({ text: '💳 Оплата уже была подтверждена ранее' });
          return;
        }

        if (result.state === 'cancelled') {
          await ctx.answerCallbackQuery({ text: '❌ Отменённый заказ нельзя подтвердить', show_alert: true });
          return;
        }

        const confirmedOrder = result.order as any;
        const items = (Array.isArray(confirmedOrder.items) ? confirmedOrder.items : []).map((i: any) => ({
          title: String(i?.title || 'Товар'),
          quantity: Number(i?.quantity || 1),
          price: Number(i?.price || 0),
          ...(i?.variant ? { variant: String(i.variant) } : {}),
        }));

        if (confirmedOrder.customer_telegram_id && /^\d+$/.test(confirmedOrder.customer_telegram_id)) {
          await sendCustomerOrderReceipt(bot, confirmedOrder.customer_telegram_id, {
            orderId: confirmedOrder.id,
            totalAmount: Number(confirmedOrder.total_amount),
            deliveryFee:
              confirmedOrder.delivery_fee !== undefined ? Number(confirmedOrder.delivery_fee) : undefined,
            deliveryMethod: confirmedOrder.delivery_method || undefined,
            currency: ctx.tenant.currency || 'UZS',
            items,
          });
        }

        const refreshedKeyboard = buildMerchantOrderKeyboard(confirmedOrder.id, false);
        const origText = ctx.callbackQuery.message?.text;
        if (origText) {
          await ctx
            .editMessageText(
              `${escapeHtml(origText)}\n\n✅ <b>Оплата подтверждена. Заказ в сборке.</b>`,
              { parse_mode: 'HTML', reply_markup: refreshedKeyboard }
            )
            .catch(async () => {
              await ctx.editMessageReplyMarkup({ reply_markup: refreshedKeyboard }).catch(() => {});
            });
        } else {
          await ctx.editMessageReplyMarkup({ reply_markup: refreshedKeyboard }).catch(() => {});
        }

        await ctx.answerCallbackQuery({ text: '💳 Оплата подтверждена! Покупатель получил чек.' });
      } catch (err: any) {
        await ctx.answerCallbackQuery({
          text: `Ошибка: ${err?.message || 'Не удалось подтвердить оплату'}`.slice(0, 190),
          show_alert: true,
        });
      }
      return;
    }

    if (data.startsWith('merchant:order:deliver:')) {
      const orderId = restoreOrderUuid(data.substring(23));
      if (!ctx.tenant.ownerTelegramId || String(ctx.from?.id || '') !== String(ctx.tenant.ownerTelegramId)) {
        await ctx.answerCallbackQuery({
          text: '⛔ Доступно только владельцу магазина',
          show_alert: true,
        });
        return;
      }

      try {
        const existingOrder = await ctx.db.order.findFirst({
          where: { id: orderId },
        });

        if (!existingOrder) {
          await ctx.answerCallbackQuery({ text: 'Заказ не найден', show_alert: true });
          return;
        }

        if (existingOrder.status === ORDER_STATUS.DELIVERED) {
          await ctx.answerCallbackQuery({ text: '🚚 Заказ уже отмечен как доставленный' });
          return;
        }

        if (existingOrder.status === ORDER_STATUS.CANCELLED || existingOrder.status === ORDER_STATUS.REFUNDED) {
          await ctx.answerCallbackQuery({ text: '❌ Отменённый заказ нельзя доставить', show_alert: true });
          return;
        }

        if (existingOrder.status !== ORDER_STATUS.PAID) {
          await ctx.answerCallbackQuery({
            text: '⚠️ Сначала подтвердите поступление оплаты («✅ Оплата поступила»).',
            show_alert: true,
          });
          return;
        }

        const prevHistory = Array.isArray((existingOrder as any).status_history)
          ? ((existingOrder as any).status_history as any[])
          : [];
        const nextHistory = [
          ...prevHistory,
          {
            status: ORDER_STATUS.DELIVERED,
            at: new Date().toISOString(),
            by: `telegram:${ctx.from?.id || 'owner'}`,
          },
        ];

        const updatedOrder = await ctx.db.order.update({
          where: { id: orderId },
          data: {
            status: ORDER_STATUS.DELIVERED as any,
            status_history: nextHistory as any,
          } as any,
        });

        if (updatedOrder.customer_telegram_id && /^\d+$/.test(updatedOrder.customer_telegram_id)) {
          await bot.api
            .sendMessage(
              updatedOrder.customer_telegram_id,
              t('ru', 'orders.notify_delivered', { orderId: orderId.slice(0, 8) }),
              { parse_mode: 'HTML' }
            )
            .catch((err) => {
              console.warn(`Failed to notify customer on order deliver ${orderId}:`, err);
            });
        }

        const origText = ctx.callbackQuery.message?.text;
        if (origText) {
          await ctx
            .editMessageText(`${escapeHtml(origText)}\n\n🚚 <b>Заказ доставлен.</b>`, {
              parse_mode: 'HTML',
            })
            .catch(() => {});
        } else {
          await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
        }

        await ctx.answerCallbackQuery({ text: '🚚 Статус заказа: Доставлен' });
      } catch (err: any) {
        await ctx.answerCallbackQuery({
          text: `Ошибка: ${err?.message || 'Не удалось обновить заказ'}`.slice(0, 190),
          show_alert: true,
        });
      }
      return;
    }

    if (data.startsWith('merchant:order:cancel:')) {
      const orderId = restoreOrderUuid(data.substring(22));
      if (!ctx.tenant.ownerTelegramId || String(ctx.from?.id || '') !== String(ctx.tenant.ownerTelegramId)) {
        await ctx.answerCallbackQuery({
          text: '⛔ Доступно только владельцу магазина',
          show_alert: true,
        });
        return;
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          const existing = await tx.order.findFirst({
            where: { id: orderId, tenant_id: ctx.tenant.id },
          });

          if (!existing) {
            return { status: 'not_found' as const, order: null };
          }

          if (existing.status === ORDER_STATUS.CANCELLED || existing.status === ORDER_STATUS.REFUNDED) {
            return { status: 'already_cancelled' as const, order: existing };
          }

          const prevHistory = Array.isArray((existing as any).status_history)
            ? ((existing as any).status_history as any[])
            : [];
          const nextHistory = [
            ...prevHistory,
            {
              status: ORDER_STATUS.CANCELLED,
              at: new Date().toISOString(),
              by: `telegram:${ctx.from?.id || 'owner'}`,
            },
          ];

          const updateRes = await tx.order.updateMany({
            where: {
              id: orderId,
              tenant_id: ctx.tenant.id,
              status: { notIn: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED] as any },
            },
            data: {
              status: ORDER_STATUS.CANCELLED as any,
              status_history: nextHistory as any,
            } as any,
          });

          if (updateRes.count === 1) {
            const items = Array.isArray(existing.items) ? (existing.items as any[]) : [];
            for (const item of items) {
              const productId = item?.productId || item?.id;
              const qty = Number(item?.quantity || 0);
              if (productId && qty > 0) {
                await tx.$executeRaw`
                  UPDATE "Product"
                  SET "stock" = "stock" + ${qty}
                  WHERE "id" = ${String(productId)}
                    AND "tenant_id" = ${ctx.tenant.id}
                `;
              }
            }
          }

          return {
            status: updateRes.count === 1 ? ('cancelled' as const) : ('already_cancelled' as const),
            order: existing,
          };
        });

        if (result.status === 'not_found') {
          await ctx.answerCallbackQuery({ text: 'Заказ не найден', show_alert: true });
          return;
        }

        if (result.status === 'already_cancelled') {
          await ctx.answerCallbackQuery({ text: '❌ Заказ уже отменён' });
          return;
        }

        if (result.order?.customer_telegram_id && /^\d+$/.test(result.order.customer_telegram_id)) {
          await bot.api
            .sendMessage(
              result.order.customer_telegram_id,
              t('ru', 'orders.notify_cancelled', { orderId: orderId.slice(0, 8) }),
              { parse_mode: 'HTML' }
            )
            .catch((err) => {
              console.warn(`Failed to notify customer on order cancel ${orderId}:`, err);
            });
        }

        const origText = ctx.callbackQuery.message?.text;
        if (origText) {
          await ctx
            .editMessageText(`${escapeHtml(origText)}\n\n❌ <b>Заказ отменён, остатки возвращены.</b>`, {
              parse_mode: 'HTML',
            })
            .catch(() => {});
        } else {
          await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
        }

        await ctx.answerCallbackQuery({ text: '❌ Заказ отменён, остатки возвращены' });
      } catch (err: any) {
        await ctx.answerCallbackQuery({
          text: `Ошибка: ${err?.message || 'Не удалось отменить заказ'}`.slice(0, 190),
          show_alert: true,
        });
      }
      return;
    }

    await ctx.answerCallbackQuery();
  });

  return bot;
}
