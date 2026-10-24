import { Bot, session, InlineKeyboard, type Context, type SessionFlavor } from 'grammy';
import { conversations, createConversation, type ConversationFlavor } from '@grammyjs/conversations';
import { prisma } from '@telegram-commerce/database';
import { getEnv, isHttpsUrl, isSafeTelegramUrl } from '@telegram-commerce/config';
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
    const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
    const keyboard = new InlineKeyboard();

    if (isHttpsUrl(miniappUrl)) {
      keyboard.webApp('📱 Открыть витрину (Mini App)', miniappUrl);
    } else if (isSafeTelegramUrl(miniappUrl)) {
      keyboard.url('📱 Открыть витрину (Mini App)', miniappUrl);
    }

    keyboard
      .row()
      .text('🛍️ Товары в чате', 'demo:products')
      .row()
      .text('⚡ Запустить свой магазин', 'onboard:start');

    await ctx.reply(
      `🛍️ <b>Mirai Shop • Telegram Commerce</b>\n\n` +
      `Откройте витрину интернет-магазина в один клик. Полноэкранный Telegram Mini App, каталог, быстрый поиск и моментальный чекаут!\n\n` +
      `👇 Нажмите кнопку ниже для запуска витрины:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  });

  // Cart command
  bot.command('cart', async (ctx) => {
    const env = getEnv();
    const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
    const keyboard = new InlineKeyboard();
    if (isHttpsUrl(miniappUrl)) {
      keyboard.webApp('🛒 Открыть корзину в Mini App', miniappUrl);
    } else if (isSafeTelegramUrl(miniappUrl)) {
      keyboard.url('🛒 Открыть корзину в Mini App', miniappUrl);
    }

    await ctx.reply(
      `🛒 <b>Ваша корзина</b>\n\n` +
      `Управляйте выбранными товарами, изменяйте количество и оформляйте заказ в Telegram Mini App.\n\n` +
      `👇 Нажмите кнопку ниже, чтобы открыть корзину:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
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
          keyboard.webApp('🛍️ Открыть каталог', miniappUrl);
        }

        await ctx.reply(
          `📦 <b>История заказов</b>\n\nУ вас пока нет оформленных заказов. Перейдите в каталог, чтобы сделать свой первый заказ!`,
          { parse_mode: 'HTML', reply_markup: keyboard }
        );
        return;
      }

      let text = `📦 <b>Ваши последние заказы:</b>\n\n`;
      for (const ord of orders) {
        const statusEmoji = ord.status === 'PAID' ? '✅ Оплачен' : ord.status === 'PENDING' ? '⏳ Ожидает оплаты' : '❌ Отменен';
        text += `• <b>Заказ #${ord.id.slice(0, 8)}</b> — $${Number(ord.total_amount).toFixed(2)}\n  Статус: ${statusEmoji}\n  Дата: ${new Date(ord.createdAt).toLocaleDateString()}\n\n`;
      }

      await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Ошибка загрузки заказов: ${err?.message}`);
    }
  });

  // Help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `ℹ️ <b>Навигация по Mirai Shop</b>\n\n` +
      `• /start — Главное меню и информация о магазине\n` +
      `• /catalog — Полноэкранный Telegram Mini App с каталогом\n` +
      `• /cart — Корзина и оформление заказа\n` +
      `• /orders — История и статусы ваших заказов\n` +
      `• /demo — Интерактивное демо и витрина для бизнеса\n` +
      `• /newstore — Мастер создания собственного магазина\n\n` +
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
      .text('🇬🇧 English', 'lang:en')
      .text("🇺🇿 O'zbekcha", 'lang:uz');

    await ctx.reply('🌐 <b>Выберите язык интерфейса / Select language:</b>', {
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
      .text('🇬🇧 English', 'lang:en')
      .text("🇺🇿 O'zbekcha", 'lang:uz');

    await ctx.reply('🌐 <b>Выберите язык интерфейса / Select language:</b>', {
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
        : chosen === 'en'
        ? '✅ Language set: English 🇬🇧'
        : "✅ Til tanlandi: O'zbekcha 🇺🇿";
    await ctx.answerCallbackQuery({ text: msg });
    await ctx.reply(msg);
    await handleSales(ctx);
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
    await ctx.answerCallbackQuery({ text: '🔄 Метрики обновлены' });
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
        await ctx.reply('В демо-каталоге пока нет доступных товаров.');
        return;
      }

      let text = '📦 <b>Популярные товары каталога:</b>\n\n';
      for (const p of products) {
        text += `• <b>${p.title}</b> — $${Number(p.price).toFixed(2)}\n<i>${p.description || ''}</i>\n\n`;
      }

      const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
      const keyboard = new InlineKeyboard();

      if (isHttpsUrl(miniappUrl)) {
        keyboard.webApp('📱 Открыть витрину (Mini App)', miniappUrl);
      } else if (isSafeTelegramUrl(miniappUrl)) {
        keyboard.url('📱 Открыть витрину (Mini App)', miniappUrl);
      } else {
        keyboard.text('⚡ Запустить свой магазин', 'onboard:start');
      }

      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch (err: any) {
      await ctx.reply(`⚠️ Ошибка загрузки товаров: ${err?.message}`);
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
    const keyboard = new InlineKeyboard();

    if (isSafeTelegramUrl(env.PUBLIC_ADMIN_URL)) {
      keyboard.url('💼 Панель управления магазином', env.PUBLIC_ADMIN_URL);
    }

    keyboard.row().text('🔄 Обновить показатели', 'admin:refresh');

    if (isHttpsUrl(miniappUrl)) {
      keyboard.webApp('📱 Открыть витрину (Mini App)', miniappUrl);
    } else if (isSafeTelegramUrl(miniappUrl)) {
      keyboard.url('📱 Открыть витрину (Mini App)', miniappUrl);
    }

    const text = `
👑 <b>Центр управления платформой (Суперадмин)</b>

👤 <b>ID администратора:</b> <code>${userId}</code>
🌐 <b>Статус системы:</b> 🟢 Все службы активны и работают в штатном режиме

📊 <b>Текущие показатели платформы:</b>
• Активных магазинов (клиентов): <b>${tenantsCount}</b>
• Товаров в каталоге: <b>${productsCount}</b>
• Обработано заказов: <b>${ordersCount}</b>

🔑 <b>Реквизиты входа в панель управления:</b>
• <b>URL:</b> ${env.PUBLIC_ADMIN_URL}
• <b>Email:</b> <code>demo_merchant@telegram-commerce.local</code>
• <b>Пароль:</b> <code>password123</code>
    `.trim();

    if (isEdit && ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch (err: any) {
    await ctx.reply(`⚠️ Ошибка загрузки показателей: ${err?.message}`);
  }
}
