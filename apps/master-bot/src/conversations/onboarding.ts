import { type Conversation } from '@grammyjs/conversations';
import { type Context, InlineKeyboard } from 'grammy';
import bcrypt from 'bcryptjs';
import { prisma } from '@telegram-commerce/database';
import {
  DEFAULT_PAYNET_QR_URL,
  DEFAULT_THEME_CONFIG,
  encryptBotToken,
  generateWebhookSecret,
  getEnv,
  isHttpsUrl,
  PLAN_TIERS,
  type PlanTier,
} from '@telegram-commerce/config';
import {
  buildSubConfirmCallback,
  escapeHtml,
  getPeriodEndForPlan,
  getPlanDetails,
} from '../utils.js';

type MasterContext = Context;
type MasterConversation = Conversation<MasterContext>;

const STARTER_PRODUCTS = [
  {
    title: 'Оверсайз худи Tashkent Edition',
    description: 'Плотный премиальный футер 420г/м² из 100% узбекского хлопка пенье. Мягкий начес, глубокий капюшон.',
    price: 420000,
    stock: 35,
    category: 'Apparel',
    images: ['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80'],
  },
  {
    title: 'Базовая футболка Heavyweight Cotton',
    description: 'Премиальный плотный узбекский хлопок 240г/м². Идеальная свободная посадка, не теряет форму.',
    price: 190000,
    stock: 50,
    category: 'Apparel',
    images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'],
  },
  {
    title: 'Кожаные кроссовки Classic Street Low',
    description: 'Натуральная матовая телячья кожа, анатомическая стелька и износостойкая подошва.',
    price: 650000,
    stock: 20,
    category: 'Footwear',
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'],
  },
  {
    title: 'Кепка-бейсболка вышитая "Toshkent"',
    description: '100% саржевый хлопок, металлическая застежка-регулятор, плотный козырек.',
    price: 140000,
    stock: 45,
    category: 'Accessories',
    images: ['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80'],
  },
] as const;

function isExitCommand(text?: string): boolean {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  return (
    t === '/start' ||
    t === '/cancel' ||
    t === 'отмена' ||
    t === '/stop' ||
    t === 'cancel' ||
    t === 'выход' ||
    t.startsWith('/start')
  );
}

export async function onboardingConversation(conversation: MasterConversation, ctx: MasterContext) {
  const env = getEnv();
  const telegramUserId = ctx.from?.id ? String(ctx.from.id) : '';

  const cancelKeyboard = new InlineKeyboard().text('❌ Отменить создание магазина', 'onboard:cancel');

  await ctx.reply(
    `
🚀 <b>Мастер создания интернет-магазина в Telegram</b>

Настроим ваш автоматизированный магазин менее чем за 2 минуты!
<i>(Отправьте /cancel или нажмите кнопку ниже в любой момент для отмены)</i>

<b>Шаг 1 из 4:</b> Как называется ваш магазин или бренд?
<i>(Например: MODA Tashkent, Samarkand Silk, Электроника 24)</i>
`.trim(),
    { parse_mode: 'HTML', reply_markup: cancelKeyboard }
  );

  const nameMsg = await conversation.waitFor(':text');
  const storeNameRaw = nameMsg.message?.text?.trim() || '';

  if (isExitCommand(storeNameRaw)) {
    await ctx.reply('❌ <b>Создание магазина отменено.</b>\n\nВведите /start для возврата в главное меню.', {
      parse_mode: 'HTML',
    });
    return;
  }

  const storeName = storeNameRaw || 'Мой Магазин';

  await ctx.reply(
    `
<b>Шаг 2 из 4:</b> Введите API-токен бота от <b>@BotFather</b>.

1. Откройте @BotFather в Telegram.
2. Отправьте команду /newbot и следуйте шагам для получения токена.
3. Отправьте полученный токен в этот чат (например, <code>123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ</code>):

<i>(Или отправьте /cancel для отмены)</i>
`.trim(),
    { parse_mode: 'HTML', reply_markup: cancelKeyboard }
  );

  let botToken = '';
  let botUsername = '';

  while (true) {
    const tokenMsg = await conversation.waitFor(':text');
    const inputToken = tokenMsg.message?.text?.trim() || '';

    if (isExitCommand(inputToken)) {
      await ctx.reply('❌ <b>Создание магазина отменено.</b>\n\nВведите /start для возврата в главное меню.', {
        parse_mode: 'HTML',
      });
      return;
    }

    await ctx.reply('🔍 <i>Проверяем токен через Telegram Bot API...</i>', { parse_mode: 'HTML' });

    try {
      const res = await fetch(`https://api.telegram.org/bot${inputToken}/getMe`);
      const data = (await res.json()) as any;

      if (data.ok && data.result?.username) {
        botToken = inputToken;
        botUsername = data.result.username;
        break;
      }
    } catch {
      // API call failure
    }

    await ctx.reply(
      '❌ <b>Неверный токен бота.</b> Пожалуйста, перепроверьте токен от @BotFather и отправьте еще раз (или /cancel для отмены):',
      { parse_mode: 'HTML', reply_markup: cancelKeyboard }
    );
  }

  await ctx.reply(
    `
✅ <b>Бот подтвержден:</b> @${escapeHtml(botUsername)}

<b>Шаг 3 из 4:</b> Выберите тариф подписки:
1. Отправьте <code>1</code> — <b>Базовый чат-бот ($20/мес · 255 000 сум)</b>
2. Отправьте <code>2</code> — <b>Pro Mini App витрина ($30/мес · 385 000 сум)</b>
3. Отправьте <code>3</code> — <b>Standalone VPS Lifetime ($350 разово · 4 500 000 сум)</b>
`.trim(),
    { parse_mode: 'HTML', reply_markup: cancelKeyboard }
  );

  const planMsg = await conversation.waitFor(':text');
  const planChoice = planMsg.message?.text?.trim() || '';

  if (isExitCommand(planChoice)) {
    await ctx.reply('❌ <b>Создание магазина отменено.</b>\n\nВведите /start для возврата в главное меню.', {
      parse_mode: 'HTML',
    });
    return;
  }

  let selectedPlan: PlanTier = PLAN_TIERS.PRO_30;
  if (planChoice === '1') {
    selectedPlan = PLAN_TIERS.BASIC_20;
  } else if (planChoice === '2') {
    selectedPlan = PLAN_TIERS.PRO_30;
  } else if (planChoice === '3') {
    selectedPlan = PLAN_TIERS.STANDALONE_LIFETIME;
  }

  await ctx.reply(
    `
<b>Шаг 4 из 4:</b> Введите ваш Email для входа в панель управления магазином:
<i>(Или отправьте /cancel для отмены)</i>
`.trim(),
    { parse_mode: 'HTML', reply_markup: cancelKeyboard }
  );

  const emailMsg = await conversation.waitFor(':text');
  const adminEmailRaw = emailMsg.message?.text?.trim() || '';

  if (isExitCommand(adminEmailRaw)) {
    await ctx.reply('❌ <b>Создание магазина отменено.</b>\n\nВведите /start для возврата в главное меню.', {
      parse_mode: 'HTML',
    });
    return;
  }

  const adminEmail = adminEmailRaw || `merchant_${Date.now()}@telegram-commerce.local`;

  // Generate temporary password
  const tempPassword = `Pass_${Math.random().toString(36).substring(2, 10)}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await ctx.reply('⚙️ <i>Создаем базу данных магазина, шифруем ключи и настраиваем вебхуки...</i>', {
    parse_mode: 'HTML',
  });

  try {
    const encryptedToken = encryptBotToken(botToken);
    const webhookSecret = generateWebhookSecret();
    const periodEnd = getPeriodEndForPlan(selectedPlan);
    const planDetails = getPlanDetails(selectedPlan);

    // 1. Create Tenant, BotConfig, Owner AdminUser, and initial Subscription
    const tenant = await prisma.tenant.create({
      data: {
        name: storeName,
        owner_telegram_id: telegramUserId,
        plan: selectedPlan as any,
        is_active: true,
        botConfig: {
          create: {
            bot_token_encrypted: encryptedToken,
            bot_username: botUsername,
            webhook_secret: webhookSecret,
            currency: 'UZS',
            theme_config: {
              ...DEFAULT_THEME_CONFIG,
              storeName,
              primaryColor: '#1a6fd4',
              currency: 'UZS',
              currencySymbol: "so'm",
              description: `Официальный Telegram-магазин ${storeName}`,
              paynetEnabled: true,
              paynetQrUrl: DEFAULT_PAYNET_QR_URL,
            },
          },
        },
        adminUsers: {
          create: {
            email: adminEmail,
            password_hash: passwordHash,
            role: 'OWNER',
          },
        },
        subscriptions: {
          create: {
            status: 'ACTIVE',
            current_period_end: periodEnd,
          },
        },
      },
    });

    // 2. Seed 4 starter products so the store is immediately ready to demo/test
    await prisma.product.createMany({
      data: STARTER_PRODUCTS.map((item) => ({
        tenant_id: tenant.id,
        title: item.title,
        description: item.description,
        price: item.price as any,
        stock: item.stock,
        category: item.category,
        images: [...item.images],
        is_active: true,
      })),
    });

    // 3. Set Webhook and Bot Commands on Telegram API
    const webhookUrl = `${env.PUBLIC_API_URL}/api/v1/webhooks/${tenant.id}`;
    await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${webhookSecret}`
    );

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'start', description: '🚀 Главная витрина' },
            { command: 'catalog', description: '🛍️ Каталог товаров' },
            { command: 'cart', description: '🛒 Корзина' },
            { command: 'orders', description: '📦 Мои заказы' },
            { command: 'webapp', description: '📱 Открыть Mini App' },
            { command: 'lang', description: '🌐 Язык / Til / Language' },
            { command: 'help', description: 'ℹ️ Помощь' },
          ],
        }),
      });
    } catch (cmdErr) {
      console.warn(`Non-critical: failed to setMyCommands for @${botUsername}:`, cmdErr);
    }

    // 4. Set Chat Menu Button if plan includes Mini App
    const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=${tenant.id}`;
    if (
      (selectedPlan === PLAN_TIERS.PRO_30 || selectedPlan === PLAN_TIERS.STANDALONE_LIFETIME) &&
      isHttpsUrl(miniappUrl)
    ) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_button: {
              type: 'web_app',
              text: '🛍️ Открыть магазин',
              web_app: { url: miniappUrl },
            },
          }),
        });
      } catch (menuErr) {
        console.warn(`Non-critical: failed to setChatMenuButton for @${botUsername}:`, menuErr);
      }
    }

    const adminPanelUrl = `${env.PUBLIC_ADMIN_URL}`;
    const launchKeyboard = new InlineKeyboard()
      .url('⚡ Оплатить тариф в Paynet', DEFAULT_PAYNET_QR_URL)
      .row()
      .text('✅ Я оплатил тариф', buildSubConfirmCallback(tenant.id, selectedPlan))
      .row();

    if (
      (selectedPlan === PLAN_TIERS.PRO_30 || selectedPlan === PLAN_TIERS.STANDALONE_LIFETIME) &&
      isHttpsUrl(miniappUrl)
    ) {
      launchKeyboard.webApp('📱 Открыть витрину Mini App', miniappUrl).row();
    }
    launchKeyboard.url(`🤖 Открыть бота @${botUsername}`, `https://t.me/${botUsername}`);

    // 5. Notify Superadmin about the newly created store
    const superAdminId = env.STANDALONE_ADMIN_TELEGRAM_ID || '8240936731';
    const ownerUsername = ctx.from?.username ? `@${escapeHtml(ctx.from.username)}` : 'без @username';
    const superadminNotice = `
🏪 <b>СОЗДАН НОВЫЙ МАГАЗИН НА ПЛАТФОРМЕ!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Магазин:</b> ${escapeHtml(storeName)}
🤖 <b>Бот:</b> @${escapeHtml(botUsername)}
💳 <b>Тариф:</b> ${planDetails.labels.ru} ($${planDetails.priceUsd} · ${planDetails.priceUzsFormatted})
📧 <b>Email:</b> <code>${escapeHtml(adminEmail)}</code>
👤 <b>Владелец ID:</b> <code>${escapeHtml(telegramUserId || 'unknown')}</code> (${ownerUsername})
🆔 <b>Tenant ID:</b> <code>${tenant.id}</code>
`.trim();

    try {
      await ctx.api.sendMessage(superAdminId, superadminNotice, { parse_mode: 'HTML' });
    } catch (notifyErr) {
      console.warn(`Non-critical: failed to send new store alert to superadmin ${superAdminId}:`, notifyErr);
    }

    await ctx.reply(
      `
🎉 <b>ПОЗДРАВЛЯЕМ! ВАШ МАГАЗИН ЗАПУЩЕН!</b>

🏪 <b>Магазин:</b> ${escapeHtml(storeName)}
🤖 <b>Бот магазина для покупателей:</b> @${escapeHtml(botUsername)}
💳 <b>Выбранный тариф:</b> ${planDetails.labels.ru} ($${planDetails.priceUsd}/${planDetails.periodLabels.ru} · ${planDetails.priceUzsFormatted})
📦 <b>Стартовый каталог:</b> 4 готовых товара уже добавлены для быстрого старта!
🌐 <b>Витрина (Mini App):</b> ${miniappUrl}
💼 <b>Веб-панель управления:</b> ${adminPanelUrl}

🔐 <b>Ваши данные для входа в панель:</b>
 • <b>Email:</b> <code>${escapeHtml(adminEmail)}</code>
 • <b>Пароль:</b> <code>${escapeHtml(tempPassword)}</code>

⚡ <i>Оплатите тариф через Paynet QR-Online и нажмите «✅ Я оплатил тариф», либо сразу откройте бота @${escapeHtml(botUsername)} для тестирования!</i>
`.trim(),
      { parse_mode: 'HTML', reply_markup: launchKeyboard }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Ошибка создания магазина: ${escapeHtml(err?.message || 'Неизвестная ошибка')}. Пожалуйста, обратитесь в поддержку.`);
  }
}
