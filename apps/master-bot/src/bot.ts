import { Bot, session, InlineKeyboard, type Context, type SessionFlavor } from 'grammy';
import { conversations, createConversation, type ConversationFlavor } from '@grammyjs/conversations';
import { prisma } from '@telegram-commerce/database';
import { getEnv } from '@telegram-commerce/config';
import { handleSales } from './handlers/sales.js';
import { handleDemo } from './handlers/demo.js';
import { onboardingConversation } from './conversations/onboarding.js';

export type MasterBotContext = ConversationFlavor<Context & SessionFlavor<Record<string, any>>>;

export function createMasterBot(token: string): Bot<MasterBotContext> {
  const bot = new Bot<MasterBotContext>(token);

  bot.use(session({ initial: () => ({}) }));
  bot.use(conversations());
  bot.use(createConversation(onboardingConversation as any, 'onboardingConversation'));

  bot.command('start', handleSales);
  bot.command('demo', handleDemo);
  bot.command('newstore', async (ctx) => {
    await ctx.conversation.enter('onboardingConversation');
  });

  // Direct Catalog / Shop Commands
  bot.command(['catalog', 'shop'], async (ctx) => {
    const env = getEnv();
    const keyboard = new InlineKeyboard()
      .webApp('📱 Open Mini App Store', `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`)
      .row()
      .text('🛍️ View Demo Products', 'demo:products')
      .row()
      .text('⚡ Launch My Store', 'onboard:start');

    await ctx.reply(
      `🛍️ <b>Demo Storefront — Cyberpunk Apparel & Gear</b>\n\n` +
      `Test out the customer purchasing experience: browse the live catalog, add items to cart, and checkout.\n\n` +
      `👇 Tap below to launch the Telegram Mini App or view items:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  });

  // Platform Superadmin Control Center
  bot.command('admin', async (ctx) => {
    await sendAdminDashboard(ctx);
  });

  // Callbacks
  bot.callbackQuery('demo:view', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleDemo(ctx);
  });

  bot.callbackQuery('onboard:start', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('onboardingConversation');
  });

  bot.callbackQuery('admin:refresh', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '🔄 Updated' });
    await sendAdminDashboard(ctx, true);
  });

  bot.callbackQuery('demo:products', async (ctx) => {
    await ctx.answerCallbackQuery();
    const env = getEnv();
    const demoTenantId = env.STANDALONE_TENANT_ID || '00000000-0000-0000-0000-000000000001';

    try {
      const products = await prisma.product.findMany({
        where: { tenant_id: demoTenantId, is_active: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      if (products.length === 0) {
        await ctx.reply('No products found in demo catalog yet.');
        return;
      }

      let text = '📦 <b>Featured Catalog Products:</b>\n\n';
      for (const p of products) {
        text += `• <b>${p.title}</b> — $${Number(p.price).toFixed(2)}\n<i>${p.description}</i>\n\n`;
      }

      const keyboard = new InlineKeyboard()
        .webApp('📱 Open Store Mini App', `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`);

      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch (err: any) {
      await ctx.reply(`⚠️ Could not load products: ${err?.message}`);
    }
  });

  bot.catch((err) => {
    console.error('[Master Bot Error]:', err.error);
  });

  return bot;
}

async function sendAdminDashboard(ctx: Context, isEdit = false) {
  const userId = String(ctx.from?.id);
  const env = getEnv();
  const superAdminId = env.STANDALONE_ADMIN_TELEGRAM_ID || '8240936731';

  if (userId !== superAdminId && userId !== '8240936731') {
    await ctx.reply('⛔ <b>Access Denied:</b> This command is restricted to the platform superadmin.', {
      parse_mode: 'HTML',
    });
    return;
  }

  try {
    const [tenantsCount, productsCount, ordersCount] = await Promise.all([
      prisma.tenant.count(),
      prisma.product.count(),
      prisma.order.count(),
    ]);

    const keyboard = new InlineKeyboard()
      .url('💼 Open Merchant Admin Backoffice', env.PUBLIC_ADMIN_URL)
      .row()
      .text('🔄 Refresh Metrics', 'admin:refresh')
      .webApp('📱 Open Store Mini App', `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`);

    const text = `
👑 <b>Platform Superadmin Control Center</b>

👤 <b>Superadmin ID:</b> <code>${userId}</code>
🌐 <b>System Status:</b> 🟢 Operational & Online

📊 <b>Live Platform Metrics:</b>
• Active Stores (Tenants): <b>${tenantsCount}</b>
• Catalog Products: <b>${productsCount}</b>
• Processed Orders: <b>${ordersCount}</b>

🔑 <b>Merchant Admin Credentials:</b>
• <b>URL:</b> ${env.PUBLIC_ADMIN_URL}
• <b>Email:</b> <code>demo_merchant@telegram-commerce.local</code>
• <b>Password:</b> <code>password123</code>
    `.trim();

    if (isEdit && ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch (err: any) {
    await ctx.reply(`⚠️ Failed to load admin metrics: ${err?.message}`);
  }
}
