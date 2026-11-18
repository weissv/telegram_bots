import { InlineKeyboard, type Context } from 'grammy';
import { prisma, SubscriptionStatus } from '@telegram-commerce/database';
import {
  getEnv,
  PLATFORM_PAYNET_QR_URL,
  PLAN_TIERS,
  SELF_SERVE_PLANS,
  type PlanTier,
} from '@telegram-commerce/config';
import {
  buildAdminSubApproveCallback,
  buildAdminSubSuspendCallback,
  buildPaynetQrImageUrl,
  buildSubConfirmCallback,
  computeAdditivePeriodEnd,
  escapeHtml,
  formatUzs,
  generateInvoiceNumber,
  getPlanDetails,
  getSuperAdminTelegramId,
  parseAdminSubCallback,
  parseSubConfirmCallback,
  resolveLang,
  restoreUuid,
  type BotLang,
} from '../utils.js';

interface PricingCopy {
  overviewTitle: string;
  overviewBody: (botHandle: string) => string;
  btnBasic: string;
  btnPro: string;
  btnSupportStandalone: string;
  btnCreateStore: string;
  btnMainMenu: string;
  payBtn: string;
  confirmBtn: string;
  backBtn: string;
  standaloneDisabledMsg: (botHandle: string) => string;
  selectCaption: (
    planTitle: string,
    priceUsd: number,
    priceUzs: string,
    period: string,
    invoiceNumber: string,
    storeName: string
  ) => string;
  confirmToast: string;
  confirmReplyPendingReview: (
    storeName: string,
    planTitle: string,
    priceUsd: number,
    priceUzs: string,
    invoiceNumber: string
  ) => string;
}

const PRICING_COPY: Record<BotLang, PricingCopy> = {
  ru: {
    overviewTitle: '💳 <b>ТАРИФЫ И ОПЛАТА (MIRAI COMMERCE)</b>',
    overviewBody: (_botHandle) =>
      `
Выберите подходящий тариф для запуска интернет-магазина в Telegram. Оплата принимается через <b>Paynet QR-Online (0% комиссия)</b>:

1️⃣ <b>Базовый чат-бот — $20/мес · 255 000 сум</b>
  • Интерактивный каталог прямо в чате Telegram
  • Корзина, сбор телефона/доставки и уведомления о заказах

2️⃣ <b>Pro Mini App витрина — $30/мес · 385 000 сум</b>
  • Полноэкранный Telegram Mini App + бот в чате
  • Панель управления товарами, остатками и аналитикой

🏢 <b>Standalone / Turnkey (индивидуальное внедрение на ваш VPS)</b>
  • Для развёртывания выделенной инсталляции под ключ свяжитесь с поддержкой / менеджером платформы.

👇 <b>Выберите тариф ниже для выставления счёта (INV-...) и получения Paynet QR:</b>
`.trim(),
    btnBasic: '🤖 Базовый бот · $20 / 255 000 сум',
    btnPro: '📱 Pro Mini App · $30 / 385 000 сум',
    btnSupportStandalone: '💬 Запросить Standalone у менеджера',
    btnCreateStore: '🚀 Подключить магазин',
    btnMainMenu: '🏠 Главное меню',
    payBtn: '⚡ Оплатить в Paynet (0% комиссия)',
    confirmBtn: '✅ Я оплатил тариф',
    backBtn: '⬅️ Все тарифы',
    standaloneDisabledMsg: (botHandle) =>
      `🏢 <b>Standalone VPS (под ключ)</b> оформляется индивидуально с инженером платформы.\n\nПожалуйста, напишите в поддержку / менеджеру платформы (через ${escapeHtml(botHandle)} или на сайте в разделе «Поддержка») — мы подготовим договор и развернём систему на вашем сервере.`,
    selectCaption: (planTitle, priceUsd, priceUzs, period, invoiceNumber, storeName) =>
      `
💳 <b>СЧЁТ НА ОПЛАТУ ТАРИФА</b>
━━━━━━━━━━━━━━━━━━━━
📄 <b>Номер счёта:</b> <code>${escapeHtml(invoiceNumber)}</code>
🏪 <b>Магазин:</b> ${escapeHtml(storeName)}
📦 <b>Тариф:</b> ${escapeHtml(planTitle)}
💰 <b>К оплате:</b> <b>$${priceUsd}/${period} · ${priceUzs}</b>
🏦 <b>Способ оплаты:</b> Paynet QR-Online (0% комиссия)

📲 <b>Как оплатить:</b>
1. Отсканируйте QR-код выше в приложении <b>Paynet</b> или нажмите «⚡ Оплатить в Paynet».
2. Оплатите точную сумму <b>${priceUzs}</b>.
3. Нажмите «✅ Я оплатил тариф» — заявка по счёту <code>${escapeHtml(invoiceNumber)}</code> поступит на проверку администратору.
`.trim(),
    confirmToast: '🔍 Заявка отправлена на проверку!',
    confirmReplyPendingReview: (storeName, planTitle, priceUsd, priceUzs, invoiceNumber) =>
      `
🔍 <b>ЗАЯВКА ОБ ОПЛАТЕ ОТПРАВЛЕНА НА ПРОВЕРКУ!</b>
━━━━━━━━━━━━━━━━━━━━
📄 <b>Счёт:</b> <code>${escapeHtml(invoiceNumber)}</code>
🏪 <b>Магазин:</b> ${escapeHtml(storeName)}
💳 <b>Тариф:</b> ${escapeHtml(planTitle)} ($${priceUsd} · ${priceUzs})
📌 <b>Статус:</b> На проверке администратором (<code>PENDING_REVIEW</code>)

🔔 <i>Мы отправили ваш счёт на проверку оператору. После подтверждения поступления средств ваш аккаунт и подписка автоматически активируются на +30 дней!</i>
`.trim(),
  },
  uz: {
    overviewTitle: "💳 <b>TARIFLAR VA TO'LOV (MIRAI COMMERCE)</b>",
    overviewBody: (_botHandle) =>
      `
Telegramda internet-do'kon ochish uchun tarifni tanlang. To'lov <b>Paynet QR-Online (0% komissiya)</b> orqali qabul qilinadi:

1️⃣ <b>Bazaviy chat-bot — $20/oy · 255 000 so'm</b>
  • Telegram chatida interaktiv mahsulotlar katalogi
  • Savatcha, telefon/yetkazib berish va bildirishnomalar

2️⃣ <b>Pro Mini App vitrina — $30/oy · 385 000 so'm</b>
  • To'liq ekranli Telegram Mini App + chat-bot
  • Mahsulotlar, qoldiqlar va tahlil boshqaruv paneli

🏢 <b>Standalone / Turnkey (alohida VPS serverga o'rnatish)</b>
  • Shaxsiy serverga o'rnatish uchun platforma menejeri / qo'llab-quvvatlash xizmati bilan bog'laning.

👇 <b>Hisob-faktura (INV-...) va Paynet QR olish uchun tarifni tanlang:</b>
`.trim(),
    btnBasic: "🤖 Bazaviy bot · $20 / 255 000 so'm",
    btnPro: "📱 Pro Mini App · $30 / 385 000 so'm",
    btnSupportStandalone: "💬 Menejer bilan bog'lanish (Standalone)",
    btnCreateStore: "🚀 Do'konni ulash",
    btnMainMenu: '🏠 Bosh menyu',
    payBtn: "⚡ Paynet orqali to'lash (0% komissiya)",
    confirmBtn: "✅ Men tarifni to'ladim",
    backBtn: '⬅️ Barcha tariflar',
    standaloneDisabledMsg: () =>
      `🏢 <b>Standalone VPS</b> tarifi faqat menejer orqali individual tartibda rasmiylashtiriladi. Iltimos, platforma qo'llab-quvvatlash xizmatiga murojaat qiling.`,
    selectCaption: (planTitle, priceUsd, priceUzs, period, invoiceNumber, storeName) =>
      `
💳 <b>TARIF TO'LOVI UCHUN HISOB-FAKTURA</b>
━━━━━━━━━━━━━━━━━━━━
📄 <b>Hisob raqami:</b> <code>${escapeHtml(invoiceNumber)}</code>
🏪 <b>Do'kon:</b> ${escapeHtml(storeName)}
📦 <b>Tarif:</b> ${escapeHtml(planTitle)}
💰 <b>Summa:</b> <b>$${priceUsd}/${period} · ${priceUzs}</b>
🏦 <b>To'lov usuli:</b> Paynet QR-Online (0% komissiya)

📲 <b>Qanday to'lash kerak:</b>
1. Yuqoridagi QR-kodni <b>Paynet</b> ilovasida skanerlang yoki «⚡ Paynet orqali to'lash» tugmasini bosing.
2. <b>${priceUzs}</b> miqdorida to'lovni tasdiqlang.
3. «✅ Men tarifni to'ladim» tugmasini bosing — arizangiz tekshiruvga yuboriladi.
`.trim(),
    confirmToast: "🔍 To'lov tekshiruvga yuborildi!",
    confirmReplyPendingReview: (storeName, planTitle, priceUsd, priceUzs, invoiceNumber) =>
      `
🔍 <b>TO'LOV TASDIQLASH UCHUN TEKSHIRUVGA YUBORILDI!</b>
━━━━━━━━━━━━━━━━━━━━
📄 <b>Hisob raqami:</b> <code>${escapeHtml(invoiceNumber)}</code>
🏪 <b>Do'kon:</b> ${escapeHtml(storeName)}
💳 <b>Tarif:</b> ${escapeHtml(planTitle)} ($${priceUsd} · ${priceUzs})
📌 <b>Holat:</b> Tekshiruvda (<code>PENDING_REVIEW</code>)

🔔 <i>To'lov tekshirilgandan so'ng hisobingiz va obunangiz +30 kunga faollashtiriladi!</i>
`.trim(),
  },
  en: {
    overviewTitle: '💳 <b>PRICING & PAYMENT (MIRAI COMMERCE)</b>',
    overviewBody: (_botHandle) =>
      `
Choose a plan to launch your Telegram e-commerce store. Payments are accepted via <b>Paynet QR-Online (0% fee)</b>:

1️⃣ <b>Basic Inline Bot — $20/mo · 255,000 UZS</b>
  • Interactive product catalog inside Telegram chat
  • Cart, phone/delivery checkout, and instant notifications

2️⃣ <b>Pro Mini App Storefront — $30/mo · 385,000 UZS</b>
  • Fullscreen Telegram Mini App + inline chat bot
  • Admin dashboard for inventory, orders & analytics

🏢 <b>Standalone / Turnkey (Custom VPS Deployment)</b>
  • For dedicated self-hosted deployment, please contact platform support / manager.

👇 <b>Select a plan below to generate an invoice (INV-...) and Paynet QR:</b>
`.trim(),
    btnBasic: '🤖 Basic Bot · $20 / 255 000 UZS',
    btnPro: '📱 Pro Mini App · $30 / 385 000 UZS',
    btnSupportStandalone: '💬 Contact Manager for Standalone',
    btnCreateStore: '🚀 Connect Store',
    btnMainMenu: '🏠 Main Menu',
    payBtn: '⚡ Pay with Paynet (0% fee)',
    confirmBtn: '✅ I have paid for the plan',
    backBtn: '⬅️ All Plans',
    standaloneDisabledMsg: () =>
      `🏢 <b>Standalone VPS (Turnkey)</b> is not available for automatic self-serve checkout. Please contact platform support/manager for turnkey deployment.`,
    selectCaption: (planTitle, priceUsd, priceUzs, period, invoiceNumber, storeName) =>
      `
💳 <b>SUBSCRIPTION INVOICE</b>
━━━━━━━━━━━━━━━━━━━━
📄 <b>Invoice:</b> <code>${escapeHtml(invoiceNumber)}</code>
🏪 <b>Store:</b> ${escapeHtml(storeName)}
📦 <b>Plan:</b> ${escapeHtml(planTitle)}
💰 <b>Amount:</b> <b>$${priceUsd}/${period} · ${priceUzs}</b>
🏦 <b>Payment Method:</b> Paynet QR-Online (0% fee)

📲 <b>How to pay:</b>
1. Scan the QR code above in the <b>Paynet</b> app or tap «⚡ Pay with Paynet» below.
2. Complete the transfer of <b>${priceUzs}</b>.
3. Tap «✅ I have paid for the plan» — your invoice <code>${escapeHtml(invoiceNumber)}</code> will be submitted for admin verification.
`.trim(),
    confirmToast: '🔍 Submitted for payment verification!',
    confirmReplyPendingReview: (storeName, planTitle, priceUsd, priceUzs, invoiceNumber) =>
      `
🔍 <b>PAYMENT PROOF SUBMITTED FOR REVIEW!</b>
━━━━━━━━━━━━━━━━━━━━
📄 <b>Invoice:</b> <code>${escapeHtml(invoiceNumber)}</code>
🏪 <b>Store:</b> ${escapeHtml(storeName)}
💳 <b>Plan:</b> ${escapeHtml(planTitle)} ($${priceUsd} · ${priceUzs})
📌 <b>Status:</b> Pending Review (<code>PENDING_REVIEW</code>)

🔔 <i>The platform administrator has received your invoice for verification. Once confirmed, your account will activate for +30 days!</i>
`.trim(),
  },
};

function isSelfServePlan(plan: PlanTier): boolean {
  return (SELF_SERVE_PLANS as readonly string[]).includes(plan);
}

export async function handlePricingView(ctx: Context) {
  const env = getEnv();
  const lang = resolveLang(ctx);
  const copy = PRICING_COPY[lang];
  const botHandle = `@${env.MASTER_BOT_USERNAME || 'miraiedu_bot'}`;

  const keyboard = new InlineKeyboard()
    .text(copy.btnBasic, `pricing:plan:${PLAN_TIERS.BASIC_20}`)
    .row()
    .text(copy.btnPro, `pricing:plan:${PLAN_TIERS.PRO_30}`)
    .row()
    .text(copy.btnSupportStandalone, 'pricing:standalone_info')
    .row()
    .text(copy.btnCreateStore, 'onboard:start')
    .text(copy.btnMainMenu, 'chatdemo:menu');

  await ctx.reply(`${copy.overviewTitle}\n\n${copy.overviewBody(botHandle)}`, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handleStandaloneInfo(ctx: Context) {
  const env = getEnv();
  const lang = resolveLang(ctx);
  const copy = PRICING_COPY[lang];
  const botHandle = `@${env.MASTER_BOT_USERNAME || 'miraiedu_bot'}`;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const keyboard = new InlineKeyboard()
    .text(copy.backBtn, 'pricing:view')
    .text(copy.btnMainMenu, 'chatdemo:menu');

  await ctx.reply(copy.standaloneDisabledMsg(botHandle), {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

/**
 * Finds or creates an owner's tenant and an open PENDING_PAYMENT invoice row
 * before showing the platform Paynet QR code.
 */
export async function ensurePendingSubscriptionInvoice(
  userId: string,
  plan: PlanTier,
  fallbackStoreName: string,
  explicitTenantId?: string
): Promise<{ tenant: any; subscription: any }> {
  const details = getPlanDetails(plan);

  let tenant: any = null;
  if (explicitTenantId) {
    tenant = await prisma.tenant.findUnique({ where: { id: explicitTenantId } });
  }
  if (!tenant && userId) {
    tenant = await prisma.tenant.findFirst({
      where: { owner_telegram_id: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: fallbackStoreName,
        owner_telegram_id: userId,
        plan: details.tier as any,
        subscription_status: SubscriptionStatus.PENDING_PAYMENT as any,
        is_active: true,
      },
    });
  }

  // Reuse an existing unpaid PENDING_PAYMENT invoice for the same tenant & plan
  let subscription = await prisma.subscription.findFirst({
    where: {
      tenant_id: tenant.id,
      plan: details.tier as any,
      status: SubscriptionStatus.PENDING_PAYMENT as any,
      invoice_number: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        tenant_id: tenant.id,
        plan: details.tier as any,
        invoice_number: generateInvoiceNumber(),
        amount_uzs: details.priceUzs,
        status: SubscriptionStatus.PENDING_PAYMENT as any,
      },
    });
  } else if (!subscription.amount_uzs) {
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { amount_uzs: details.priceUzs },
    });
  }

  return { tenant, subscription };
}

export async function handlePricingPlanSelect(
  ctx: Context,
  plan: PlanTier,
  explicitTenantId?: string
) {
  const env = getEnv();
  const lang = resolveLang(ctx);
  const copy = PRICING_COPY[lang];
  const botHandle = `@${env.MASTER_BOT_USERNAME || 'miraiedu_bot'}`;

  if (!isSelfServePlan(plan)) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: 'Standalone оформляется через менеджера платформы',
        show_alert: true,
      }).catch(() => {});
    }
    await ctx.reply(copy.standaloneDisabledMsg(botHandle), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(copy.backBtn, 'pricing:view'),
    });
    return;
  }

  const userId = ctx.from?.id ? String(ctx.from.id) : '';
  const sessionTenantId = explicitTenantId || (ctx as any).session?.activeTenantId;
  const fallbackStoreName = ctx.from?.first_name
    ? `Магазин ${ctx.from.first_name}`
    : 'Мой магазин';

  let tenant: any;
  let subscription: any;
  try {
    const ensured = await ensurePendingSubscriptionInvoice(
      userId || 'telegram_guest',
      plan,
      fallbackStoreName,
      sessionTenantId
    );
    tenant = ensured.tenant;
    subscription = ensured.subscription;
    if ((ctx as any).session && tenant?.id) {
      (ctx as any).session.activeTenantId = tenant.id;
    }
  } catch (err: any) {
    console.error('Failed to prepare subscription invoice:', err);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⚠️ Ошибка создания счёта', show_alert: true }).catch(() => {});
    }
    await ctx.reply(`⚠️ Не удалось сформировать счёт на оплату: ${escapeHtml(err?.message || 'DB error')}`);
    return;
  }

  const details = getPlanDetails(plan);
  const localizedPriceUzs = formatUzs(subscription.amount_uzs || details.priceUzs, lang);
  const invoiceNumber = subscription.invoice_number || `INV-${subscription.id.slice(0, 8).toUpperCase()}`;
  const caption = copy.selectCaption(
    details.labels[lang],
    details.priceUsd,
    localizedPriceUzs,
    details.periodLabels[lang],
    invoiceNumber,
    tenant.name
  );

  const keyboard = new InlineKeyboard()
    .url(copy.payBtn, PLATFORM_PAYNET_QR_URL)
    .row()
    .text(copy.confirmBtn, buildSubConfirmCallback(subscription.id))
    .row()
    .text(copy.backBtn, 'pricing:view')
    .text(copy.btnCreateStore, 'onboard:start');

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  const qrImageUrl = buildPaynetQrImageUrl(PLATFORM_PAYNET_QR_URL);
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

function isSuperAdminUser(ctx: Context): boolean {
  const superAdminId = getSuperAdminTelegramId();
  const userId = ctx.from?.id ? String(ctx.from.id) : '';
  return Boolean(userId) && userId === superAdminId;
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

/**
 * Handles merchant tapping "Я оплатил тариф".
 * NEVER auto-activates subscription — transitions strictly to PENDING_REVIEW
 * and alerts SUPERADMIN_TELEGRAM_ID with invoice number & approval buttons.
 */
export async function handleSubscriptionConfirm(
  ctx: Context,
  rawIdOrTenantId: string,
  rawPlan?: string
) {
  const lang = resolveLang(ctx);
  const copy = PRICING_COPY[lang];
  const userId = ctx.from?.id ? String(ctx.from.id) : '';

  if (rawPlan === PLAN_TIERS.STANDALONE_LIFETIME || rawPlan === 'STANDALONE') {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: 'Standalone оформляется через менеджера платформы',
        show_alert: true,
      }).catch(() => {});
    }
    return;
  }

  const parsed = parseSubConfirmCallback(rawIdOrTenantId, rawPlan);
  const candidateId = parsed.id;

  let subscription: any = null;
  let targetTenant: any = null;

  try {
    if (candidateId && candidateId !== 'platform') {
      subscription = await prisma.subscription.findUnique({
        where: { id: candidateId },
        include: { tenant: true },
      });
      if (subscription) {
        targetTenant = subscription.tenant;
      } else {
        targetTenant = await prisma.tenant.findUnique({ where: { id: candidateId } });
      }
    }

    if (!targetTenant && userId) {
      targetTenant = await prisma.tenant.findFirst({
        where: { owner_telegram_id: userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (
      targetTenant &&
      targetTenant.owner_telegram_id &&
      userId &&
      targetTenant.owner_telegram_id !== userId
    ) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({
          text: '⛔ Этот счёт принадлежит другому владельцу',
          show_alert: true,
        }).catch(() => {});
      }
      return;
    }

    if (targetTenant && !subscription) {
      const openOrPendingSub = await prisma.subscription.findFirst({
        where: {
          tenant_id: targetTenant.id,
          status: { in: [SubscriptionStatus.PENDING_PAYMENT, SubscriptionStatus.PENDING_REVIEW] as any },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (openOrPendingSub) {
        subscription = openOrPendingSub;
      } else {
        const ensured = await ensurePendingSubscriptionInvoice(
          userId || targetTenant.owner_telegram_id,
          parsed.plan,
          targetTenant.name,
          targetTenant.id
        );
        subscription = ensured.subscription;
        targetTenant = ensured.tenant;
      }
    }

    if (!targetTenant || !subscription) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({
          text: '⚠️ Счёт не найден. Откройте /pricing и выберите тариф.',
          show_alert: true,
        }).catch(() => {});
      }
      return;
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '✅ Этот счёт уже подтверждён и активен!' });
      }
      return;
    }

    const resolvedPlan: PlanTier = isSelfServePlan(subscription.plan)
      ? subscription.plan
      : isSelfServePlan(parsed.plan)
        ? parsed.plan
        : PLAN_TIERS.PRO_30;
    const details = getPlanDetails(resolvedPlan);

    // Transition ONLY to PENDING_REVIEW — NEVER auto-set ACTIVE
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: details.tier as any,
        amount_uzs: subscription.amount_uzs || details.priceUzs,
        status: SubscriptionStatus.PENDING_REVIEW as any,
      },
    });

    if (targetTenant.subscription_status !== SubscriptionStatus.ACTIVE) {
      targetTenant = await prisma.tenant.update({
        where: { id: targetTenant.id },
        data: {
          plan: details.tier as any,
          subscription_status: SubscriptionStatus.PENDING_REVIEW as any,
        },
      });
    }

    const superAdminId = getSuperAdminTelegramId();
    const usernameDisplay = ctx.from?.username ? `@${escapeHtml(ctx.from.username)}` : 'без @username';
    const fullNameDisplay = escapeHtml(
      [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ').trim() || 'Пользователь Telegram'
    );
    const invoiceNumber =
      subscription.invoice_number || `INV-${subscription.id.slice(0, 8).toUpperCase()}`;
    const amountUzsDisplay = formatUzs(subscription.amount_uzs || details.priceUzs, 'ru');

    const adminAlert = `
💳 <b>ЗАЯВКА НА ПРОВЕРКУ ОПЛАТЫ ТАРИФА (Paynet)</b>
━━━━━━━━━━━━━━━━━━━━
📄 <b>Счёт:</b> <code>${escapeHtml(invoiceNumber)}</code>
🏪 <b>Магазин:</b> ${escapeHtml(targetTenant.name)} (<code>${targetTenant.id}</code>)
👤 <b>Владелец:</b> ${fullNameDisplay} (${usernameDisplay})
🆔 <b>Telegram ID:</b> <code>${escapeHtml(userId || targetTenant.owner_telegram_id || 'unknown')}</code>
📦 <b>Тариф:</b> ${details.labels.ru} (<code>${details.tier}</code>)
💰 <b>Сумма:</b> <b>$${details.priceUsd} · ${amountUzsDisplay}</b>
🔍 <b>Статус:</b> <code>PENDING_REVIEW</code> (ожидает проверки)
`.trim();

    const adminKeyboard = new InlineKeyboard()
      .text(
        '✅ Подтвердить (+30 дн.)',
        buildAdminSubApproveCallback(subscription.id, details.tier)
      )
      .row()
      .text('⛔ Приостановить магазин', buildAdminSubSuspendCallback(subscription.id));

    try {
      await ctx.api.sendMessage(superAdminId, adminAlert, {
        parse_mode: 'HTML',
        reply_markup: adminKeyboard,
      });
    } catch (notifyErr) {
      console.warn(`Non-critical: failed to send tariff confirmation to superadmin ${superAdminId}:`, notifyErr);
    }

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: copy.confirmToast });
    }

    const localizedPriceUzs = formatUzs(subscription.amount_uzs || details.priceUzs, lang);
    const replyKeyboard = new InlineKeyboard()
      .text(copy.backBtn, 'pricing:view')
      .text(copy.btnMainMenu, 'chatdemo:menu');

    await ctx.reply(
      copy.confirmReplyPendingReview(
        targetTenant.name,
        details.labels[lang],
        details.priceUsd,
        localizedPriceUzs,
        invoiceNumber
      ),
      { parse_mode: 'HTML', reply_markup: replyKeyboard }
    );
  } catch (dbErr: any) {
    console.error('Error submitting subscription payment for review:', dbErr);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: `⚠️ Ошибка: ${dbErr?.message || 'DB error'}`.slice(0, 180),
        show_alert: true,
      }).catch(() => {});
    }
  }
}

export async function handleAdminSubApprove(
  ctx: Context,
  rawId: string,
  rawPlan?: string
) {
  if (!isSuperAdminUser(ctx)) {
    await ctx.answerCallbackQuery({ text: '⛔ Только для главного администратора', show_alert: true });
    return;
  }

  const parsed = parseAdminSubCallback(rawId, rawPlan);
  const restoredId = parsed.id;

  try {
    let targetSub = await prisma.subscription.findUnique({
      where: { id: restoredId },
      include: { tenant: true },
    });

    let existingTenant = targetSub?.tenant || null;
    if (!existingTenant) {
      existingTenant = await prisma.tenant.findUnique({ where: { id: restoredId } });
    }

    if (!existingTenant) {
      await ctx.answerCallbackQuery({ text: '⚠️ Магазин или счёт не найден', show_alert: true });
      return;
    }

    if (!targetSub) {
      targetSub = (await prisma.subscription.findFirst({
        where: { tenant_id: existingTenant.id },
        orderBy: { createdAt: 'desc' },
        include: { tenant: true },
      })) as any;
    }

    // Idempotency guard: avoid extending twice if the exact same invoice was already approved
    if (targetSub && targetSub.status === SubscriptionStatus.ACTIVE && targetSub.reviewed_at) {
      await ctx.answerCallbackQuery({ text: '✅ Этот счёт уже был подтверждён ранее' });
      return;
    }

    const plan: PlanTier = rawPlan
      ? parsed.plan
      : targetSub?.plan && isSelfServePlan(targetSub.plan as PlanTier)
        ? (targetSub.plan as PlanTier)
        : (existingTenant.plan as PlanTier);
    const details = getPlanDetails(plan);

    // Compute additive +30 days from max(now, existing current_period_end)
    const activeSubs = await prisma.subscription.findMany({
      where: {
        tenant_id: existingTenant.id,
        status: SubscriptionStatus.ACTIVE as any,
        current_period_end: { not: null },
      },
      orderBy: { current_period_end: 'desc' },
      take: 1,
    });
    const latestActiveEnd = activeSubs[0]?.current_period_end;
    const baseEnd =
      latestActiveEnd &&
      (!targetSub?.current_period_end ||
        latestActiveEnd.getTime() > targetSub.current_period_end.getTime())
        ? latestActiveEnd
        : targetSub?.current_period_end;

    const newPeriodEnd =
      plan === PLAN_TIERS.STANDALONE_LIFETIME
        ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)
        : computeAdditivePeriodEnd(baseEnd);

    const reviewer = ctx.from?.id ? `tg:${ctx.from.id}` : 'superadmin';
    const reviewedAt = new Date();

    const updatedSub = targetSub
      ? await prisma.subscription.update({
          where: { id: targetSub.id },
          data: {
            plan: details.tier as any,
            status: SubscriptionStatus.ACTIVE as any,
            current_period_end: newPeriodEnd,
            cancel_at_period_end: false,
            reviewed_by: reviewer,
            reviewed_at: reviewedAt,
          },
        })
      : await prisma.subscription.create({
          data: {
            tenant_id: existingTenant.id,
            plan: details.tier as any,
            invoice_number: generateInvoiceNumber(),
            amount_uzs: details.priceUzs,
            status: SubscriptionStatus.ACTIVE as any,
            current_period_end: newPeriodEnd,
            reviewed_by: reviewer,
            reviewed_at: reviewedAt,
          },
        });

    const updatedTenant = await prisma.tenant.update({
      where: { id: existingTenant.id },
      data: {
        plan: details.tier as any,
        subscription_status: SubscriptionStatus.ACTIVE as any,
        is_active: true,
      },
    });

    const periodEndLabel = newPeriodEnd.toLocaleDateString('ru-RU');
    const invoiceLabel = updatedSub.invoice_number || updatedSub.id.slice(0, 8);

    if (updatedTenant.owner_telegram_id) {
      const merchantNotice = `
✅ <b>ОПЛАТА ПОДТВЕРЖДЕНА АДМИНИСТРАТОРОМ!</b>
━━━━━━━━━━━━━━━━━━━━
📄 <b>Счёт:</b> <code>${escapeHtml(invoiceLabel)}</code>
🏪 <b>Магазин:</b> ${escapeHtml(updatedTenant.name)}
💳 <b>Активный тариф:</b> ${details.labels.ru} (<code>${details.tier}</code>)
💰 <b>Сумма:</b> $${details.priceUsd}/${details.periodLabels.ru} · ${details.priceUzsFormatted}
📅 <b>Активен до:</b> ${periodEndLabel}

🚀 <i>Ваш магазин и подписка активированы (+30 дней)!</i>
`.trim();

      try {
        await ctx.api.sendMessage(updatedTenant.owner_telegram_id, merchantNotice, {
          parse_mode: 'HTML',
        });
      } catch (notifyErr) {
        console.warn(`Non-critical: failed to notify merchant ${updatedTenant.owner_telegram_id}:`, notifyErr);
      }
    }

    await ctx.answerCallbackQuery({ text: '✅ Тариф подтверждён и продлён (+30 дн.)' });
    await appendAdminActionNote(
      ctx,
      `✅ <b>Подтверждено администратором:</b> счёт <code>${escapeHtml(invoiceLabel)}</code>, тариф <code>${details.tier}</code> активирован до <b>${periodEndLabel}</b> для магазина <b>${escapeHtml(updatedTenant.name)}</b>.`
    );
  } catch (err: any) {
    console.error('Error in handleAdminSubApprove:', err);
    await ctx.answerCallbackQuery({
      text: `⚠️ Ошибка активации: ${err?.message || 'DB error'}`.slice(0, 180),
      show_alert: true,
    });
  }
}

export async function handleAdminSubSuspend(ctx: Context, rawId: string) {
  if (!isSuperAdminUser(ctx)) {
    await ctx.answerCallbackQuery({ text: '⛔ Только для главного администратора', show_alert: true });
    return;
  }

  const restoredId = restoreUuid(rawId);

  try {
    let targetSub = await prisma.subscription.findUnique({
      where: { id: restoredId },
      include: { tenant: true },
    });

    let existingTenant = targetSub?.tenant || null;
    if (!existingTenant) {
      existingTenant = await prisma.tenant.findUnique({ where: { id: restoredId } });
    }

    if (!existingTenant) {
      await ctx.answerCallbackQuery({ text: '⚠️ Магазин не найден', show_alert: true });
      return;
    }

    if (!targetSub) {
      targetSub = (await prisma.subscription.findFirst({
        where: { tenant_id: existingTenant.id },
        orderBy: { createdAt: 'desc' },
        include: { tenant: true },
      })) as any;
    }

    const reviewer = ctx.from?.id ? `tg:${ctx.from.id}` : 'superadmin';
    const reviewedAt = new Date();

    const updatedTenant = await prisma.tenant.update({
      where: { id: existingTenant.id },
      data: {
        is_active: false,
        subscription_status: SubscriptionStatus.PAST_DUE as any,
      },
    });

    if (targetSub) {
      await prisma.subscription.update({
        where: { id: targetSub.id },
        data: {
          status: SubscriptionStatus.PAST_DUE as any,
          reviewed_by: reviewer,
          reviewed_at: reviewedAt,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          tenant_id: existingTenant.id,
          plan: (existingTenant.plan as any) || PLAN_TIERS.BASIC_20,
          status: SubscriptionStatus.PAST_DUE as any,
          reviewed_by: reviewer,
          reviewed_at: reviewedAt,
        },
      });
    }

    if (updatedTenant.owner_telegram_id) {
      const merchantNotice = `
⛔ <b>РАБОТА МАГАЗИНА ПРИОСТАНОВЛЕНА</b>
━━━━━━━━━━━━━━━━━━━━
🏪 <b>Магазин:</b> ${escapeHtml(updatedTenant.name)}
📌 <b>Статус подписки:</b> Требуется оплата (<code>PAST_DUE</code>)

💬 <i>Для возобновления работы оплатите тариф в разделе /pricing или свяжитесь с поддержкой платформы.</i>
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
