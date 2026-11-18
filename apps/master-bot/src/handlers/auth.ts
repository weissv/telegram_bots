import bcrypt from 'bcryptjs';
import { InlineKeyboard, type Context } from 'grammy';
import { prisma } from '@telegram-commerce/database';
import { getEnv, isSafeTelegramUrl, PLAN_TIERS, type PlanTier } from '@telegram-commerce/config';
import { escapeHtml, generateStrongPassword, restoreUuid } from '../utils.js';
import { handlePricingPlanSelect } from './pricing.js';

function formatSubStatus(status?: string | null): string {
  switch (status) {
    case 'ACTIVE':
      return '🟢 Активна (ACTIVE)';
    case 'TRIALING':
      return '🟢 Пробный период (TRIALING)';
    case 'PENDING_REVIEW':
      return '🔍 На проверке (PENDING_REVIEW)';
    case 'PAST_DUE':
      return '🔴 Приостановлена (PAST_DUE)';
    case 'CANCELED':
      return '⛔ Отменена (CANCELED)';
    default:
      return '⏳ Ожидает оплаты (PENDING_PAYMENT)';
  }
}

export async function findTenantsByTelegramOwner(telegramUserId: string) {
  if (!telegramUserId) return [];
  return prisma.tenant.findMany({
    where: { owner_telegram_id: telegramUserId },
    orderBy: { createdAt: 'desc' },
    include: {
      botConfig: true,
      adminUsers: {
        select: { id: true, email: true, role: true },
      },
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

function buildStoreListKeyboard(tenants: any[], actionPrefix: 'store:select' | 'store:resetpw'): InlineKeyboard {
  const env = getEnv();
  const keyboard = new InlineKeyboard();

  for (const t of tenants) {
    const compactId = String(t.id).replace(/-/g, '');
    const botLabel = t.botConfig?.bot_username ? `@${t.botConfig.bot_username}` : 'без бота';
    const prefixIcon = actionPrefix === 'store:resetpw' ? '🔑' : '🏪';
    keyboard.text(`${prefixIcon} ${t.name.slice(0, 20)} (${botLabel})`, `${actionPrefix}:${compactId}`).row();
  }

  if (actionPrefix === 'store:select') {
    keyboard.text('🔗 Привязать магазин по Email', 'auth:link_email').row();
    if (isSafeTelegramUrl(env.PUBLIC_ADMIN_URL)) {
      keyboard.url('💼 Открыть Admin-панель', env.PUBLIC_ADMIN_URL).row();
    }
  }

  return keyboard;
}

export async function handleLoginCommand(ctx: Context) {
  const env = getEnv();
  const userId = ctx.from?.id ? String(ctx.from.id) : '';
  if (!userId) {
    await ctx.reply('⚠️ Не удалось определить ваш Telegram ID.');
    return;
  }

  const tenants = await findTenantsByTelegramOwner(userId);

  if (tenants.length === 0) {
    const keyboard = new InlineKeyboard()
      .text('🔗 Войти по Email и паролю', 'auth:link_email')
      .row()
      .text('🚀 Создать новый магазин', 'onboard:start');

    if (isSafeTelegramUrl(env.PUBLIC_ADMIN_URL)) {
      keyboard.row().url('💼 Веб-панель (Admin)', env.PUBLIC_ADMIN_URL);
    }

    await ctx.reply(
      `🔐 <b>Вход в личный кабинет продавца</b>\n\n` +
        `К вашему Telegram ID (<code>${escapeHtml(userId)}</code>) ещё не привязан ни один магазин.\n\n` +
        `Если вы уже регистрировались на сайте — нажмите <b>«🔗 Войти по Email и паролю»</b>, чтобы привязать магазин к Telegram.`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
    return;
  }

  const lines = tenants.map((t: any, idx: number) => {
    const botHandle = t.botConfig?.bot_username
      ? `@${escapeHtml(t.botConfig.bot_username)}`
      : '<i>бот не подключён</i>';
    const email = t.adminUsers?.[0]?.email ? escapeHtml(t.adminUsers[0].email) : '—';
    const subStatus = t.subscriptions?.[0]?.status || (t as any).subscription_status;
    return (
      `${idx + 1}. <b>${escapeHtml(t.name)}</b>\n` +
      `   🤖 Бот: ${botHandle} | 📦 Тариф: <code>${t.plan}</code>\n` +
      `   📌 Подписка: ${formatSubStatus(subStatus)}\n` +
      `   📧 Email: <code>${email}</code>`
    );
  });

  const keyboard = buildStoreListKeyboard(tenants, 'store:select');

  await ctx.reply(
    `🔐 <b>ВАШИ МАГАЗИНЫ (${tenants.length})</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${lines.join('\n\n')}\n\n` +
      `👇 <i>Выберите магазин для управления, подключения бота или сброса пароля:</i>`,
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
}

export async function handleStoreSelect(ctx: Context, rawTenantId: string) {
  const env = getEnv();
  const userId = ctx.from?.id ? String(ctx.from.id) : '';
  const tenantId = restoreUuid(rawTenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      botConfig: true,
      adminUsers: { select: { id: true, email: true, role: true } },
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!tenant || (tenant.owner_telegram_id && tenant.owner_telegram_id !== userId)) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⛔ Магазин не найден или доступ запрещён', show_alert: true });
    }
    return;
  }

  if ((ctx as any).session) {
    (ctx as any).session.activeTenantId = tenant.id;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  const compactId = tenant.id.replace(/-/g, '');
  const botHandle = tenant.botConfig?.bot_username
    ? `@${escapeHtml(tenant.botConfig.bot_username)}`
    : 'не подключён';
  const subStatus = tenant.subscriptions?.[0]?.status || (tenant as any).subscription_status;
  const email = tenant.adminUsers?.[0]?.email ? escapeHtml(tenant.adminUsers[0].email) : '—';
  const publishedStatus = tenant.botConfig?.is_active ? '🟢 Опубликована' : '🟡 Черновик (не опубликована)';

  const keyboard = new InlineKeyboard()
    .text('🤖 Подключить / обновить бота', `store:connectbot:${compactId}`)
    .row()
    .text('💳 Оплата / Продление тарифа', `store:pay:${compactId}`)
    .row()
    .text('🔑 Сбросить пароль Admin', `store:resetpw:${compactId}`)
    .row();

  if (isSafeTelegramUrl(env.PUBLIC_ADMIN_URL)) {
    keyboard.url('💼 Открыть Admin-панель', env.PUBLIC_ADMIN_URL).row();
  }
  keyboard.text('⬅️ Все мои магазины', 'auth:stores');

  await ctx.reply(
    `🏪 <b>${escapeHtml(tenant.name)}</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 <b>Бот:</b> ${botHandle}\n` +
      `🌐 <b>Витрина:</b> ${publishedStatus}\n` +
      `📦 <b>Тариф:</b> <code>${tenant.plan}</code>\n` +
      `📌 <b>Подписка:</b> ${formatSubStatus(subStatus)}\n` +
      `📧 <b>Логин Admin:</b> <code>${email}</code>\n` +
      `🆔 <b>Tenant ID:</b> <code>${tenant.id}</code>`,
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
}

export async function handleStorePayShortcut(ctx: Context, rawTenantId: string) {
  const userId = ctx.from?.id ? String(ctx.from.id) : '';
  const tenantId = restoreUuid(rawTenantId);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || (tenant.owner_telegram_id && tenant.owner_telegram_id !== userId)) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⛔ Доступ запрещён', show_alert: true });
    }
    return;
  }

  const plan: PlanTier =
    tenant.plan === PLAN_TIERS.BASIC_20 ? PLAN_TIERS.BASIC_20 : PLAN_TIERS.PRO_30;
  await handlePricingPlanSelect(ctx, plan, tenant.id);
}

export async function handleResetPasswordCommand(ctx: Context) {
  const userId = ctx.from?.id ? String(ctx.from.id) : '';
  if (!userId) {
    await ctx.reply('⚠️ Не удалось определить ваш Telegram ID.');
    return;
  }

  const tenants = await findTenantsByTelegramOwner(userId);
  if (tenants.length === 0) {
    const keyboard = new InlineKeyboard()
      .text('🔗 Войти по Email и паролю', 'auth:link_email')
      .row()
      .text('🚀 Создать магазин', 'onboard:start');

    await ctx.reply(
      `🔑 <b>Сброс пароля</b>\n\n` +
        `К вашему Telegram ID не привязано ни одного магазина.\n` +
        `Вы можете войти через /login (по Email и паролю с сайта) или создать новый магазин.`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
    return;
  }

  // If user owns multiple stores, ALWAYS show selector instead of picking findFirst blindly
  if (tenants.length > 1) {
    const keyboard = buildStoreListKeyboard(tenants, 'store:resetpw');
    await ctx.reply(
      `🔑 <b>Сброс пароля Admin-панели</b>\n\n` +
        `У вас привязано несколько магазинов (${tenants.length}). Выберите, для какого магазина сбросить пароль:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
    return;
  }

  await performPasswordResetForTenant(ctx, tenants[0].id);
}

export async function performPasswordResetForTenant(ctx: Context, rawTenantId: string) {
  const env = getEnv();
  const userId = ctx.from?.id ? String(ctx.from.id) : '';
  const tenantId = restoreUuid(rawTenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      adminUsers: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!tenant || !tenant.owner_telegram_id || tenant.owner_telegram_id !== userId) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⛔ Доступ запрещён', show_alert: true });
    } else {
      await ctx.reply('⛔ Доступ запрещён.');
    }
    return;
  }

  const ownerAdmin =
    tenant.adminUsers.find((u) => u.role === 'OWNER') || tenant.adminUsers[0];
  if (!ownerAdmin) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⚠️ Администратор магазина не найден', show_alert: true });
    } else {
      await ctx.reply('⚠️ Администратор для этого магазина не найден.');
    }
    return;
  }

  const newPassword = generateStrongPassword();
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.adminUser.update({
    where: { id: ownerAdmin.id },
    data: { password_hash: passwordHash },
  });

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: '🔑 Новый пароль сгенерирован!' });
  }

  const keyboard = new InlineKeyboard();
  if (isSafeTelegramUrl(env.PUBLIC_ADMIN_URL)) {
    keyboard.url('💼 Войти в Admin-панель', env.PUBLIC_ADMIN_URL);
  }

  await ctx.reply(
    `🔑 <b>НОВЫЙ ПАРОЛЬ ДЛЯ ВХОДА В ПАНЕЛЬ</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `🏪 <b>Магазин:</b> ${escapeHtml(tenant.name)}\n` +
      `📧 <b>Email:</b> <code>${escapeHtml(ownerAdmin.email)}</code>\n` +
      `🔐 <b>Новый пароль:</b> <code>${escapeHtml(newPassword)}</code>\n` +
      `🌐 <b>Адрес панели:</b> ${escapeHtml(env.PUBLIC_ADMIN_URL)}\n\n` +
      `⚠️ <i>Сохраните пароль в надёжном месте. Рекомендуем удалить это сообщение после входа.</i>`,
    {
      parse_mode: 'HTML',
      ...(keyboard.inline_keyboard.length > 0 ? { reply_markup: keyboard } : {}),
    }
  );
}

export async function startEmailLinkFlow(ctx: Context) {
  const session = (ctx as any).session || {};
  session.authStep = 'awaiting_email';
  session.pendingLoginEmail = undefined;
  (ctx as any).session = session;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const keyboard = new InlineKeyboard().text('❌ Отмена', 'auth:cancel');
  await ctx.reply(
    `🔗 <b>Привязка магазина по Email</b>\n\n` +
      `Введите ваш <b>Email</b>, который вы указывали при регистрации или оплате на сайте:`,
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
}

export async function handleEmailLinkTextInput(ctx: Context, next: () => Promise<void>) {
  const session = (ctx as any).session;
  const step = session?.authStep;
  if (step !== 'awaiting_email' && step !== 'awaiting_password') {
    await next();
    return;
  }

  const text = ctx.message?.text?.trim() || '';
  const lower = text.toLowerCase();
  if (lower === 'отмена' || lower === 'cancel' || lower === 'bekor qilish') {
    session.authStep = undefined;
    session.pendingLoginEmail = undefined;
    await ctx.reply('❌ Привязка аккаунта отменена.');
    return;
  }
  if (!text || text.startsWith('/')) {
    session.authStep = undefined;
    session.pendingLoginEmail = undefined;
    await next();
    return;
  }

  if (step === 'awaiting_email') {
    const email = text.toLowerCase();
    if (!email.includes('@') || !email.includes('.')) {
      await ctx.reply('⚠️ Введите корректный Email (например, <code>shop@example.com</code>) или отправьте /cancel.', {
        parse_mode: 'HTML',
      });
      return;
    }

    session.pendingLoginEmail = email;
    session.authStep = 'awaiting_password';
    const keyboard = new InlineKeyboard().text('❌ Отмена', 'auth:cancel');
    await ctx.reply(
      `🔐 Введите <b>пароль</b> от аккаунта <code>${escapeHtml(email)}</code>:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
    return;
  }

  // awaiting_password
  const email = String(session.pendingLoginEmail || '').trim().toLowerCase();
  const password = text;
  session.authStep = undefined;
  session.pendingLoginEmail = undefined;

  // Delete password message from chat history where Telegram allows
  await ctx.deleteMessage().catch(() => {});

  const userId = ctx.from?.id ? String(ctx.from.id) : '';
  if (!email || !userId) {
    await ctx.reply('⚠️ Сессия входа устарела. Запустите /login заново.');
    return;
  }

  const candidates = await prisma.adminUser.findMany({
    where: { email },
    include: {
      tenant: {
        include: {
          botConfig: true,
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  const matchedUsers: any[] = [];
  for (const candidate of candidates) {
    const ok = await bcrypt.compare(password, candidate.password_hash).catch(() => false);
    if (ok) {
      matchedUsers.push(candidate);
    }
  }

  if (matchedUsers.length === 0) {
    await ctx.reply(
      '❌ <b>Неверный Email или пароль.</b>\n\nПроверьте данные и повторите попытку через /login.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const boundTenants: any[] = [];
  const conflictStores: string[] = [];

  for (const admin of matchedUsers) {
    const tenant = admin.tenant;
    if (!tenant) continue;

    if (tenant.owner_telegram_id && tenant.owner_telegram_id !== '' && tenant.owner_telegram_id !== userId) {
      conflictStores.push(tenant.name);
      continue;
    }

    if (!tenant.owner_telegram_id || tenant.owner_telegram_id === '') {
      const updated = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { owner_telegram_id: userId },
        include: {
          botConfig: true,
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      boundTenants.push(updated);
    } else {
      boundTenants.push(tenant);
    }
  }

  if (boundTenants.length === 0) {
    await ctx.reply(
      `⛔ Магазин(ы) <b>${escapeHtml(conflictStores.join(', '))}</b> уже привязаны к другому Telegram-аккаунту.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (conflictStores.length > 0) {
    await ctx.reply(
      `⚠️ Часть магазинов (${escapeHtml(conflictStores.join(', '))}) пропущена, так как уже привязана к другому Telegram ID.`,
      { parse_mode: 'HTML' }
    );
  }

  if (boundTenants.length === 1) {
    session.activeTenantId = boundTenants[0].id;
    await ctx.reply(`✅ <b>Аккаунт ${escapeHtml(email)} успешно привязан к Telegram!</b>`, {
      parse_mode: 'HTML',
    });
    await handleStoreSelect(ctx, boundTenants[0].id);
  } else {
    await ctx.reply(`✅ <b>Привязано магазинов: ${boundTenants.length}</b>`, { parse_mode: 'HTML' });
    await handleLoginCommand(ctx);
  }
}
