import { Bot, session } from 'grammy';
import Redis from 'ioredis';
import { BotContext, SessionData, TenantInfo, CartItem } from './types.js';
import { getTenantDb } from '@telegram-commerce/database';
import { t, detectLocale, type Locale } from '@telegram-commerce/i18n';
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
    redis.connect().catch((err) => {
      console.warn(`[Session Redis] Connection failed for tenant ${tenant.id}, falling back to memory:`, err.message);
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

  // Text menu replies (support both RU and UZ button labels)
  bot.hears(['📦 Каталог', '📦 Katalog'], (ctx) => handleCatalog(ctx, 1));
  bot.hears(['🛒 Корзина', '🛒 Savatcha'], handleViewCart);
  bot.hears(['📋 Мои заказы', '📋 Buyurtmalarim'], handleOrders);
  bot.hears(['ℹ️ О магазине', "ℹ️ Do'kon haqida"], async (ctx) => {
    const locale = ctx.locale;
    const info = ctx.tenant.themeConfig?.description || t(locale, 'store_info.default');
    await ctx.reply(`${t(locale, 'store_info.title')}\n\n${info}`, { parse_mode: 'HTML' });
  });
  bot.hears(['🌐 Язык', '🌐 Til'], (ctx) => handleLanguageSelection(ctx));

  // Callback queries
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data === 'noop') {
      await ctx.answerCallbackQuery();
      return;
    }

    // Language selection callbacks
    if (data === 'lang:ru' || data === 'lang:uz') {
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

    await ctx.answerCallbackQuery();
  });

  return bot;
}
