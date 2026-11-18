import { Bot, session, InlineKeyboard, type Context, type SessionFlavor } from 'grammy';
import { conversations, createConversation, type ConversationFlavor } from '@grammyjs/conversations';
import { prisma } from '@telegram-commerce/database';
import {
  getEnv,
  isHttpsUrl,
  isSafeTelegramUrl,
  verifyBindToken,
  type PlanTier,
} from '@telegram-commerce/config';
import { handleSales } from './handlers/sales.js';
import { handleDemo } from './handlers/demo.js';
import {
  handleAdminSubApprove,
  handleAdminSubSuspend,
  handlePricingPlanSelect,
  handlePricingView,
  handleStandaloneInfo,
  handleSubscriptionConfirm,
} from './handlers/pricing.js';
import {
  handleEmailLinkTextInput,
  handleLoginCommand,
  handleResetPasswordCommand,
  handleStorePayShortcut,
  handleStoreSelect,
  performPasswordResetForTenant,
  startEmailLinkFlow,
} from './handlers/auth.js';
import { onboardingConversation } from './conversations/onboarding.js';
import {
  handleChatBotDemoCatalog,
  handleChatBotDemoAddToCart,
  handleChatBotDemoViewCart,
  handleChatBotDemoCheckout,
  handleChatBotDemoConfirmPay,
} from './handlers/chatBotDemo.js';
import { escapeHtml, formatUzs, getSuperAdminTelegramId, restoreUuid } from './utils.js';

export type MasterBotContext = ConversationFlavor<Context & SessionFlavor<Record<string, any>>>;

export function createMasterBot(token: string): Bot<MasterBotContext> {
  const bot = new Bot<MasterBotContext>(token);

  bot.use(session({ initial: () => ({}) }));
  bot.use(conversations());
  bot.use(createConversation(onboardingConversation as any, 'onboardingConversation'));

  // Start command resets any stuck conversation and handles bind_<hex>_<sig> deep links
  bot.command('start', async (ctx) => {
    try {
      await ctx.conversation?.exit('onboardingConversation');
    } catch {}
    (ctx.session as any).authStep = undefined;
    (ctx.session as any).pendingLoginEmail = undefined;

    const payload = typeof (ctx as any).match === 'string' ? (ctx as any).match.trim() : '';

    if (payload.startsWith('bind_')) {
      const env = getEnv();
      const callerId = ctx.from?.id ? String(ctx.from.id) : '';
      const verified = verifyBindToken(payload, env.JWT_SECRET);

      if (!verified.valid || !verified.tenantId) {
        await ctx.reply(
          '⚠️ <b>Недействительная или устаревшая ссылка привязки магазина.</b>\n\n' +
            'Используйте /login для входа по Email и паролю с сайта или /newstore для создания нового магазина.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: verified.tenantId },
        include: {
          botConfig: true,
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (!tenant) {
        await ctx.reply('⚠️ Магазин по этой ссылке не найден. Создайте новый через /newstore.');
        return;
      }

      if (
        tenant.owner_telegram_id &&
        tenant.owner_telegram_id.trim() !== '' &&
        tenant.owner_telegram_id.trim() !== callerId
      ) {
        await ctx.reply(
          '⛔ <b>Этот магазин уже привязан к другому Telegram-аккаунту.</b>\n\n' +
            'Войдите в веб-панель управления или обратитесь в поддержку платформы.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      if ((!tenant.owner_telegram_id || tenant.owner_telegram_id.trim() === '') && callerId) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { owner_telegram_id: callerId },
        });
      }

      (ctx.session as any).bindTenantId = tenant.id;
      (ctx.session as any).activeTenantId = tenant.id;

      const subStatus =
        tenant.subscriptions?.[0]?.status || (tenant as any).subscription_status || 'PENDING_PAYMENT';
      await ctx.reply(
        `✅ <b>Магазин «${escapeHtml(tenant.name)}» привязан к вашему Telegram!</b>\n` +
          `📦 <b>Тариф:</b> <code>${tenant.plan}</code>\n` +
          `📌 <b>Статус подписки:</b> <code>${escapeHtml(String(subStatus))}</code>`,
        { parse_mode: 'HTML' }
      );

      await ctx.conversation.enter('onboardingConversation');
      return;
    }

    await handleSales(ctx);
  });

  bot.command('cancel', async (ctx) => {
    try {
      await ctx.conversation?.exit('onboardingConversation');
    } catch {}
    (ctx.session as any).authStep = undefined;
    (ctx.session as any).pendingLoginEmail = undefined;
    (ctx.session as any).bindTenantId = undefined;
    await ctx.reply('❌ <b>Действие отменено.</b>\n\nВведите /start для возврата в главное меню.', {
      parse_mode: 'HTML',
    });
  });

  bot.command('login', async (ctx) => {
    try {
      await ctx.conversation?.exit('onboardingConversation');
    } catch {}
    (ctx.session as any).authStep = undefined;
    (ctx.session as any).pendingLoginEmail = undefined;
    await handleLoginCommand(ctx);
  });

  bot.command('resetpassword', async (ctx) => {
    try {
      await ctx.conversation?.exit('onboardingConversation');
    } catch {}
    (ctx.session as any).authStep = undefined;
    (ctx.session as any).pendingLoginEmail = undefined;
    await handleResetPasswordCommand(ctx);
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
    (ctx.session as any).bindTenantId = undefined;
    (ctx.session as any).authStep = undefined;
    await ctx.conversation.enter('onboardingConversation');
  });

  bot.command(['pricing', 'tariffs', 'pay'], async (ctx) => {
    try {
      await ctx.conversation?.exit('onboardingConversation');
    } catch {}
    await handlePricingView(ctx);
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
            : ord.status === 'PAYMENT_REVIEW'
              ? '🔍 Проверка оплаты'
              : ord.status === 'PENDING'
                ? '⏳ Ожидает оплаты'
                : ord.status === 'DELIVERED'
                  ? '🚚 Доставлен'
                  : ord.status === 'REFUNDED'
                    ? '↩️ Возврат'
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
        `• /login — Ваши магазины и привязка аккаунта по Email\n` +
        `• /resetpassword — Сброс пароля от Admin-панели\n` +
        `• /newstore — Подключить своего бота и создать магазин\n` +
        `• /pricing — Тарифы и оплата подписки через Paynet\n` +
        `• /catalog — Полноэкранный Telegram Mini App (демо)\n` +
        `• /demo — Интерактивные демо (Mini App и Admin)\n` +
        `• /botdemo — Демо обычного бота с покупками прямо в чате\n` +
        `• /cart — Корзина демо-бота\n` +
        `• /orders — История и статусы заказов\n\n` +
        `💬 По вопросам поддержки: обратитесь в поддержку платформы.`,
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

  // Text handler for email+password linking via /login
  bot.on('message:text', handleEmailLinkTextInput);

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

  // Callbacks for Auth & Multi-store management
  bot.callbackQuery('auth:stores', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleLoginCommand(ctx);
  });

  bot.callbackQuery('auth:link_email', async (ctx) => {
    await startEmailLinkFlow(ctx);
  });

  bot.callbackQuery('auth:cancel', async (ctx) => {
    (ctx.session as any).authStep = undefined;
    (ctx.session as any).pendingLoginEmail = undefined;
    await ctx.answerCallbackQuery({ text: 'Отменено' });
    await ctx.reply('❌ Привязка аккаунта отменена.');
  });

  bot.callbackQuery(/^store:select:([^:]+)$/, async (ctx) => {
    await handleStoreSelect(ctx, ctx.match[1]);
  });

  bot.callbackQuery(/^store:resetpw:([^:]+)$/, async (ctx) => {
    await performPasswordResetForTenant(ctx, ctx.match[1]);
  });

  bot.callbackQuery(/^store:pay:([^:]+)$/, async (ctx) => {
    await handleStorePayShortcut(ctx, ctx.match[1]);
  });

  bot.callbackQuery(/^store:connectbot:([^:]+)$/, async (ctx) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : '';
    const tenantId = restoreUuid(ctx.match[1]);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || (tenant.owner_telegram_id && tenant.owner_telegram_id !== userId)) {
      await ctx.answerCallbackQuery({ text: '⛔ Доступ запрещён', show_alert: true });
      return;
    }
    (ctx.session as any).bindTenantId = tenant.id;
    (ctx.session as any).activeTenantId = tenant.id;
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('onboardingConversation');
  });

  // Callbacks for Main Navigation & Pricing
  bot.callbackQuery('demo:view', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleDemo(ctx);
  });

  bot.callbackQuery('demo:products', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleChatBotDemoCatalog(ctx, 0, false);
  });

  bot.callbackQuery('pricing:view', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handlePricingView(ctx);
  });

  bot.callbackQuery('pricing:standalone_info', async (ctx) => {
    await handleStandaloneInfo(ctx);
  });

  bot.callbackQuery(/^pricing:plan:(BASIC_20|PRO_30|STANDALONE_LIFETIME)$/, async (ctx) => {
    await handlePricingPlanSelect(ctx, ctx.match[1] as PlanTier);
  });

  bot.callbackQuery(/^sub:confirm:([^:]+):([^:]+)$/, async (ctx) => {
    await handleSubscriptionConfirm(ctx, ctx.match[1], ctx.match[2]);
  });

  bot.callbackQuery(/^sub:confirm:([^:]+)$/, async (ctx) => {
    await handleSubscriptionConfirm(ctx, ctx.match[1]);
  });

  bot.callbackQuery(/^admin:sub:approve:([^:]+):([^:]+)$/, async (ctx) => {
    await handleAdminSubApprove(ctx, ctx.match[1], ctx.match[2]);
  });

  bot.callbackQuery(/^admin:sub:approve:([^:]+)$/, async (ctx) => {
    await handleAdminSubApprove(ctx, ctx.match[1]);
  });

  bot.callbackQuery(/^admin:sub:suspend:([^:]+)$/, async (ctx) => {
    await handleAdminSubSuspend(ctx, ctx.match[1]);
  });

  bot.callbackQuery('onboard:start', async (ctx) => {
    (ctx.session as any).bindTenantId = undefined;
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('onboardingConversation');
  });

  bot.callbackQuery('onboard:cancel', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Настройка магазина отменена' });
    (ctx.session as any).bindTenantId = undefined;
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

  bot.callbackQuery(/^chatdemo:pay:(.+)$/, async (ctx) => {
    await handleChatBotDemoConfirmPay(ctx, ctx.match[1]);
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
  const superAdminId = getSuperAdminTelegramId();

  if (userId !== superAdminId) {
    await ctx.reply('⛔ <b>Доступ запрещен:</b> Эта команда доступна только главному администратору платформы.', {
      parse_mode: 'HTML',
    });
    return;
  }

  try {
    const [tenantsCount, productsCount, ordersCount, paidOrdersAgg, latestTenants] = await Promise.all([
      prisma.tenant.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.aggregate({
        where: { status: { in: ['PAID', 'DELIVERED'] } },
        _count: { _all: true },
        _sum: { total_amount: true },
      }),
      prisma.tenant.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          botConfig: {
            select: { bot_username: true },
          },
        },
      }),
    ]);

    const paidOrdersCount = paidOrdersAgg._count._all;
    const totalRevenue = Number(paidOrdersAgg._sum.total_amount || 0);
    const latestTenantsList =
      latestTenants.length > 0
        ? latestTenants
            .map((tenant, idx) => {
              const botHandle = tenant.botConfig?.bot_username
                ? `@${escapeHtml(tenant.botConfig.bot_username)}`
                : 'бот не привязан';
              const statusIcon = tenant.is_active ? '🟢' : '🔴';
              return ` ${idx + 1}. ${statusIcon} <b>${escapeHtml(tenant.name)}</b> (${botHandle}) — <code>${tenant.plan}</code>`;
            })
            .join('\n')
        : ' Пока нет созданных магазинов.';

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
 • Оплаченных заказов: <b>${paidOrdersCount}</b>
 • Общая выручка: <b>${formatUzs(totalRevenue, 'ru')}</b>

🏪 <b>5 последних магазинов:</b>
${latestTenantsList}

💼 <b>Панель управления:</b> ${env.PUBLIC_ADMIN_URL}
🌐 <b>Витрина Mini App:</b> ${miniappUrl}
`.trim();

    if (isEdit && ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } catch (editErr: any) {
        if (!String(editErr?.message || '').includes('message is not modified')) {
          throw editErr;
        }
      }
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch (err: any) {
    await ctx.reply(`⚠️ Ошибка загрузки панели: ${escapeHtml(err?.message || 'Неизвестная ошибка')}`);
  }
}
