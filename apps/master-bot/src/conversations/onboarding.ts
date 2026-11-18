import { type Conversation } from '@grammyjs/conversations';
import { type Context, InlineKeyboard } from 'grammy';
import bcrypt from 'bcryptjs';
import { prisma, SubscriptionStatus } from '@telegram-commerce/database';
import {
  DEFAULT_THEME_CONFIG,
  encryptBotToken,
  generateWebhookSecret,
  getEnv,
  isHttpsUrl,
  isSafeTelegramUrl,
  PLATFORM_PAYNET_QR_URL,
  PLAN_TIERS,
  type PlanTier,
} from '@telegram-commerce/config';
import {
  buildSubConfirmCallback,
  escapeHtml,
  generateInvoiceNumber,
  generateStrongPassword,
  getPlanDetails,
  getSuperAdminTelegramId,
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
    variants: ['S', 'M', 'L', 'XL'],
    images: ['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80'],
  },
  {
    title: 'Базовая футболка Heavyweight Cotton',
    description: 'Премиальный плотный узбекский хлопок 240г/м². Идеальная свободная посадка, не теряет форму.',
    price: 190000,
    stock: 50,
    category: 'Apparel',
    variants: ['S', 'M', 'L'],
    images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'],
  },
  {
    title: 'Кожаные кроссовки Classic Street Low',
    description: 'Натуральная матовая телячья кожа, анатомическая стелька и износостойкая подошва.',
    price: 650000,
    stock: 20,
    category: 'Footwear',
    variants: ['40', '41', '42', '43'],
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'],
  },
  {
    title: 'Кепка-бейсболка вышитая "Toshkent"',
    description: '100% саржевый хлопок, металлическая застежка-регулятор, плотный козырек.',
    price: 140000,
    stock: 45,
    category: 'Accessories',
    variants: ['One Size'],
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

async function verifyTelegramBotAndSetWebhook(
  tenantId: string,
  botToken: string,
  plan: PlanTier
): Promise<{
  ok: boolean;
  step?: 'getMe' | 'setWebhook';
  error?: string;
  botUsername?: string;
  webhookSecret?: string;
}> {
  const env = getEnv();
  const trimmedToken = botToken.trim();

  try {
    const meRes = await fetch(`https://api.telegram.org/bot${trimmedToken}/getMe`);
    const meData = (await meRes.json().catch(() => ({}))) as any;

    if (!meRes.ok || !meData?.ok || !meData?.result?.username) {
      return {
        ok: false,
        step: 'getMe',
        error: meData?.description || 'Неверный токен бота от @BotFather.',
      };
    }

    const botUsername = String(meData.result.username);
    const webhookSecret = generateWebhookSecret();
    const baseApiUrl = env.PUBLIC_API_URL.replace(/\/+$/, '');
    const webhookUrl = `${baseApiUrl}/api/v1/webhooks/telegram/${tenantId}`;

    const hookRes = await fetch(`https://api.telegram.org/bot${trimmedToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
      }),
    });
    const hookData = (await hookRes.json().catch(() => ({}))) as any;

    if (!hookRes.ok || hookData?.ok !== true) {
      return {
        ok: false,
        step: 'setWebhook',
        botUsername,
        error:
          hookData?.description ||
          hookRes.statusText ||
          `HTTP ${hookRes.status}: Telegram не принял webhook ${webhookUrl}`,
      };
    }

    // Non-critical bot commands & menu button setup
    await fetch(`https://api.telegram.org/bot${trimmedToken}/setMyCommands`, {
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
    }).catch(() => {});

    const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=${tenantId}`;
    if (
      (plan === PLAN_TIERS.PRO_30 || plan === PLAN_TIERS.STANDALONE_LIFETIME) &&
      isHttpsUrl(miniappUrl)
    ) {
      await fetch(`https://api.telegram.org/bot${trimmedToken}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_button: {
            type: 'web_app',
            text: '🛍️ Открыть магазин',
            web_app: { url: miniappUrl },
          },
        }),
      }).catch(() => {});
    }

    return {
      ok: true,
      botUsername,
      webhookSecret,
    };
  } catch (err: any) {
    return {
      ok: false,
      step: 'setWebhook',
      error: err?.message || 'Ошибка соединения с Telegram Bot API',
    };
  }
}

async function sendLiveBotTestNotification(
  botToken: string,
  botUsername: string,
  telegramUserId: string,
  storeName: string
): Promise<{ sent: boolean; error?: string }> {
  if (!telegramUserId || !/^\d+$/.test(telegramUserId)) {
    return { sent: false, error: 'Telegram ID владельца не указан' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramUserId,
        text:
          `✅ <b>Бот @${escapeHtml(botUsername)} успешно подключён к магазину «${escapeHtml(storeName)}»!</b>\n\n` +
          `Сюда будут приходить мгновенные уведомления о новых заказах и чеках покупателей.`,
        parse_mode: 'HTML',
      }),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || data?.ok !== true) {
      return { sent: false, error: data?.description || `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (err: any) {
    return { sent: false, error: err?.message || 'network error' };
  }
}

export async function onboardingConversation(conversation: MasterConversation, ctx: MasterContext) {
  const env = getEnv();
  const telegramUserId = ctx.from?.id ? String(ctx.from.id) : '';
  const cancelKeyboard = new InlineKeyboard().text('❌ Отменить настройку', 'onboard:cancel');

  // Check if user entered onboarding via /start bind_... or "Connect/Update Bot" from /login
  const bindTenantId = await conversation.external((outerCtx: any) => {
    const id = outerCtx?.session?.bindTenantId as string | undefined;
    if (outerCtx?.session) {
      outerCtx.session.bindTenantId = undefined;
    }
    return id || null;
  });

  if (bindTenantId) {
    const existingTenant = await conversation.external(() =>
      prisma.tenant.findUnique({
        where: { id: bindTenantId },
        include: {
          botConfig: true,
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      })
    );

    if (!existingTenant) {
      await ctx.reply('⚠️ Магазин для привязки не найден. Создайте новый магазин через /newstore.');
      return;
    }

    if (
      existingTenant.owner_telegram_id &&
      existingTenant.owner_telegram_id !== '' &&
      existingTenant.owner_telegram_id !== telegramUserId
    ) {
      await ctx.reply('⛔ Этот магазин уже привязан к другому Telegram-аккаунту.');
      return;
    }

    const planDetails = getPlanDetails(existingTenant.plan as PlanTier);
    const subStatus =
      existingTenant.subscriptions?.[0]?.status || (existingTenant as any).subscription_status;

    await ctx.reply(
      `
🤖 <b>Подключение бота для магазина «${escapeHtml(existingTenant.name)}»</b>
━━━━━━━━━━━━━━━━━━━━
📦 <b>Тариф:</b> ${planDetails.labels.ru}
📌 <b>Статус подписки:</b> <code>${escapeHtml(String(subStatus || 'PENDING_PAYMENT'))}</code>

<b>Отправьте API-токен вашего бота от @BotFather:</b>
1. Откройте @BotFather в Telegram и отправьте /newbot (или /mybots → API Token).
2. Скопируйте токен (например, <code>123456789:ABCdef...</code>) и отправьте сюда.

<i>(Отправьте /cancel для отмены)</i>
`.trim(),
      { parse_mode: 'HTML', reply_markup: cancelKeyboard }
    );

    let botToken = '';
    let botUsername = '';
    let webhookSecret = '';

    while (true) {
      const tokenMsg = await conversation.waitFor(':text');
      const inputToken = tokenMsg.message?.text?.trim() || '';

      if (isExitCommand(inputToken)) {
        await ctx.reply('❌ <b>Подключение бота отменено.</b>\n\nВведите /start для возврата в меню.', {
          parse_mode: 'HTML',
        });
        return;
      }

      await ctx.reply('🔍 <i>Проверяем токен через Telegram API и регистрируем webhook...</i>', {
        parse_mode: 'HTML',
      });

      const verifyRes = await conversation.external(() =>
        verifyTelegramBotAndSetWebhook(
          existingTenant.id,
          inputToken,
          existingTenant.plan as PlanTier
        )
      );

      if (verifyRes.ok && verifyRes.botUsername && verifyRes.webhookSecret) {
        botToken = inputToken;
        botUsername = verifyRes.botUsername;
        webhookSecret = verifyRes.webhookSecret;
        break;
      }

      const failHeadline =
        verifyRes.step === 'setWebhook'
          ? '⚠️ <b>Не удалось настроить webhook для бота!</b>'
          : '❌ <b>Неверный токен бота.</b>';
      await ctx.reply(
        `${failHeadline}\n\n` +
          `<b>Причина:</b> <code>${escapeHtml(verifyRes.error || 'Unknown error')}</code>\n` +
          `Магазин пока <b>не запущен</b>. Проверьте токен или настройки домена API и отправьте токен снова (или /cancel):`,
        { parse_mode: 'HTML', reply_markup: cancelKeyboard }
      );
    }

    const result = await conversation.external(async () => {
      const encryptedToken = encryptBotToken(botToken);
      const existingTheme = ((existingTenant.botConfig?.theme_config as Record<string, any>) || {});
      const safeThemeConfig = {
        ...DEFAULT_THEME_CONFIG,
        ...existingTheme,
        storeName: existingTheme.storeName || existingTenant.name,
        description:
          existingTheme.description || `Официальный Telegram-магазин ${existingTenant.name}`,
        // NEVER copy platform Paynet QR into a merchant store
        paynetEnabled: false,
        paynetQrUrl: '',
      };

      await prisma.botConfig.upsert({
        where: { tenant_id: existingTenant.id },
        create: {
          tenant_id: existingTenant.id,
          bot_token_encrypted: encryptedToken,
          bot_username: botUsername,
          webhook_secret: webhookSecret,
          is_active: false,
          currency: 'UZS',
          theme_config: safeThemeConfig,
        },
        update: {
          bot_token_encrypted: encryptedToken,
          bot_username: botUsername,
          webhook_secret: webhookSecret,
          is_active: false,
          theme_config: safeThemeConfig,
        },
      });

      // Create draft starter products (is_active: false) only if none exist yet
      const existingCount = await prisma.product.count({
        where: { tenant_id: existingTenant.id },
      });
      if (existingCount === 0) {
        await prisma.product.createMany({
          data: STARTER_PRODUCTS.map((item) => ({
            tenant_id: existingTenant.id,
            title: item.title,
            description: item.description,
            price: item.price as any,
            stock: item.stock,
            category: item.category,
            variants: [...item.variants] as any,
            images: [...item.images],
            is_active: false,
          })),
        });
      }

      // Ensure an open invoice exists if subscription isn't active/in-review yet
      let sub = existingTenant.subscriptions?.[0] || null;
      if (!sub) {
        sub = await prisma.subscription.create({
          data: {
            tenant_id: existingTenant.id,
            plan: existingTenant.plan as any,
            invoice_number: generateInvoiceNumber(),
            amount_uzs: planDetails.priceUzs,
            status: SubscriptionStatus.PENDING_PAYMENT as any,
          },
        });
      }

      const testAlert = await sendLiveBotTestNotification(
        botToken,
        botUsername,
        telegramUserId,
        existingTenant.name
      );

      return { sub, testAlert, seededDrafts: existingCount === 0 };
    });

    const adminUrl = env.PUBLIC_ADMIN_URL;
    const keyboard = new InlineKeyboard();
    if (isSafeTelegramUrl(adminUrl)) {
      keyboard.url('⚙️ Открыть панель магазина (/admin/)', adminUrl).row();
    }
    keyboard.url(`🤖 Открыть бота @${botUsername}`, `https://t.me/${botUsername}`).row();
    if (result.sub && result.sub.status === SubscriptionStatus.PENDING_PAYMENT) {
      keyboard
        .url('⚡ Оплатить тариф в Paynet', PLATFORM_PAYNET_QR_URL)
        .row()
        .text('✅ Я оплатил тариф', buildSubConfirmCallback(result.sub.id));
    }

    const testNotice = result.testAlert.sent
      ? `✅ <b>Тестовое уведомление отправлено</b> от лица @${escapeHtml(botUsername)}!`
      : `📲 <b>Важно:</b> Откройте вашего бота @${escapeHtml(botUsername)} и нажмите <b>/start</b>, чтобы Telegram разрешил боту присылать вам заказы!`;

    const invoiceNote =
      result.sub && result.sub.status === SubscriptionStatus.PENDING_PAYMENT
        ? `\n📄 <b>Счёт на оплату тарифа:</b> <code>${escapeHtml(result.sub.invoice_number || result.sub.id.slice(0, 8))}</code> (${planDetails.priceUzsFormatted})`
        : '';

    await ctx.reply(
      `
✅ <b>БОТ @${escapeHtml(botUsername)} ПОДКЛЮЧЁН И WEBHOOK АКТИВЕН!</b>
━━━━━━━━━━━━━━━━━━━━
🏪 <b>Магазин:</b> ${escapeHtml(existingTenant.name)}
📦 <b>Статус витрины:</b> 🟡 Черновик (не опубликована)
${result.seededDrafts ? '🛍️ <b>Стартовые товары:</b> Добавлено 4 черновика товаров (<code>is_active: false</code>)\n' : ''}💳 <b>Оплата Paynet:</b> Отключена до загрузки вашего собственного Paynet QR
${testNotice}${invoiceNote}

<b>Что нужно сделать перед запуском продаж:</b>
1. Перейдите в панель управления <code>${escapeHtml(adminUrl)}</code>
2. Загрузите ваш <b>Paynet QR-Online</b>, укажите юр. данные и контакт поддержки
3. Активируйте товары и нажмите <b>«Опубликовать витрину»</b>!
`.trim(),
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
    return;
  }

  // Standard /newstore Telegram-native creation flow
  await ctx.reply(
    `
🚀 <b>Мастер создания интернет-магазина в Telegram</b>

Настроим ваш магазин шаг за шагом.
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
<b>Шаг 2 из 4:</b> Выберите тариф подписки:
1. Отправьте <code>1</code> — <b>Базовый чат-бот ($20/мес · 255 000 сум)</b>
2. Отправьте <code>2</code> — <b>Pro Mini App витрина ($30/мес · 385 000 сум)</b>

<i>🏢 Для Standalone VPS под ключ обратитесь к менеджеру / в поддержку платформы.</i>
`.trim(),
    { parse_mode: 'HTML', reply_markup: cancelKeyboard }
  );

  let selectedPlan: PlanTier = PLAN_TIERS.PRO_30;
  while (true) {
    const planMsg = await conversation.waitFor(':text');
    const planChoice = planMsg.message?.text?.trim() || '';

    if (isExitCommand(planChoice)) {
      await ctx.reply('❌ <b>Создание магазина отменено.</b>\n\nВведите /start для возврата в главное меню.', {
        parse_mode: 'HTML',
      });
      return;
    }

    if (planChoice === '1' || planChoice.toLowerCase() === 'basic') {
      selectedPlan = PLAN_TIERS.BASIC_20;
      break;
    }
    if (planChoice === '2' || planChoice.toLowerCase() === 'pro') {
      selectedPlan = PLAN_TIERS.PRO_30;
      break;
    }
    if (planChoice === '3' || planChoice.toLowerCase().includes('standalone')) {
      await ctx.reply(
        '🏢 <b>Standalone VPS</b> не оформляется автоматически — для этого напишите менеджеру платформы.\n\nПожалуйста, выберите тариф <code>1</code> (Basic) или <code>2</code> (Pro Mini App):',
        { parse_mode: 'HTML', reply_markup: cancelKeyboard }
      );
      continue;
    }

    await ctx.reply('⚠️ Пожалуйста, отправьте <code>1</code> (Basic) или <code>2</code> (Pro Mini App):', {
      parse_mode: 'HTML',
      reply_markup: cancelKeyboard,
    });
  }

  await ctx.reply(
    `
<b>Шаг 3 из 4:</b> Введите ваш Email для входа в панель управления магазином:
<i>(Или отправьте /cancel для отмены)</i>
`.trim(),
    { parse_mode: 'HTML', reply_markup: cancelKeyboard }
  );

  let adminEmail = '';
  while (true) {
    const emailMsg = await conversation.waitFor(':text');
    const adminEmailRaw = emailMsg.message?.text?.trim() || '';

    if (isExitCommand(adminEmailRaw)) {
      await ctx.reply('❌ <b>Создание магазина отменено.</b>\n\nВведите /start для возврата в главное меню.', {
        parse_mode: 'HTML',
      });
      return;
    }

    const normalized = adminEmailRaw.toLowerCase();
    if (!normalized.includes('@') || !normalized.includes('.')) {
      await ctx.reply('⚠️ Введите корректный Email (например: <code>owner@shop.uz</code>):', {
        parse_mode: 'HTML',
        reply_markup: cancelKeyboard,
      });
      continue;
    }

    const existingUser = await conversation.external(() =>
      prisma.adminUser.findFirst({ where: { email: normalized } })
    );
    if (existingUser) {
      await ctx.reply(
        `⚠️ Email <code>${escapeHtml(normalized)}</code> уже зарегистрирован.\n\nВведите другой Email для нового магазина или выйдите (/cancel) и используйте /login для привязки существующего магазина:`,
        { parse_mode: 'HTML', reply_markup: cancelKeyboard }
      );
      continue;
    }

    adminEmail = normalized;
    break;
  }

  await ctx.reply(
    `
<b>Шаг 4 из 4:</b> Введите API-токен бота от <b>@BotFather</b>.

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

    const meCheck = await conversation.external(async () => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${inputToken}/getMe`);
        const data = (await res.json().catch(() => ({}))) as any;
        if (res.ok && data?.ok && data?.result?.username) {
          return { ok: true, username: String(data.result.username) };
        }
        return { ok: false, error: data?.description || 'Invalid token' };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Network error' };
      }
    });

    if (meCheck.ok && meCheck.username) {
      botToken = inputToken;
      botUsername = meCheck.username;
      break;
    }

    await ctx.reply(
      `❌ <b>Неверный токен бота:</b> <code>${escapeHtml(meCheck.error || 'getMe failed')}</code>\nПерепроверьте токен от @BotFather и отправьте еще раз (или /cancel):`,
      { parse_mode: 'HTML', reply_markup: cancelKeyboard }
    );
  }

  await ctx.reply('⚙️ <i>Создаем профиль магазина и регистрируем webhook в Telegram...</i>', {
    parse_mode: 'HTML',
  });

  const setupOutcome = await conversation.external(async () => {
    const tempPassword = generateStrongPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const encryptedToken = encryptBotToken(botToken);
    const planDetails = getPlanDetails(selectedPlan);
    const invoiceNumber = generateInvoiceNumber();

    // 1. Create Tenant draft (PENDING_PAYMENT, unpublished BotConfig is_active: false, paynetEnabled: false)
    const tenant = await prisma.tenant.create({
      data: {
        name: storeName,
        owner_telegram_id: telegramUserId,
        plan: selectedPlan as any,
        subscription_status: SubscriptionStatus.PENDING_PAYMENT as any,
        is_active: true,
        adminUsers: {
          create: {
            email: adminEmail,
            password_hash: passwordHash,
            role: 'OWNER',
          },
        },
        subscriptions: {
          create: {
            plan: selectedPlan as any,
            invoice_number: invoiceNumber,
            amount_uzs: planDetails.priceUzs,
            status: SubscriptionStatus.PENDING_PAYMENT as any,
          },
        },
      },
      include: {
        subscriptions: true,
      },
    });

    // 2. Strictly verify & register Telegram webhook BEFORE creating BotConfig & starter drafts
    const webhookRes = await verifyTelegramBotAndSetWebhook(tenant.id, botToken, selectedPlan);
    if (!webhookRes.ok || !webhookRes.webhookSecret) {
      // Clean up unfinished tenant so broken unverified store doesn't linger
      await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
      return {
        ok: false as const,
        error: webhookRes.error || 'setWebhook failed',
      };
    }

    await prisma.botConfig.create({
      data: {
        tenant_id: tenant.id,
        bot_token_encrypted: encryptedToken,
        bot_username: botUsername,
        webhook_secret: webhookRes.webhookSecret,
        is_active: false,
        currency: 'UZS',
        theme_config: {
          ...DEFAULT_THEME_CONFIG,
          storeName,
          primaryColor: '#1a6fd4',
          currency: 'UZS',
          currencySymbol: "so'm",
          description: `Официальный Telegram-магазин ${storeName}`,
          paynetEnabled: false,
          paynetQrUrl: '',
        },
      },
    });

    // 3. Create 4 starter products as drafts (is_active: false)
    await prisma.product.createMany({
      data: STARTER_PRODUCTS.map((item) => ({
        tenant_id: tenant.id,
        title: item.title,
        description: item.description,
        price: item.price as any,
        stock: item.stock,
        category: item.category,
        variants: [...item.variants] as any,
        images: [...item.images],
        is_active: false,
      })),
    });

    const testAlert = await sendLiveBotTestNotification(
      botToken,
      botUsername,
      telegramUserId,
      storeName
    );

    return {
      ok: true as const,
      tenant,
      subscription: tenant.subscriptions[0],
      tempPassword,
      planDetails,
      invoiceNumber,
      testAlert,
    };
  });

  if (!setupOutcome.ok) {
    await ctx.reply(
      `❌ <b>Не удалось настроить webhook для @${escapeHtml(botUsername)}!</b>\n\n` +
        `<b>Ошибка Telegram API:</b> <code>${escapeHtml(setupOutcome.error)}</code>\n\n` +
        `Магазин <b>не создан и не запущен</b>. Проверьте доступность домена <code>${escapeHtml(env.PUBLIC_API_URL)}</code> и повторите /newstore.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const { tenant, subscription, tempPassword, planDetails, invoiceNumber, testAlert } = setupOutcome;
  const adminPanelUrl = env.PUBLIC_ADMIN_URL;

  const launchKeyboard = new InlineKeyboard()
    .url('⚡ Оплатить тариф в Paynet', PLATFORM_PAYNET_QR_URL)
    .row()
    .text('✅ Я оплатил тариф', buildSubConfirmCallback(subscription.id))
    .row();

  if (isSafeTelegramUrl(adminPanelUrl)) {
    launchKeyboard.url('⚙️ Открыть панель магазина (/admin/)', adminPanelUrl).row();
  }
  launchKeyboard.url(`🤖 Открыть бота @${botUsername}`, `https://t.me/${botUsername}`);

  // Notify Superadmin about the newly registered draft store
  const superAdminId = getSuperAdminTelegramId();
  const ownerUsername = ctx.from?.username ? `@${escapeHtml(ctx.from.username)}` : 'без @username';
  const superadminNotice = `
🏪 <b>НОВЫЙ МАГАЗИН ЗАРЕГИСТРИРОВАН (ЧЕРНОВИК)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Магазин:</b> ${escapeHtml(storeName)}
🤖 <b>Бот:</b> @${escapeHtml(botUsername)}
💳 <b>Тариф:</b> ${planDetails.labels.ru} ($${planDetails.priceUsd} · ${planDetails.priceUzsFormatted})
📄 <b>Счёт:</b> <code>${escapeHtml(invoiceNumber)}</code> (<code>PENDING_PAYMENT</code>)
📧 <b>Email:</b> <code>${escapeHtml(adminEmail)}</code>
👤 <b>Владелец ID:</b> <code>${escapeHtml(telegramUserId || 'unknown')}</code> (${ownerUsername})
🆔 <b>Tenant ID:</b> <code>${tenant.id}</code>
`.trim();

  try {
    await ctx.api.sendMessage(superAdminId, superadminNotice, { parse_mode: 'HTML' });
  } catch (notifyErr) {
    console.warn(`Non-critical: failed to send new store alert to superadmin ${superAdminId}:`, notifyErr);
  }

  const testNotice = testAlert.sent
    ? `✅ <b>Тестовое уведомление отправлено</b> от @${escapeHtml(botUsername)}!`
    : `📲 <b>Важно:</b> Откройте бота @${escapeHtml(botUsername)} и нажмите <b>/start</b>, чтобы Telegram разрешил отправку уведомлений о заказах!`;

  await ctx.reply(
    `
✅ <b>БОТ @${escapeHtml(botUsername)} ПОДКЛЮЧЁН (ЧЕРНОВИК МАГАЗИНА)!</b>
━━━━━━━━━━━━━━━━━━━━
🏪 <b>Магазин:</b> ${escapeHtml(storeName)}
💳 <b>Тариф:</b> ${planDetails.labels.ru} ($${planDetails.priceUsd}/${planDetails.periodLabels.ru} · ${planDetails.priceUzsFormatted})
📄 <b>Счёт:</b> <code>${escapeHtml(invoiceNumber)}</code> (ожидает оплаты)
📦 <b>Стартовые товары:</b> 4 черновика товаров добавлены (<code>is_active: false</code>)
🌐 <b>Витрина:</b> 🟡 Черновик (не опубликована)
💼 <b>Панель управления:</b> ${escapeHtml(adminPanelUrl)}

🔐 <b>Ваши данные для входа в Admin-панель:</b>
 • <b>Email:</b> <code>${escapeHtml(adminEmail)}</code>
 • <b>Пароль:</b> <code>${escapeHtml(tempPassword)}</code>

${testNotice}

⚡ <b>Следующие шаги перед приёмом заказов:</b>
1. Оплатите счёт <code>${escapeHtml(invoiceNumber)}</code> через Paynet и нажмите «✅ Я оплатил тариф».
2. Войдите в <code>${escapeHtml(adminPanelUrl)}</code>, загрузите ваш <b>Paynet QR-Online</b>, заполните юр. реквизиты и поддержку, активируйте товары и нажмите «Опубликовать».
`.trim(),
    { parse_mode: 'HTML', reply_markup: launchKeyboard }
  );
}
