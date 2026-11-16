import { InlineKeyboard, type Context } from 'grammy';
import { prisma } from '@telegram-commerce/database';
import {
  DEFAULT_PAYNET_QR_URL,
  getEnv,
  PLAN_TIERS,
  type PlanTier,
} from '@telegram-commerce/config';
import {
  buildAdminSubApproveCallback,
  buildAdminSubSuspendCallback,
  buildPaynetQrImageUrl,
  escapeHtml,
  formatUzs,
  getPeriodEndForPlan,
  getPlanDetails,
  parseAdminSubCallback,
  parseSubConfirmCallback,
  resolveLang,
  type BotLang,
} from '../utils.js';

interface PricingCopy {
  overviewTitle: string;
  overviewBody: string;
  btnBasic: string;
  btnPro: string;
  btnStandalone: string;
  btnCreateStore: string;
  btnMainMenu: string;
  payBtn: string;
  confirmBtn: string;
  backBtn: string;
  selectCaption: (planTitle: string, priceUsd: number, priceUzs: string, period: string) => string;
  confirmToast: string;
  confirmReplyWithTenant: (storeName: string, planTitle: string, priceUsd: number, priceUzs: string) => string;
  confirmReplyNoTenant: (planTitle: string, priceUsd: number, priceUzs: string) => string;
}

const PRICING_COPY: Record<BotLang, PricingCopy> = {
  ru: {
    overviewTitle: '💳 <b>ТАРИФЫ И ОПЛАТА (MIRAI COMMERCE)</b>',
    overviewBody: `
Выберите подходящий тариф для запуска интернет-магазина в Telegram. Оплата принимается через <b>Paynet QR-Online (0% комиссия)</b>:

1️⃣ <b>Базовый чат-бот — $20/мес · 255 000 сум</b>
  • Интерактивный каталог прямо в чате Telegram
  • Корзина, оформление заказов и уведомления

2️⃣ <b>Pro Mini App витрина — $30/мес · 385 000 сум</b>
  • Полноэкранный Telegram Mini App + бот в чате
  • Панель управления товарами, остатками и аналитикой

3️⃣ <b>Standalone VPS Lifetime — $350 разово · 4 500 000 сум</b>
  • Полный исходный код и развертывание на вашем VPS
  • Без ежемесячных платежей навсегда

👇 <b>Нажмите на тариф, чтобы получить QR-код и ссылку для оплаты в Paynet:</b>
`.trim(),
    btnBasic: '🤖 Базовый бот · $20 / 255 000 сум',
    btnPro: '📱 Pro Mini App · $30 / 385 000 сум',
    btnStandalone: '👑 Standalone · $350 / 4 500 000 сум',
    btnCreateStore: '🚀 Создать магазин',
    btnMainMenu: '🏠 Главное меню',
    payBtn: '⚡ Оплатить в Paynet (0% комиссия)',
    confirmBtn: '✅ Я оплатил тариф',
    backBtn: '⬅️ Все тарифы',
    selectCaption: (planTitle, priceUsd, priceUzs, period) => `
💳 <b>Оплата тарифа: ${escapeHtml(planTitle)}</b>
━━━━━━━━━━━━━━━━━━━━
💰 <b>Стоимость:</b> <b>$${priceUsd}/${period} · ${priceUzs}</b>
🏦 <b>Способ оплаты:</b> Paynet QR-Online (0% комиссия)

📲 <b>Как оплатить:</b>
1. Отсканируйте QR-код выше в приложении <b>Paynet</b> или нажмите кнопку «⚡ Оплатить в Paynet» ниже.
2. Завершите перевод на сумму <b>${priceUzs}</b>.
3. Нажмите «✅ Я оплатил тариф» — администратор получит мгновенное уведомление и активирует ваш доступ.
`.trim(),
    confirmToast: '✅ Уведомление об оплате отправлено!',
    confirmReplyWithTenant: (storeName, planTitle, priceUsd, priceUzs) => `
✅ <b>УВЕДОМЛЕНИЕ ОБ ОПЛАТЕ ПОЛУЧЕНО!</b>
━━━━━━━━━━━━━━━━━━━━
🏪 <b>Магазин:</b> ${escapeHtml(storeName)}
💳 <b>Тариф:</b> ${escapeHtml(planTitle)} ($${priceUsd} · ${priceUzs})
📌 <b>Статус подписки:</b> Активирована / На проверке администратором

🔔 <i>Главный администратор получил ваше подтверждение оплаты в Telegram. Ваш магазин готов к работе!</i>
`.trim(),
    confirmReplyNoTenant: (planTitle, priceUsd, priceUzs) => `
✅ <b>УВЕДОМЛЕНИЕ ОБ ОПЛАТЕ ПОЛУЧЕНО!</b>
━━━━━━━━━━━━━━━━━━━━
💳 <b>Выбранный тариф:</b> ${escapeHtml(planTitle)} ($${priceUsd} · ${priceUzs})

🔔 <i>Администратор платформы получил ваше уведомление об оплате. Если вы еще не подключили бота магазина, нажмите «🚀 Создать магазин» ниже!</i>
`.trim(),
  },
  uz: {
    overviewTitle: "💳 <b>TARIFLAR VA TO'LOV (MIRAI COMMERCE)</b>",
    overviewBody: `
Telegramda internet-do'kon ochish uchun mos tarifni tanlang. To'lov <b>Paynet QR-Online (0% komissiya)</b> orqali qabul qilinadi:

1️⃣ <b>Bazaviy chat-bot — $20/oy · 255 000 so'm</b>
  • Telegram chatida interaktiv mahsulotlar katalogi
  • Savatcha, buyurtma rasmiylashtirish va bildirishnomalar

2️⃣ <b>Pro Mini App vitrina — $30/oy · 385 000 so'm</b>
  • To'liq ekranli Telegram Mini App + chat-bot
  • Mahsulotlar, qoldiqlar va tahlil boshqaruv paneli

3️⃣ <b>Standalone VPS Lifetime — $350 bir martalik · 4 500 000 so'm</b>
  • To'liq kod va shaxsiy VPS serverga o'rnatish
  • Oylik to'lovlarsiz umrbod foydalanish

👇 <b>Paynet QR-kod va to'lov havolasini olish uchun tarifni tanlang:</b>
`.trim(),
    btnBasic: "🤖 Bazaviy bot · $20 / 255 000 so'm",
    btnPro: "📱 Pro Mini App · $30 / 385 000 so'm",
    btnStandalone: "👑 Standalone · $350 / 4 500 000 so'm",
    btnCreateStore: "🚀 Do'kon yaratish",
    btnMainMenu: '🏠 Bosh menyu',
    payBtn: "⚡ Paynet orqali to'lash (0% komissiya)",
    confirmBtn: "✅ Men tarifni to'ladim",
    backBtn: '⬅️ Barcha tariflar',
    selectCaption: (planTitle, priceUsd, priceUzs, period) => `
💳 <b>Tarif to'lovi: ${escapeHtml(planTitle)}</b>
━━━━━━━━━━━━━━━━━━━━
💰 <b>Narxi:</b> <b>$${priceUsd}/${period} · ${priceUzs}</b>
🏦 <b>To'lov usuli:</b> Paynet QR-Online (0% komissiya)

📲 <b>Qanday to'lash kerak:</b>
1. Yuqoridagi QR-kodni <b>Paynet</b> ilovasida skanerlang yoki «⚡ Paynet orqali to'lash» tugmasini bosing.
2. <b>${priceUzs}</b> miqdorida to'lovni tasdiqlang.
3. «✅ Men tarifni to'ladim» tugmasini bosing — administratorga xabar yuboriladi va kirish faollashtiriladi.
`.trim(),
    confirmToast: "✅ To'lov haqida xabar yuborildi!",
    confirmReplyWithTenant: (storeName, planTitle, priceUsd, priceUzs) => `
✅ <b>TO'LOV HAQIDA XABAR QABUL QILINDI!</b>
━━━━━━━━━━━━━━━━━━━━
🏪 <b>Do'kon:</b> ${escapeHtml(storeName)}
💳 <b>Tarif:</b> ${escapeHtml(planTitle)} ($${priceUsd} · ${priceUzs})
📌 <b>Obuna holati:</b> Faollashtirildi / Administrator tekshiruvida

🔔 <i>Bosh administrator Telegram orqali to'lov tasdiqnomasini oldi. Do'koningiz ishlashga tayyor!</i>
`.trim(),
    confirmReplyNoTenant: (planTitle, priceUsd, priceUzs) => `
✅ <b>TO'LOV HAQIDA XABAR QABUL QILINDI!</b>
━━━━━━━━━━━━━━━━━━━━
💳 <b>Tanlangan tarif:</b> ${escapeHtml(planTitle)} ($${priceUsd} · ${priceUzs})

🔔 <i>Platforma administratori to'lovingiz haqida xabar oldi. Agar do'kon botini hali ulamagan bo'lsangiz, quyidagi «🚀 Do'kon yaratish» tugmasini bosing!</i>
`.trim(),
  },
  en: {
    overviewTitle: '💳 <b>PRICING & PAYMENT (MIRAI COMMERCE)</b>',
    overviewBody: `
Choose a plan to launch your Telegram e-commerce store. Payments are accepted via <b>Paynet QR-Online (0% fee)</b>:

1️⃣ <b>Basic Inline Bot — $20/mo · 255,000 UZS</b>
  • Interactive product catalog inside Telegram chat
  • Cart, order checkout, and instant notifications

2️⃣ <b>Pro Mini App Storefront — $30/mo · 385,000 UZS</b>
  • Fullscreen Telegram Mini App + inline chat bot
  • Admin dashboard for inventory, orders & analytics

3️⃣ <b>Standalone VPS Lifetime — $350 one-time · 4,500,000 UZS</b>
  • Self-hosted deployment on your own VPS server
  • Zero recurring monthly subscription fees

👇 <b>Select a plan below to get the Paynet QR code and payment link:</b>
`.trim(),
    btnBasic: '🤖 Basic Bot · $20 / 255 000 UZS',
    btnPro: '📱 Pro Mini App · $30 / 385 000 UZS',
    btnStandalone: '👑 Standalone · $350 / 4 500 000 UZS',
    btnCreateStore: '🚀 Create Store',
    btnMainMenu: '🏠 Main Menu',
    payBtn: '⚡ Pay with Paynet (0% fee)',
    confirmBtn: '✅ I have paid for the plan',
    backBtn: '⬅️ All Plans',
    selectCaption: (planTitle, priceUsd, priceUzs, period) => `
💳 <b>Plan Payment: ${escapeHtml(planTitle)}</b>
━━━━━━━━━━━━━━━━━━━━
💰 <b>Amount:</b> <b>$${priceUsd}/${period} · ${priceUzs}</b>
🏦 <b>Payment Method:</b> Paynet QR-Online (0% fee)

📲 <b>How to pay:</b>
1. Scan the QR code above in the <b>Paynet</b> app or tap «⚡ Pay with Paynet» below.
2. Complete the transfer of <b>${priceUzs}</b>.
3. Tap «✅ I have paid for the plan» — the platform admin will receive an instant notification.
`.trim(),
    confirmToast: '✅ Payment notification sent!',
    confirmReplyWithTenant: (storeName, planTitle, priceUsd, priceUzs) => `
✅ <b>PAYMENT NOTIFICATION RECEIVED!</b>
━━━━━━━━━━━━━━━━━━━━
🏪 <b>Store:</b> ${escapeHtml(storeName)}
💳 <b>Plan:</b> ${escapeHtml(planTitle)} ($${priceUsd} · ${priceUzs})
📌 <b>Subscription:</b> Active / Pending admin verification

🔔 <i>The platform administrator has received your payment confirmation on Telegram. Your store is ready!</i>
`.trim(),
    confirmReplyNoTenant: (planTitle, priceUsd, priceUzs) => `
✅ <b>PAYMENT NOTIFICATION RECEIVED!</b>
━━━━━━━━━━━━━━━━━━━━
💳 <b>Selected Plan:</b> ${escapeHtml(planTitle)} ($${priceUsd} · ${priceUzs})

🔔 <i>The platform administrator has been notified of your payment. If you haven't set up your store bot yet, tap «🚀 Create Store» below!</i>
`.trim(),
  },
};

export async function handlePricingView(ctx: Context) {
  const lang = resolveLang(ctx);
  const copy = PRICING_COPY[lang];

  const keyboard = new InlineKeyboard()
    .text(copy.btnBasic, `pricing:plan:${PLAN_TIERS.BASIC_20}`)
    .row()
    .text(copy.btnPro, `pricing:plan:${PLAN_TIERS.PRO_30}`)
    .row()
    .text(copy.btnStandalone, `pricing:plan:${PLAN_TIERS.STANDALONE_LIFETIME}`)
    .row()
    .text(copy.btnCreateStore, 'onboard:start')
    .text(copy.btnMainMenu, 'chatdemo:menu');

  await ctx.reply(`${copy.overviewTitle}\n\n${copy.overviewBody}`, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handlePricingPlanSelect(ctx: Context, plan: PlanTier) {
  const lang = resolveLang(ctx);
  const copy = PRICING_COPY[lang];
  const details = getPlanDetails(plan);
  const localizedPriceUzs = formatUzs(details.priceUzs, lang);
  const caption = copy.selectCaption(
    details.labels[lang],
    details.priceUsd,
    localizedPriceUzs,
    details.periodLabels[lang]
  );

  const keyboard = new InlineKeyboard()
    .url(copy.payBtn, DEFAULT_PAYNET_QR_URL)
    .row()
    .text(copy.confirmBtn, `sub:confirm:platform:${details.tier}`)
    .row()
    .text(copy.backBtn, 'pricing:view')
    .text(copy.btnCreateStore, 'onboard:start');

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  const qrImageUrl = buildPaynetQrImageUrl(DEFAULT_PAYNET_QR_URL);
  try {
    await ctx.replyWithPhoto(qrImageUrl, {
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.warn('Non-critical: failed to send Paynet QR photo, falling back to text:', err);
    await ctx.reply(caption, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
}

async function activateTenantSubscription(tenantId: string, plan: PlanTier) {
  const periodEnd = getPeriodEndForPlan(plan);

  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      plan: plan as any,
      is_active: true,
    },
  });

  const existingSub = await prisma.subscription.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { createdAt: 'desc' },
  });

  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        status: 'ACTIVE',
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        tenant_id: tenantId,
        status: 'ACTIVE',
        current_period_end: periodEnd,
      },
    });
  }

  return updatedTenant;
}

function isSuperAdminUser(ctx: Context): boolean {
  const env = getEnv();
  const superAdminId = env.STANDALONE_ADMIN_TELEGRAM_ID || '8240936731';
  const userId = ctx.from?.id ? String(ctx.from.id) : '';
  return Boolean(userId) && (userId === superAdminId || userId === '8240936731');
}

async function appendAdminActionNote(ctx: Context, noteHtml: string) {
  const message = ctx.callbackQuery?.message;
  if (!message) return;

  try {
    if (message.text !== undefined) {
      await ctx.editMessageText(`${escapeHtml(message.text)}\n\n${noteHtml}`, {
        parse_mode: 'HTML',
      });
      return;
    }
    if (message.caption !== undefined) {
      await ctx.editMessageCaption({
        caption: `${escapeHtml(message.caption)}\n\n${noteHtml}`,
        parse_mode: 'HTML',
      });
      return;
    }
  } catch (err: any) {
    if (String(err?.message || '').includes('message is not modified')) {
      return;
    }
    console.warn('Non-critical: failed to append admin action note via edit, sending reply:', err);
  }

  await ctx.reply(noteHtml, { parse_mode: 'HTML' });
}

export async function handleSubscriptionConfirm(
  ctx: Context,
  rawTenantId: string,
  rawPlan: string
) {
  const env = getEnv();
  const lang = resolveLang(ctx);
  const copy = PRICING_COPY[lang];
  const { tenantId, plan } = parseSubConfirmCallback(rawTenantId, rawPlan);
  const details = getPlanDetails(plan);
  const userId = ctx.from?.id ? String(ctx.from.id) : '';

  let targetTenant = null;
  try {
    if (tenantId !== 'platform') {
      targetTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    }
    if (!targetTenant && userId) {
      targetTenant = await prisma.tenant.findFirst({
        where: { owner_telegram_id: userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (targetTenant) {
      targetTenant = await activateTenantSubscription(targetTenant.id, plan);
    }
  } catch (dbErr) {
    console.error('Error updating tenant subscription on Paynet confirm:', dbErr);
  }

  const superAdminId = env.STANDALONE_ADMIN_TELEGRAM_ID || '8240936731';
  const usernameDisplay = ctx.from?.username ? `@${escapeHtml(ctx.from.username)}` : 'без @username';
  const fullNameDisplay = escapeHtml(
    [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ').trim() || 'Пользователь Telegram'
  );
  const storeInfoLine = targetTenant
    ? `\n🏪 <b>Магазин:</b> ${escapeHtml(targetTenant.name)} (<code>${targetTenant.id}</code>)`
    : '\n🏪 <b>Магазин:</b> еще не создан (оплата с витрины тарифов)';

  const adminAlert = `
💳 <b>ПОДТВЕРЖДЕНИЕ ОПЛАТЫ ТАРИФА (Paynet)</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Пользователь:</b> ${fullNameDisplay} (${usernameDisplay})
🆔 <b>Telegram ID:</b> <code>${escapeHtml(userId || 'unknown')}</code>
📦 <b>Тариф:</b> ${details.labels.ru} (<code>${details.tier}</code>)
💰 <b>Сумма:</b> <b>$${details.priceUsd} · ${details.priceUzsFormatted}</b>${storeInfoLine}
`.trim();

  const adminKeyboard = targetTenant
    ? new InlineKeyboard()
        .text('✅ Подтвердить тариф', buildAdminSubApproveCallback(targetTenant.id, details.tier))
        .row()
        .text('⛔ Приостановить магазин', buildAdminSubSuspendCallback(targetTenant.id))
    : undefined;

  try {
    await ctx.api.sendMessage(superAdminId, adminAlert, {
      parse_mode: 'HTML',
      ...(adminKeyboard ? { reply_markup: adminKeyboard } : {}),
    });
  } catch (notifyErr) {
    console.warn(`Non-critical: failed to send tariff confirmation to superadmin ${superAdminId}:`, notifyErr);
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: copy.confirmToast });
  }

  const localizedPriceUzs = formatUzs(details.priceUzs, lang);
  if (targetTenant) {
    const replyKeyboard = new InlineKeyboard()
      .text(copy.backBtn, 'pricing:view')
      .text(copy.btnMainMenu, 'chatdemo:menu');
    await ctx.reply(
      copy.confirmReplyWithTenant(
        targetTenant.name,
        details.labels[lang],
        details.priceUsd,
        localizedPriceUzs
      ),
      { parse_mode: 'HTML', reply_markup: replyKeyboard }
    );
  } else {
    const replyKeyboard = new InlineKeyboard()
      .text(copy.btnCreateStore, 'onboard:start')
      .row()
      .text(copy.backBtn, 'pricing:view')
      .text(copy.btnMainMenu, 'chatdemo:menu');
    await ctx.reply(
      copy.confirmReplyNoTenant(details.labels[lang], details.priceUsd, localizedPriceUzs),
      { parse_mode: 'HTML', reply_markup: replyKeyboard }
    );
  }
}

export async function handleAdminSubApprove(
  ctx: Context,
  rawTenantId: string,
  rawPlan: string
) {
  if (!isSuperAdminUser(ctx)) {
    await ctx.answerCallbackQuery({ text: '⛔ Только для главного администратора', show_alert: true });
    return;
  }

  const { tenantId, plan } = parseAdminSubCallback(rawTenantId, rawPlan);
  const details = getPlanDetails(plan);

  try {
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      await ctx.answerCallbackQuery({ text: '⚠️ Магазин не найден', show_alert: true });
      return;
    }

    const updatedTenant = await activateTenantSubscription(existing.id, plan);

    if (updatedTenant.owner_telegram_id) {
      const merchantNotice = `
✅ <b>ОПЛАТА ПОДТВЕРЖДЕНА АДМИНИСТРАТОРОМ!</b>
━━━━━━━━━━━━━━━━━━━━
🏪 <b>Магазин:</b> ${escapeHtml(updatedTenant.name)}
💳 <b>Активный тариф:</b> ${details.labels.ru} (<code>${details.tier}</code>)
💰 <b>Стоимость:</b> $${details.priceUsd}/${details.periodLabels.ru} · ${details.priceUzsFormatted}

🚀 <i>Ваш магазин и подписка полностью активированы!</i>
`.trim();

      try {
        await ctx.api.sendMessage(updatedTenant.owner_telegram_id, merchantNotice, {
          parse_mode: 'HTML',
        });
      } catch (notifyErr) {
        console.warn(`Non-critical: failed to notify merchant ${updatedTenant.owner_telegram_id}:`, notifyErr);
      }
    }

    await ctx.answerCallbackQuery({ text: '✅ Тариф подтверждён и активирован' });
    await appendAdminActionNote(
      ctx,
      `✅ <b>Подтверждено администратором:</b> тариф <code>${details.tier}</code> активирован для магазина <b>${escapeHtml(updatedTenant.name)}</b>.`
    );
  } catch (err: any) {
    console.error('Error in handleAdminSubApprove:', err);
    await ctx.answerCallbackQuery({
      text: `⚠️ Ошибка активации: ${err?.message || 'DB error'}`.slice(0, 180),
      show_alert: true,
    });
  }
}

export async function handleAdminSubSuspend(ctx: Context, rawTenantId: string) {
  if (!isSuperAdminUser(ctx)) {
    await ctx.answerCallbackQuery({ text: '⛔ Только для главного администратора', show_alert: true });
    return;
  }

  const { tenantId } = parseAdminSubCallback(rawTenantId);

  try {
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      await ctx.answerCallbackQuery({ text: '⚠️ Магазин не найден', show_alert: true });
      return;
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: existing.id },
      data: { is_active: false },
    });

    const latestSub = await prisma.subscription.findFirst({
      where: { tenant_id: existing.id },
      orderBy: { createdAt: 'desc' },
    });

    if (latestSub) {
      await prisma.subscription.update({
        where: { id: latestSub.id },
        data: { status: 'PAST_DUE' },
      });
    } else {
      await prisma.subscription.create({
        data: {
          tenant_id: existing.id,
          status: 'PAST_DUE',
        },
      });
    }

    if (updatedTenant.owner_telegram_id) {
      const merchantNotice = `
⛔ <b>РАБОТА МАГАЗИНА ПРИОСТАНОВЛЕНА</b>
━━━━━━━━━━━━━━━━━━━━
🏪 <b>Магазин:</b> ${escapeHtml(updatedTenant.name)}
📌 <b>Статус подписки:</b> Ожидает оплаты (<code>PAST_DUE</code>)

💬 <i>Для возобновления работы оплатите тариф в разделе /pricing или свяжитесь с администратором платформы.</i>
`.trim();

      try {
        await ctx.api.sendMessage(updatedTenant.owner_telegram_id, merchantNotice, {
          parse_mode: 'HTML',
        });
      } catch (notifyErr) {
        console.warn(`Non-critical: failed to notify merchant ${updatedTenant.owner_telegram_id}:`, notifyErr);
      }
    }

    await ctx.answerCallbackQuery({ text: '⛔ Магазин приостановлен' });
    await appendAdminActionNote(
      ctx,
      `⛔ <b>Приостановлено администратором:</b> магазин <b>${escapeHtml(updatedTenant.name)}</b> деактивирован (<code>PAST_DUE</code>).`
    );
  } catch (err: any) {
    console.error('Error in handleAdminSubSuspend:', err);
    await ctx.answerCallbackQuery({
      text: `⚠️ Ошибка приостановки: ${err?.message || 'DB error'}`.slice(0, 180),
      show_alert: true,
    });
  }
}
