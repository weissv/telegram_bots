import crypto from 'node:crypto';
import { InlineKeyboard } from 'grammy';
import { BotContext, CartItem, DeliveryMethod, TenantInfo } from '../types.js';
import {
  getCartInlineKeyboard,
  getMainMenuKeyboard,
  getPhoneRequestKeyboard,
} from '../keyboards/index.js';
import { buildDisabledStorefrontMessage, isStorefrontDisabled } from './start.js';
import { prisma } from '@telegram-commerce/database';
import {
  DEFAULT_THEME_CONFIG,
  ORDER_STATUS,
  PAYMENT_METHODS,
  isValidPaynetQrUrl,
} from '@telegram-commerce/config';
import { t, formatCurrency, type Locale } from '@telegram-commerce/i18n';

export function normalizePhoneNumber(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return null;

  // Accept 9-digit local Uzbekistan mobile format (e.g. 901234567 -> +998901234567)
  if (/^\d{9}$/.test(cleaned)) {
    return `+998${cleaned}`;
  }

  // Accept 7-15 digits with optional leading +
  if (/^\+?\d{7,15}$/.test(cleaned)) {
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }

  return null;
}

export function computeCheckoutTotals(
  cart: CartItem[],
  tenant: TenantInfo,
  deliveryMethod: DeliveryMethod = 'COURIER'
): {
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  feeUzs: number;
  freeThresholdUzs: number;
} {
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const theme = tenant.themeConfig || {};
  const rawFee =
    theme.deliveryFeeUzs !== undefined && theme.deliveryFeeUzs !== null
      ? Number(theme.deliveryFeeUzs)
      : DEFAULT_THEME_CONFIG.deliveryFeeUzs;
  const feeUzs = Number.isFinite(rawFee) && rawFee > 0 ? rawFee : 0;

  const rawThreshold =
    theme.freeDeliveryThresholdUzs !== undefined && theme.freeDeliveryThresholdUzs !== null
      ? Number(theme.freeDeliveryThresholdUzs)
      : DEFAULT_THEME_CONFIG.freeDeliveryThresholdUzs;
  const freeThresholdUzs = Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 0;

  const deliveryFee =
    deliveryMethod === 'PICKUP' || feeUzs === 0 || (freeThresholdUzs > 0 && subtotal >= freeThresholdUzs)
      ? 0
      : feeUzs;

  return {
    subtotal,
    deliveryFee,
    totalAmount: subtotal + deliveryFee,
    feeUzs,
    freeThresholdUzs,
  };
}

export function buildSellerDisclosureBlock(tenant: TenantInfo, locale: Locale): string {
  const theme = tenant.themeConfig || {};
  const lines: string[] = [];

  if (theme.legalName) {
    const label = locale === 'uz' ? 'Sotuvchi' : locale === 'en' ? 'Seller' : 'Продавец';
    lines.push(`🏢 <b>${label}:</b> ${escapeHtml(theme.legalName)}`);
  }
  if (theme.innOrPinfl) {
    const label = locale === 'uz' ? 'STIR / JSHSHIR' : locale === 'en' ? 'Tax ID' : 'ИНН / ПИНФЛ';
    lines.push(`🆔 <b>${label}:</b> <code>${escapeHtml(theme.innOrPinfl)}</code>`);
  }
  if (theme.supportContact) {
    const label = locale === 'uz' ? "Qo'llab-quvvatlash" : locale === 'en' ? 'Support' : 'Поддержка';
    lines.push(`📞 <b>${label}:</b> ${escapeHtml(theme.supportContact)}`);
  }

  const deliveryTerms = theme.deliveryTerms || DEFAULT_THEME_CONFIG.deliveryTerms;
  if (deliveryTerms) {
    const label = locale === 'uz' ? 'Yetkazib berish shartlari' : locale === 'en' ? 'Delivery terms' : 'Условия доставки';
    lines.push(`🚚 <b>${label}:</b> ${escapeHtml(deliveryTerms)}`);
  }

  const returnPolicy = theme.returnPolicy || DEFAULT_THEME_CONFIG.returnPolicy;
  if (returnPolicy) {
    const label = locale === 'uz' ? 'Qaytarish shartlari' : locale === 'en' ? 'Return policy' : 'Возврат и обмен';
    lines.push(`↩️ <b>${label}:</b> ${escapeHtml(returnPolicy)}`);
  }

  return lines.join('\n');
}

export function buildPaynetUnavailableMessage(tenant: TenantInfo, locale: Locale): string {
  const theme = tenant.themeConfig || {};
  if (theme.isDemo) {
    const supportLine = theme.supportContact
      ? `\n📞 ${locale === 'uz' ? "Qo'llab-quvvatlash" : locale === 'en' ? 'Support' : 'Поддержка'}: ${escapeHtml(theme.supportContact)}`
      : '';
    return `⚠️ ${t(locale, 'checkout.demo_disabled')}${supportLine}`;
  }

  const supportLabel = locale === 'uz' ? "Sotuvchi qo'llab-quvvatlashi" : locale === 'en' ? 'Seller support' : 'Поддержка магазина';
  const supportValue = theme.supportContact
    ? escapeHtml(theme.supportContact)
    : locale === 'uz'
      ? "do'kon ma'muriyatiga murojaat qiling"
      : locale === 'en'
        ? 'contact store administration'
        : 'обратитесь к администратору магазина';
  const sellerLine = theme.legalName
    ? `\n🏢 <b>${locale === 'uz' ? 'Sotuvchi' : locale === 'en' ? 'Seller' : 'Продавец'}:</b> ${escapeHtml(theme.legalName)}`
    : '';

  return (
    `⚠️ ${t(locale, 'checkout.paynet_unavailable')}` +
    `${sellerLine}\n📞 <b>${supportLabel}:</b> ${supportValue}`
  );
}

export function isPaynetCheckoutEnabled(tenant: TenantInfo): boolean {
  const theme = tenant.themeConfig;
  if (!theme || theme.isDemo) return false;
  return Boolean(theme.paynetEnabled && isValidPaynetQrUrl(theme.paynetQrUrl));
}

export async function handleAddToCart(ctx: BotContext, productId: string, variant?: string) {
  const { db, tenant } = ctx;
  const locale = ctx.locale;

  if (isStorefrontDisabled(tenant)) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'checkout.store_not_published'), show_alert: true }).catch(() => {});
    }
    return;
  }

  const product = await db.product.findFirst({
    where: { id: productId, is_active: true },
  });

  if (!product) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'cart.not_found'), show_alert: true });
    }
    return;
  }

  if (product.stock <= 0) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'cart.out_of_stock'), show_alert: true });
    }
    return;
  }

  if (!ctx.session.cart) {
    ctx.session.cart = [];
  }

  const normalizedVariant = typeof variant === 'string' && variant.trim() ? variant.trim() : undefined;
  const totalInCartForProduct = ctx.session.cart
    .filter((item: CartItem) => item.productId === productId)
    .reduce((sum: number, item: CartItem) => sum + item.quantity, 0);

  if (totalInCartForProduct >= product.stock) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: t(locale, 'cart.max_stock', { stock: product.stock }),
        show_alert: true,
      });
    }
    return;
  }

  const existing = ctx.session.cart.find(
    (item: CartItem) =>
      item.productId === productId && (item.variant || '') === (normalizedVariant || '')
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    ctx.session.cart.push({
      productId: product.id,
      title: product.title,
      price: Number(product.price),
      quantity: 1,
      ...(normalizedVariant ? { variant: normalizedVariant } : {}),
    });
  }

  const addedTitle = normalizedVariant ? `${product.title} (${normalizedVariant})` : product.title;
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: t(locale, 'cart.added', { title: addedTitle }),
    });
  }
}

export async function handleViewCart(ctx: BotContext) {
  const { tenant } = ctx;
  const locale = ctx.locale;
  const cart: CartItem[] = ctx.session.cart || [];
  const currency = tenant.currency || 'UZS';

  if (isStorefrontDisabled(tenant)) {
    const msg = buildDisabledStorefrontMessage(tenant, locale);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'checkout.store_not_published'), show_alert: true }).catch(() => {});
    }
    await ctx.reply(msg, { parse_mode: 'HTML' });
    return;
  }

  if (cart.length === 0) {
    const text = t(locale, 'cart.empty');
    const keyboard = new InlineKeyboard().text(t(locale, 'cart.continue'), 'catalog:browse');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard }).catch(async () => {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      });
      await ctx.answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return;
  }

  const { subtotal, feeUzs, freeThresholdUzs } = computeCheckoutTotals(cart, tenant, 'COURIER');

  const itemsList = cart
    .map((item: CartItem, idx: number) => {
      const displayTitle = item.variant ? `${item.title} (${item.variant})` : item.title;
      return t(locale, 'cart.item_line', {
        idx: idx + 1,
        title: escapeHtml(displayTitle),
        qty: item.quantity,
        price: formatCurrency(item.price, currency, locale),
        subtotal: formatCurrency(item.quantity * item.price, currency, locale),
      });
    })
    .join('\n\n');

  const deliveryHint =
    feeUzs > 0 && freeThresholdUzs > 0
      ? `\n🚚 <i>${t(locale, 'checkout.free_delivery_hint', {
          threshold: formatCurrency(freeThresholdUzs, currency, locale),
        })}</i>`
      : '';

  const text = `
${t(locale, 'cart.title')}

${itemsList}

━━━━━━━━━━━━━━━━━━━
${t(locale, 'cart.total', { total: formatCurrency(subtotal, currency, locale) })}${deliveryHint}
━━━━━━━━━━━━━━━━━━━
`.trim();

  const keyboard = getCartInlineKeyboard(cart, currency, locale);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard }).catch(async () => {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    });
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }
}

/**
 * Interactive checkout wizard:
 * 1) Validates storefront status & merchant Paynet QR readiness (no platform QR fallback).
 * 2) Collects & validates customer phone (Keyboard.requestContact or typed phone).
 * 3) Collects delivery method (COURIER / PICKUP) and courier shipping address.
 * 4) Shows full breakdown (items subtotal, delivery fee, total, delivery terms, legal/support/return info)
 *    before confirming the order via `checkout:confirm`.
 */
export async function handleCartCheckout(ctx: BotContext) {
  const { tenant } = ctx;
  const locale = ctx.locale;
  const cart: CartItem[] = ctx.session.cart || [];

  if (cart.length === 0) {
    ctx.session.checkoutStep = undefined;
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'cart.empty_alert'), show_alert: true });
    } else {
      await ctx.reply(t(locale, 'cart.empty'), { parse_mode: 'HTML' });
    }
    return;
  }

  if (isStorefrontDisabled(tenant)) {
    ctx.session.checkoutStep = undefined;
    const msg = buildDisabledStorefrontMessage(tenant, locale);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'checkout.store_not_published'), show_alert: true }).catch(() => {});
    }
    await ctx.reply(msg, { parse_mode: 'HTML' });
    return;
  }

  if (!isPaynetCheckoutEnabled(tenant)) {
    ctx.session.checkoutStep = undefined;
    const msg = buildPaynetUnavailableMessage(tenant, locale);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'checkout.paynet_unavailable'), show_alert: true }).catch(() => {});
    }
    await ctx.reply(msg, { parse_mode: 'HTML' });
    return;
  }

  // Step 1: Require customer phone number
  const validPhone = normalizePhoneNumber(ctx.session.customerPhone);
  if (!validPhone) {
    ctx.session.customerPhone = undefined;
    ctx.session.checkoutStep = 'awaiting_phone';
    const prompt =
      locale === 'uz'
        ? `📞 <b>1-qadam / 3: Aloqa raqami</b>\n\nBuyurtma bo'yicha bog'lanish uchun telefon raqamingizni yuboring.\nQuyidagi tugmani bosing yoki raqamni qo'lda kiriting (masalan: <code>+998901234567</code>):`
        : locale === 'en'
          ? `📞 <b>Step 1 of 3: Contact Phone</b>\n\nPlease share your phone number so the seller can coordinate delivery.\nTap the button below or type it (e.g. <code>+998901234567</code>):`
          : `📞 <b>Шаг 1 из 3: Контактный телефон</b>\n\n${t(locale, 'checkout.phone_required')}.\nНажмите кнопку ниже или введите номер вручную (например: <code>+998901234567</code>):`;

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    await ctx.reply(prompt, {
      parse_mode: 'HTML',
      reply_markup: getPhoneRequestKeyboard(locale),
    });
    return;
  }
  ctx.session.customerPhone = validPhone;

  // Step 2: Require delivery method (COURIER or PICKUP)
  if (ctx.session.deliveryMethod !== 'COURIER' && ctx.session.deliveryMethod !== 'PICKUP') {
    ctx.session.checkoutStep = 'awaiting_delivery_method';
    const currency = tenant.currency || 'UZS';
    const { subtotal, feeUzs, freeThresholdUzs } = computeCheckoutTotals(cart, tenant, 'COURIER');
    const isFreeCourier = feeUzs === 0 || (freeThresholdUzs > 0 && subtotal >= freeThresholdUzs);
    const courierFeeText = isFreeCourier
      ? t(locale, 'checkout.delivery_free')
      : formatCurrency(feeUzs, currency, locale);
    const freeLabel = t(locale, 'checkout.delivery_free');

    const deliveryTerms = tenant.themeConfig?.deliveryTerms || DEFAULT_THEME_CONFIG.deliveryTerms;
    const freeHintLine =
      !isFreeCourier && freeThresholdUzs > 0
        ? `\n✨ <i>${t(locale, 'checkout.free_delivery_hint', {
            threshold: formatCurrency(freeThresholdUzs, currency, locale),
          })}</i>`
        : '';

    const keyboard = new InlineKeyboard()
      .text(`🚚 ${t(locale, 'checkout.delivery_courier')} (${courierFeeText})`, 'checkout:delivery:COURIER')
      .row()
      .text(`🏪 ${t(locale, 'checkout.delivery_pickup')} (${freeLabel})`, 'checkout:delivery:PICKUP')
      .row()
      .text(locale === 'uz' ? '❌ Bekor qilish' : locale === 'en' ? '❌ Cancel' : '❌ Отмена', 'checkout:cancel');

    const prompt =
      locale === 'uz'
        ? `🚚 <b>2-qadam / 3: ${t(locale, 'checkout.delivery_method')}</b>\n\n📞 Telefon: <code>${escapeHtml(validPhone)}</code>\n📋 ${escapeHtml(deliveryTerms)}${freeHintLine}`
        : locale === 'en'
          ? `🚚 <b>Step 2 of 3: ${t(locale, 'checkout.delivery_method')}</b>\n\n📞 Phone: <code>${escapeHtml(validPhone)}</code>\n📋 ${escapeHtml(deliveryTerms)}${freeHintLine}`
          : `🚚 <b>Шаг 2 из 3: ${t(locale, 'checkout.delivery_method')}</b>\n\n📞 Телефон: <code>${escapeHtml(validPhone)}</code>\n📋 ${escapeHtml(deliveryTerms)}${freeHintLine}`;

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    await ctx.reply(prompt, { parse_mode: 'HTML', reply_markup: keyboard });
    return;
  }

  // Step 3: Require delivery address when COURIER is selected
  const pickupSentinel = t(locale, 'checkout.delivery_pickup');
  const currentAddress = (ctx.session.shippingAddress || '').trim();
  if (
    ctx.session.deliveryMethod === 'COURIER' &&
    (!currentAddress || currentAddress === 'Самовывоз' || currentAddress === pickupSentinel)
  ) {
    ctx.session.checkoutStep = 'awaiting_address';
    const keyboard = new InlineKeyboard().text(
      locale === 'uz' ? '❌ Bekor qilish' : locale === 'en' ? '❌ Cancel' : '❌ Отмена',
      'checkout:cancel'
    );
    const prompt =
      locale === 'uz'
        ? `📍 <b>3-qadam / 3: Yetkazib berish manzili</b>\n\n${t(locale, 'checkout.address_required')} (shahar, tuman, ko'cha, uy/xonadon):`
        : locale === 'en'
          ? `📍 <b>Step 3 of 3: Shipping Address</b>\n\n${t(locale, 'checkout.address_required')} (city, street, building/apt):`
          : `📍 <b>Шаг 3 из 3: Адрес доставки</b>\n\n${t(locale, 'checkout.address_required')} (город, улица, дом, квартира/ориентир):`;

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    await ctx.reply(prompt, { parse_mode: 'HTML', reply_markup: keyboard });
    return;
  }

  // Step 4: Show full summary & legal disclosure before order confirmation
  await showCheckoutConfirmation(ctx);
}

export async function showCheckoutConfirmation(ctx: BotContext) {
  const { tenant } = ctx;
  const locale = ctx.locale;
  const cart: CartItem[] = ctx.session.cart || [];
  const currency = tenant.currency || 'UZS';
  const deliveryMethod: DeliveryMethod = ctx.session.deliveryMethod === 'PICKUP' ? 'PICKUP' : 'COURIER';
  const phone = normalizePhoneNumber(ctx.session.customerPhone) || '';
  const address =
    deliveryMethod === 'PICKUP'
      ? t(locale, 'checkout.delivery_pickup')
      : (ctx.session.shippingAddress || '').trim();

  const { subtotal, deliveryFee, totalAmount } = computeCheckoutTotals(cart, tenant, deliveryMethod);

  ctx.session.checkoutStep = 'awaiting_confirm';

  const itemsText = cart
    .map((item, idx) => {
      const label = item.variant ? `${item.title} (${item.variant})` : item.title;
      return `${idx + 1}. <b>${escapeHtml(label)}</b> × ${item.quantity} = <code>${formatCurrency(item.price * item.quantity, currency, locale)}</code>`;
    })
    .join('\n');

  const deliveryFeeText =
    deliveryFee === 0
      ? t(locale, 'checkout.delivery_free')
      : formatCurrency(deliveryFee, currency, locale);
  const deliveryMethodLabel =
    deliveryMethod === 'PICKUP'
      ? `🏪 ${t(locale, 'checkout.delivery_pickup')}`
      : `🚚 ${t(locale, 'checkout.delivery_courier')}`;

  const disclosureBlock = buildSellerDisclosureBlock(tenant, locale);

  const heading =
    locale === 'uz'
      ? '🧾 <b>BUYURTMANI TASDIQLASH</b>'
      : locale === 'en'
        ? '🧾 <b>ORDER CONFIRMATION</b>'
        : '🧾 <b>ПОДТВЕРЖДЕНИЕ ЗАКАЗА</b>';
  const phoneLabel = locale === 'uz' ? 'Telefon' : locale === 'en' ? 'Phone' : 'Телефон';
  const addrLabel = locale === 'uz' ? 'Manzil' : locale === 'en' ? 'Address' : 'Адрес';

  const text = `
${heading}
━━━━━━━━━━━━━━━━━━━
${itemsText}

━━━━━━━━━━━━━━━━━━━
📦 <b>${t(locale, 'checkout.items_subtotal')}:</b> ${formatCurrency(subtotal, currency, locale)}
🚚 <b>${t(locale, 'checkout.delivery_fee')}:</b> ${deliveryFeeText} (${deliveryMethodLabel})
${t(locale, 'checkout.total', { total: formatCurrency(totalAmount, currency, locale) })}

📞 <b>${phoneLabel}:</b> <code>${escapeHtml(phone)}</code>
📍 <b>${addrLabel}:</b> ${escapeHtml(address)}

${disclosureBlock ? `━━━━━━━━━━━━━━━━━━━\n${disclosureBlock}` : ''}
`.trim();

  const confirmBtnLabel =
    locale === 'uz'
      ? "✅ Buyurtmani tasdiqlash va to'lash"
      : locale === 'en'
        ? '✅ Confirm & Proceed to Payment'
        : '✅ Подтвердить и перейти к оплате';
  const editPhoneLabel =
    locale === 'uz' ? '📞 Telefonni o‘zgartirish' : locale === 'en' ? '📞 Edit Phone' : '📞 Изм. телефон';
  const editDeliveryLabel =
    locale === 'uz' ? '🚚 Yetkazishni o‘zgartirish' : locale === 'en' ? '🚚 Edit Delivery' : '🚚 Изм. доставку';
  const cancelLabel = locale === 'uz' ? '❌ Bekor qilish' : locale === 'en' ? '❌ Cancel' : '❌ Отмена';

  const keyboard = new InlineKeyboard()
    .text(confirmBtnLabel, 'checkout:confirm')
    .row()
    .text(editPhoneLabel, 'checkout:edit_phone')
    .text(editDeliveryLabel, 'checkout:edit_delivery')
    .row()
    .text(cancelLabel, 'checkout:cancel');

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

/**
 * Persists the order atomically after interactive contact/delivery verification,
 * strictly validates merchant Paynet QR URL (never falling back to platform QR),
 * and sends payment buttons + legal/delivery disclosures.
 */
export async function handleConfirmCartOrder(ctx: BotContext) {
  const { tenant, from } = ctx;
  const locale = ctx.locale;
  const cart: CartItem[] = ctx.session.cart || [];
  const currency = tenant.currency || 'UZS';

  if (cart.length === 0) {
    ctx.session.checkoutStep = undefined;
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'cart.empty_alert'), show_alert: true });
    } else {
      await ctx.reply(t(locale, 'cart.empty'), { parse_mode: 'HTML' });
    }
    return;
  }

  if (isStorefrontDisabled(tenant)) {
    ctx.session.checkoutStep = undefined;
    const msg = buildDisabledStorefrontMessage(tenant, locale);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'checkout.store_not_published'), show_alert: true }).catch(() => {});
    }
    await ctx.reply(msg, { parse_mode: 'HTML' });
    return;
  }

  if (!isPaynetCheckoutEnabled(tenant)) {
    ctx.session.checkoutStep = undefined;
    const msg = buildPaynetUnavailableMessage(tenant, locale);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'checkout.paynet_unavailable'), show_alert: true }).catch(() => {});
    }
    await ctx.reply(msg, { parse_mode: 'HTML' });
    return;
  }

  const validPhone = normalizePhoneNumber(ctx.session.customerPhone);
  const deliveryMethod: DeliveryMethod | undefined =
    ctx.session.deliveryMethod === 'PICKUP'
      ? 'PICKUP'
      : ctx.session.deliveryMethod === 'COURIER'
        ? 'COURIER'
        : undefined;
  const rawAddress = (ctx.session.shippingAddress || '').trim();

  if (
    !validPhone ||
    !deliveryMethod ||
    (deliveryMethod === 'COURIER' && (!rawAddress || rawAddress === 'Самовывоз'))
  ) {
    await handleCartCheckout(ctx);
    return;
  }

  const resolvedAddress = deliveryMethod === 'PICKUP' ? 'Самовывоз' : rawAddress;
  const telegramUserId = from?.id ? String(from.id) : 'unknown_user';
  const customerName = `${from?.first_name || ''} ${from?.last_name || ''}`.trim() || 'Telegram Customer';
  const accessToken = crypto.randomBytes(24).toString('hex');
  const nowIso = new Date().toISOString();

  let order: {
    id: string;
    subtotal: number;
    deliveryFee: number;
    totalAmount: number;
  };

  try {
    order = await prisma.$transaction(async (tx) => {
      const verifiedItems: Array<{
        productId: string;
        title: string;
        price: number;
        quantity: number;
        variant?: string;
      }> = [];
      let subtotal = 0;

      for (const item of cart) {
        if (!item.quantity || item.quantity <= 0) {
          throw new Error(
            locale === 'uz'
              ? "Noto'g'ri mahsulot miqdori."
              : locale === 'en'
                ? 'Invalid item quantity.'
                : 'Некорректное количество товара.'
          );
        }

        const product = await tx.product.findFirst({
          where: { id: item.productId, tenant_id: tenant.id, is_active: true },
        });

        if (!product) {
          throw new Error(
            locale === 'uz'
              ? `«${item.title}» mahsuloti topilmadi yoki sotuvda emas.`
              : locale === 'en'
                ? `Product "${item.title}" is not found or unavailable.`
                : `Товар «${item.title}» не найден или недоступен.`
          );
        }

        const affectedRows = await tx.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" - ${item.quantity}
          WHERE "id" = ${item.productId}
            AND "tenant_id" = ${tenant.id}
            AND "stock" >= ${item.quantity}
            AND "is_active" = true
        `;

        if (affectedRows !== 1) {
          throw new Error(
            locale === 'uz'
              ? `«${product.title}» yetarli emas (qoldiq: ${product.stock} dona).`
              : locale === 'en'
                ? `Insufficient stock for "${product.title}" (available: ${product.stock}).`
                : `Недостаточно товара «${product.title}» на складе (доступно: ${product.stock} шт.).`
          );
        }

        const unitPrice = Number(product.price);
        subtotal += unitPrice * item.quantity;
        verifiedItems.push({
          productId: product.id,
          title: product.title,
          price: unitPrice,
          quantity: item.quantity,
          ...(item.variant ? { variant: item.variant } : {}),
        });
      }

      const verifiedTotals = computeCheckoutTotals(verifiedItems, tenant, deliveryMethod);

      const createdOrder = await tx.order.create({
        data: {
          tenant_id: tenant.id,
          customer_telegram_id: telegramUserId,
          customer_name: customerName,
          total_amount: verifiedTotals.totalAmount as any,
          delivery_fee: verifiedTotals.deliveryFee as any,
          delivery_method: deliveryMethod,
          status: ORDER_STATUS.PENDING as any,
          payment_method: PAYMENT_METHODS.PAYNET_XOLIS,
          access_token: accessToken,
          status_history: [{ status: ORDER_STATUS.PENDING, at: nowIso, by: 'customer' }] as any,
          items: verifiedItems as any,
          shipping_address: resolvedAddress,
          customer_phone: validPhone,
        } as any,
      });

      return {
        id: createdOrder.id,
        subtotal: verifiedTotals.subtotal,
        deliveryFee: verifiedTotals.deliveryFee,
        totalAmount: verifiedTotals.totalAmount,
      };
    });
  } catch (err: any) {
    const errorMsg = err?.message || 'Insufficient stock';
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: errorMsg.slice(0, 190), show_alert: true }).catch(() => {});
    }
    await ctx.reply(`⚠️ ${t(locale, 'checkout.failed', { error: escapeHtml(errorMsg) })}`, {
      parse_mode: 'HTML',
    });
    return;
  }

  const paynetUrl = String(tenant.themeConfig!.paynetQrUrl!).trim();

  const payKeyboard = new InlineKeyboard()
    .url(t(locale, 'checkout.paynet_btn'), paynetUrl)
    .row()
    .text(t(locale, 'checkout.paynet_confirm_btn'), `order:pay:${order.id}`);

  const deliveryFeeText =
    order.deliveryFee === 0
      ? t(locale, 'checkout.delivery_free')
      : formatCurrency(order.deliveryFee, currency, locale);
  const deliveryLabel =
    deliveryMethod === 'PICKUP'
      ? t(locale, 'checkout.delivery_pickup')
      : t(locale, 'checkout.delivery_courier');
  const disclosureBlock = buildSellerDisclosureBlock(tenant, locale);

  const text = `
${t(locale, 'checkout.created')}

${t(locale, 'checkout.order_id', { orderId: order.id.slice(0, 8) })}
📦 <b>${t(locale, 'checkout.items_subtotal')}:</b> ${formatCurrency(order.subtotal, currency, locale)}
🚚 <b>${t(locale, 'checkout.delivery_fee')}:</b> ${deliveryFeeText} (${escapeHtml(deliveryLabel)})
${t(locale, 'checkout.total', { total: formatCurrency(order.totalAmount, currency, locale) })}

${t(locale, 'checkout.paynet_instructions')}${disclosureBlock ? `\n\n${disclosureBlock}` : ''}
`.trim();

  // Clear cart & active checkout step only after order persistence succeeds
  ctx.session.cart = [];
  ctx.session.checkoutStep = undefined;
  ctx.session.deliveryMethod = undefined;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: payKeyboard }).catch(async () => {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: payKeyboard });
    });
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: payKeyboard,
    });
  }
}

export async function cancelCheckoutFlow(ctx: BotContext) {
  const locale = ctx.locale;
  ctx.session.checkoutStep = undefined;
  ctx.session.deliveryMethod = undefined;

  const cancelledText =
    locale === 'uz'
      ? '❌ Buyurtma rasmiylashtirish bekor qilindi. Savatingiz saqlandi.'
      : locale === 'en'
        ? '❌ Checkout cancelled. Your cart has been preserved.'
        : '❌ Оформление заказа отменено. Товары остались в вашей корзине.';

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  await ctx.reply(cancelledText, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(ctx.tenant, locale),
  });
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
