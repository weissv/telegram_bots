import { Bot, session } from 'grammy';
import Redis from 'ioredis';
import { BotContext, SessionData, TenantInfo, CartItem } from './types.js';
import { getTenantDb, prisma } from '@telegram-commerce/database';
import { ORDER_STATUS } from '@telegram-commerce/config';
import { t, detectLocale, type Locale } from '@telegram-commerce/i18n';
import { sendMerchantOrderAlert, sendCustomerOrderReceipt } from './notifications/adminAlerts.js';
import { createRedisSessionStorage } from './session/redisStorage.js';
import { handleStart, handleLanguageSelection } from './handlers/start.js';
import { handleCatalog } from './handlers/catalog.js';
import { handleAddToCart, handleViewCart, handleCartCheckout } from './handlers/cart.js';
import { handleOrders } from './handlers/orders.js';
import { handleWebApp } from './handlers/webapp.js';

export interface CreateTenantBotOptions {
  tenant: TenantInfo;
  botToken: string;
  redisUrl?: string;
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

    // Determine locale from session, falling back to Telegram language_code
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

  // Commands
  bot.command('start', handleStart);
  bot.command('catalog', (ctx) => handleCatalog(ctx, 1));
  bot.command('cart', handleViewCart);
  bot.command('orders', handleOrders);
  bot.command('webapp', handleWebApp);
  bot.command('lang', (ctx) => handleLanguageSelection(ctx));
  bot.command('help', async (ctx) => {
    const locale = ctx.locale;
    await ctx.reply(
      `${t(locale, 'help.title')}\n\n${t(locale, 'help.commands')}`,
      { parse_mode: 'HTML' }
    );
  });

  // Text menu replies (support RU, EN and UZ button labels)
  bot.hears(['📦 Каталог', '📦 Catalog', '📦 Katalog'], (ctx) => handleCatalog(ctx, 1));
  bot.hears(['🛒 Корзина', '🛒 Cart', '🛒 Savatcha'], handleViewCart);
  bot.hears(['📋 Мои заказы', '📋 My Orders', '📋 Buyurtmalarim'], handleOrders);
  bot.hears(['ℹ️ О магазине', 'ℹ️ About Store', "ℹ️ Do'kon haqida"], async (ctx) => {
    const locale = ctx.locale;
    const info = ctx.tenant.themeConfig?.description || t(locale, 'store_info.default');
    await ctx.reply(`${t(locale, 'store_info.title')}\n\n${info}`, { parse_mode: 'HTML' });
  });
  bot.hears(['🌐 Язык', '🌐 Language', '🌐 Til'], (ctx) => handleLanguageSelection(ctx));

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

      // Show welcome message after language selection
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
      await handleViewCart(ctx);
      return;
    }

    if (data === 'cart:checkout') {
      await handleCartCheckout(ctx);
      return;
    }

    if (data.startsWith('cart:inc:')) {
      const productId = data.substring(9);
      const item = ctx.session.cart?.find((i: CartItem) => i.productId === productId);
      if (item) item.quantity += 1;
      await handleViewCart(ctx);
      return;
    }

    if (data.startsWith('cart:dec:')) {
      const productId = data.substring(9);
      const item = ctx.session.cart?.find((i: CartItem) => i.productId === productId);
      if (item) {
        item.quantity -= 1;
        if (item.quantity <= 0) {
          ctx.session.cart = ctx.session.cart.filter((i: CartItem) => i.productId !== productId);
        }
      }
      await handleViewCart(ctx);
      return;
    }

    if (data.startsWith('cart:remove:')) {
      const productId = data.substring(12);
      ctx.session.cart = ctx.session.cart.filter((i: CartItem) => i.productId !== productId);
      await handleViewCart(ctx);
      return;
    }

    if (data.startsWith('order:pay:')) {
      const orderId = data.substring(10);
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

        if (existingOrder.status === ORDER_STATUS.PAID) {
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

        if (existingOrder.status === ORDER_STATUS.CANCELLED) {
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

        const updatedOrder = await ctx.db.order.update({
          where: { id: orderId },
          data: {
            status: ORDER_STATUS.PAID as any,
            payment_id: 'paynet_' + Date.now(),
          },
        });

        const items = (Array.isArray(updatedOrder.items) ? updatedOrder.items : []).map((i: any) => ({
          title: String(i?.title || 'Товар'),
          quantity: Number(i?.quantity || 1),
          price: Number(i?.price || 0),
        }));
        const currency = ctx.tenant.currency || 'UZS';
        const totalAmount = Number(updatedOrder.total_amount);

        if (ctx.tenant.ownerTelegramId) {
          await sendMerchantOrderAlert(bot, ctx.tenant.ownerTelegramId, {
            orderId: updatedOrder.id,
            totalAmount,
            currency,
            customerTelegramId: updatedOrder.customer_telegram_id,
            customerName: updatedOrder.customer_name || undefined,
            shippingAddress: updatedOrder.shipping_address || undefined,
            customerPhone: updatedOrder.customer_phone || undefined,
            items,
          });
        }

        const customerChatId =
          updatedOrder.customer_telegram_id && /^\d+$/.test(updatedOrder.customer_telegram_id)
            ? updatedOrder.customer_telegram_id
            : ctx.from?.id
              ? String(ctx.from.id)
              : '';

        if (customerChatId) {
          await sendCustomerOrderReceipt(bot, customerChatId, {
            orderId: updatedOrder.id,
            totalAmount,
            currency,
            items,
          });
        }

        await ctx.answerCallbackQuery({
          text:
            locale === 'uz'
              ? "✅ To'lov tasdiqlandi!"
              : locale === 'en'
                ? '✅ Payment confirmed!'
                : '✅ Оплата успешно подтверждена!',
        });
      } catch (err: any) {
        await ctx.answerCallbackQuery({
          text: `Ошибка: ${err?.message || 'Не удалось обновить заказ'}`.slice(0, 190),
          show_alert: true,
        });
      }
      return;
    }

    if (data.startsWith('merchant:order:deliver:')) {
      const orderId = data.substring(23);
      if (ctx.tenant.ownerTelegramId && String(ctx.from?.id || '') !== String(ctx.tenant.ownerTelegramId)) {
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

        if (existingOrder.status === ORDER_STATUS.CANCELLED) {
          await ctx.answerCallbackQuery({ text: '❌ Отменённый заказ нельзя доставить', show_alert: true });
          return;
        }

        const updatedOrder = await ctx.db.order.update({
          where: { id: orderId },
          data: { status: ORDER_STATUS.DELIVERED as any },
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
      const orderId = data.substring(22);
      if (ctx.tenant.ownerTelegramId && String(ctx.from?.id || '') !== String(ctx.tenant.ownerTelegramId)) {
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

          const updateRes = await tx.order.updateMany({
            where: {
              id: orderId,
              tenant_id: ctx.tenant.id,
              status: { not: ORDER_STATUS.CANCELLED as any },
            },
            data: { status: ORDER_STATUS.CANCELLED as any },
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
