import { Bot, session, InlineKeyboard, type Context, type SessionFlavor } from 'grammy';
import { conversations, createConversation, type ConversationFlavor } from '@grammyjs/conversations';
import { prisma } from '@telegram-commerce/database';
import { getEnv, isHttpsUrl, isSafeTelegramUrl } from '@telegram-commerce/config';
import { handleSales } from './handlers/sales.js';
import { handleDemo } from './handlers/demo.js';
import { onboardingConversation } from './conversations/onboarding.js';
import {
  handleChatBotDemoCatalog,
  handleChatBotDemoAddToCart,
  handleChatBotDemoViewCart,
  handleChatBotDemoCheckout,
} from './handlers/chatBotDemo.js';

export type MasterBotContext = ConversationFlavor<Context & SessionFlavor<Record<string, any>>>;

export function createMasterBot(token: string): Bot<MasterBotContext> {
  const bot = new Bot<MasterBotContext>(token);

  bot.use(session({ initial: () => ({}) }));
  bot.use(conversations());
  bot.use(createConversation(onboardingConversation as any, 'onboardingConversation'));

  // Start command always resets any stuck conversation and shows the main sales/demo menu
  bot.command('start', async (ctx) => {
    try {
      await ctx.conversation?.exit('onboardingConversation');
    } catch {}
    await handleSales(ctx);
  });

  bot.command('cancel', async (ctx) => {
    try {
      await ctx.conversation?.exit('onboardingConversation');
    } catch {}
    await ctx.reply('❌ <b>Действие отменено.</b>\n\nВведите /start для возврата в главное меню.', {
      parse_mode: 'HTML',
    });
  });

  bot.command('demo', async (ctx) => {
    try {
      await ctx.conversation?.exit('onboardingConversation');
    } catch {}
    await handleDemo(ctx);
  });

  bot.command('botdemo', async (ctx) => {
    try {
      await ctx.conversation?.exit('onboardingConversation');
    } catch {}
    await handleChatBotDemoCatalog(ctx, 0);
  });

  bot.command('newstore', async (ctx) => {
    await ctx.conversation.enter('onboardingConversation');
  });

  // Direct Catalog / Shop Commands
  bot.command(['catalog', 'shop'], async (ctx) => {
    const env = getEnv();
    const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
    const keyboard = new InlineKeyboard();

    if (isHttpsUrl(miniappUrl)) {
      keyboard.webApp('📱 Открыть витрину (Mini App)', miniappUrl);
    } else if (isSafeTelegramUrl(miniappUrl)) {
      keyboard.url('📱 Открыть витрину (Mini App)', miniappUrl);
    }

    keyboard
      .row()
      .text('🤖 Демо обычного бота в чате', 'chatdemo:catalog')
      .row()
      .text('⚡ Запустить свой магазин', 'onboard:start');

    await ctx.reply(
      `🛍️ <b>MODA Tashkent • Telegram Commerce</b>\n\n` +
      `Откройте витрину интернет-магазина в один клик. Полноэкранный Telegram Mini App, каталог, быстрый поиск и моментальный чекаут!\n\n` +
      `👇 Нажмите кнопку ниже для запуска витрины:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  });

  // Cart command
  bot.command('cart', async (ctx) => {
    await handleChatBotDemoViewCart(ctx);
  });

  // Orders inquiry
  bot.command('orders', async (ctx) => {
    const userId = String(ctx.from?.id);
    try {
      const orders = await prisma.order.findMany({
        where: { customer_telegram_id: userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      if (orders.length === 0) {
        const env = getEnv();
        const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
        const keyboard = new InlineKeyboard();
        if (isHttpsUrl(miniappUrl)) {
          keyboard.webApp('🛍️ Открыть каталог (Mini App)', miniappUrl);
        }
        keyboard.row().text('🤖 Каталог в чате', 'chatdemo:catalog');

        await ctx.reply(
          `📦 <b>История заказов</b>\n\nУ вас пока нет оформленных заказов. Перейдите в каталог, чтобы сделать свой первый заказ!`,
          { parse_mode: 'HTML', reply_markup: keyboard }
        );
        return;
      }

      let text = `📦 <b>Ваши последние заказы:</b>\n\n`;
      for (const ord of orders) {
        const statusEmoji =
          ord.status === 'PAID'
            ? '✅ Оплачен'
            : ord.status === 'PENDING'
            ? '⏳ Ожидает оплаты'
            : ord.status === 'DELIVERED'
            ? '🚚 Доставлен'
            : '❌ Отменен';
        text += `• <b>Заказ #${ord.id.slice(0, 8)}</b> — ${new Intl.NumberFormat('ru-RU').format(Number(ord.total_amount))} сум\n  Статус: ${statusEmoji}\n  Дата: ${new Date(ord.createdAt).toLocaleDateString()}\n\n`;
      }

      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Ошибка загрузки заказов: ${err?.message}`);
    }
  });

  // Help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `ℹ️ <b>Навигация по платформе</b>\n\n` +
      `• /start — Главное меню и выбор демо-версий\n` +
      `• /catalog — Полноэкранный Telegram Mini App\n` +
      `• /botdemo — Демо обычного бота с покупками прямо в чате\n` +
      `• /cart — Корзина и оформление заказа\n` +
      `• /orders — История и статусы ваших заказов\n` +
      `• /newstore — Создать свой магазин за 2 минуты\n\n` +
      `💬 По вопросам поддержки: обратитесь к администратору магазина.`,
      { parse_mode: 'HTML' }
    );
  });

  // Platform Superadmin Control Center
  bot.command('admin', async (ctx) => {
    await sendAdminDashboard(ctx);
  });

  // Language switcher command
  bot.command('lang', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text('🇷🇺 Русский (Основной)', 'lang:ru')
      .row()
      .text("🇺🇿 O'zbekcha", 'lang:uz')
      .text('🇬🇧 English', 'lang:en');

    await ctx.reply('🌐 <b>Выберите язык интерфейса / Tilni tanlang / Select language:</b>', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  });

  // Callbacks for language
  bot.callbackQuery('lang:select', async (ctx) => {
    await ctx.answerCallbackQuery();
    const keyboard = new InlineKeyboard()
      .text('🇷🇺 Русский (Основной)', 'lang:ru')
      .row()
      .text("🇺🇿 O'zbekcha", 'lang:uz')
      .text('🇬🇧 English', 'lang:en');

    await ctx.reply('🌐 <b>Выберите язык интерфейса / Tilni tanlang:</b>', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  });

  bot.callbackQuery(['lang:ru', 'lang:en', 'lang:uz'], async (ctx) => {
    const chosen = ctx.callbackQuery.data.replace('lang:', '');
    (ctx.session as any).lang = chosen;
    const msg =
      chosen === 'ru'
        ? '✅ Язык установлен: Русский 🇷🇺'
        : chosen === 'uz'
        ? "✅ Til tanlandi: O'zbekcha 🇺🇿"
        : '✅ Language set: English 🇬🇧';
    await ctx.answerCallbackQuery({ text: msg });
    await ctx.reply(msg);
    await handleSales(ctx);
  });

  // Callbacks for Main Navigation
  bot.callbackQuery('demo:view', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleDemo(ctx);
  });

  bot.callbackQuery('onboard:start', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('onboardingConversation');
  });

  bot.callbackQuery('onboard:cancel', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Создание магазина отменено' });
    try {
      await ctx.conversation?.exit('onboardingConversation');
    } catch {}
    await handleSales(ctx);
  });

  bot.callbackQuery('admin:refresh', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '🔄 Метрики обновлены' });
    await sendAdminDashboard(ctx, true);
  });

  // --- Interactive Chat Bot Demo Handlers ---
  bot.callbackQuery('chatdemo:catalog', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleChatBotDemoCatalog(ctx, 0, false);
  });

  bot.callbackQuery(/^chatdemo:nav:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = parseInt(ctx.match[1], 10);
    await handleChatBotDemoCatalog(ctx, page, true);
  });

  bot.callbackQuery(/^chatdemo:add:(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    await handleChatBotDemoAddToCart(ctx, productId);
  });

  bot.callbackQuery('chatdemo:cart', async (ctx) => {
    await handleChatBotDemoViewCart(ctx);
  });

  bot.callbackQuery('chatdemo:clear', async (ctx) => {
    (ctx.session as any).chatDemoCart = [];
    await ctx.answerCallbackQuery({ text: '🗑️ Корзина очищена' });
    await handleChatBotDemoViewCart(ctx);
  });

  bot.callbackQuery('chatdemo:checkout', async (ctx) => {
    await handleChatBotDemoCheckout(ctx);
  });

  bot.callbackQuery('chatdemo:menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleSales(ctx);
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
    await ctx.reply('⛔ <b>Доступ запрещен:</b> Эта команда доступна только главному администратору платформы.', {
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

    const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
    const keyboard = new InlineKeyboard()
      .text('🔄 Обновить метрики', 'admin:refresh')
      .row();

    if (isHttpsUrl(miniappUrl)) {
      keyboard.webApp('📱 Открыть витрину (Mini App)', miniappUrl);
    }

    const text = `
👑 <b>Mirai Commerce • Главная панель владельца</b>
━━━━━━━━━━━━━━━━━━━━
📊 <b>Общая статистика:</b>
 • Всего магазинов: <b>${tenantsCount}</b>
 • Всего товаров: <b>${productsCount}</b>
 • Всего заказов: <b>${ordersCount}</b>

💼 <b>Панель управления:</b> ${env.PUBLIC_ADMIN_URL}
🌐 <b>Витрина Mini App:</b> ${miniappUrl}
`.trim();

    if (isEdit && ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch (err: any) {
    await ctx.reply(`⚠️ Ошибка загрузки панели: ${err?.message}`);
  }
}
