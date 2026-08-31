import { Bot, session } from 'grammy';
import { BotContext, SessionData, TenantInfo, CartItem } from './types.js';
import { getTenantDb } from '@telegram-commerce/database';
import { handleStart } from './handlers/start.js';
import { handleCatalog } from './handlers/catalog.js';
import { handleAddToCart, handleViewCart, handleCartCheckout } from './handlers/cart.js';
import { handleOrders } from './handlers/orders.js';
import { handleWebApp } from './handlers/webapp.js';

export interface CreateTenantBotOptions {
  tenant: TenantInfo;
  botToken: string;
}

/**
 * Creates and configures a dynamic grammY Bot instance for a specific tenant.
 */
export function createTenantBot(options: CreateTenantBotOptions): Bot<BotContext> {
  const { tenant, botToken } = options;
  const bot = new Bot<BotContext>(botToken);

  // In-memory session middleware
  bot.use(
    session({
      initial: (): SessionData => ({
        cart: [],
        catalogPage: 1,
      }),
    })
  );

  // Inject tenant and tenant-isolated database into context
  bot.use(async (ctx, next) => {
    ctx.tenant = tenant;
    ctx.db = getTenantDb(tenant.id);
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
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `
🤖 <b>Store Navigation Help</b>

• /start - Welcome message & main menu
• /catalog - Browse available products
• /cart - View and manage your shopping cart
• /orders - Check status of your recent orders
• /webapp - Launch interactive Storefront App
`.trim(),
      { parse_mode: 'HTML' }
    );
  });

  // Text menu replies
  bot.hears('📦 Catalog', (ctx) => handleCatalog(ctx, 1));
  bot.hears('🛒 Cart', handleViewCart);
  bot.hears('📋 My Orders', handleOrders);
  bot.hears('ℹ️ Store Info', async (ctx) => {
    const info = ctx.tenant.themeConfig?.description || 'Premium Telegram Commerce Storefront';
    await ctx.reply(`ℹ️ <b>Store Information</b>\n\n${info}`, { parse_mode: 'HTML' });
  });

  // Callback queries
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data === 'noop') {
      await ctx.answerCallbackQuery();
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
