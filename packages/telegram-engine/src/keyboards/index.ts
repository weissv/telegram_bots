import crypto from 'node:crypto';
import { InlineKeyboard, Keyboard } from 'grammy';
import { TenantInfo, CartItem } from '../types.js';
import { getEnv, PLAN_TIERS, isSafeTelegramUrl, isHttpsUrl } from '@telegram-commerce/config';
import { t, type Locale } from '@telegram-commerce/i18n';

/**
 * Generates a deterministic callback-safe item key (<= 40 chars, fits 64-byte Telegram limit).
 * Preserves raw productId when no variant is selected for backward compatibility.
 */
export function getCartItemKey(item: Pick<CartItem, 'productId' | 'variant'>): string {
  const variant = (item.variant || '').trim();
  if (!variant) {
    return item.productId;
  }
  const compactId = item.productId.replace(/-/g, '');
  const variantHash = crypto.createHash('sha1').update(variant).digest('hex').slice(0, 6);
  return `${compactId}:${variantHash}`;
}

/**
 * Builds standard reply keyboard for bottom menu bar.
 */
export function getMainMenuKeyboard(tenant: TenantInfo, locale: Locale): Keyboard {
  const env = getEnv();
  const keyboard = new Keyboard();

  const isProOrStandalone =
    tenant.plan === PLAN_TIERS.PRO_30 || tenant.plan === PLAN_TIERS.STANDALONE_LIFETIME;

  if (isProOrStandalone) {
    const webAppUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=${tenant.id}`;
    if (isHttpsUrl(webAppUrl)) {
      keyboard.webApp(t(locale, 'kb.open_store'), webAppUrl).row();
    }
  }

  keyboard
    .text(t(locale, 'kb.catalog'))
    .text(t(locale, 'kb.cart'))
    .row()
    .text(t(locale, 'kb.my_orders'))
    .text(t(locale, 'kb.store_info'))
    .row()
    .text(t(locale, 'kb.change_lang'));

  return keyboard.resized().persistent();
}

/**
 * Builds one-time reply keyboard with native Telegram contact share button.
 */
export function getPhoneRequestKeyboard(locale: Locale): Keyboard {
  const shareLabel =
    locale === 'uz'
      ? '📞 Telefon raqamni yuborish'
      : locale === 'en'
        ? '📞 Share Phone Number'
        : '📞 Отправить мой номер телефона';
  const cancelLabel =
    locale === 'uz'
      ? '❌ Bekor qilish'
      : locale === 'en'
        ? '❌ Cancel'
        : '❌ Отмена';

  return new Keyboard()
    .requestContact(shareLabel)
    .row()
    .text(cancelLabel)
    .resized()
    .oneTime();
}

export interface CatalogKeyboardOptions {
  stock?: number;
  variants?: string[];
}

/**
 * Builds interactive paginated catalog inline keyboard with category filtering and variant selection.
 */
export function getCatalogInlineKeyboard(
  productId: string,
  page: number,
  totalPages: number,
  categories: string[],
  locale: Locale,
  currentCategory?: string,
  options?: CatalogKeyboardOptions
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Category switch buttons
  if (categories.length > 1) {
    const catButtons = categories.slice(0, 3).map((cat) => {
      const label = cat === currentCategory ? `• ${cat} •` : cat;
      return InlineKeyboard.text(label, `cat:${cat}`);
    });
    keyboard.row(...catButtons);
  }

  const stock = options?.stock;
  const variants = Array.isArray(options?.variants)
    ? options.variants.map((v) => String(v).trim()).filter(Boolean)
    : [];

  if (stock !== undefined && stock <= 0) {
    keyboard.row(InlineKeyboard.text(t(locale, 'catalog.stock_out'), 'noop'));
  } else if (variants.length > 0) {
    const compactId = productId.replace(/-/g, '');
    const visibleVariants = variants.slice(0, 8);
    for (let i = 0; i < visibleVariants.length; i += 4) {
      const chunk = visibleVariants.slice(i, i + 4).map((variantLabel, offset) => {
        const idx = i + offset;
        return InlineKeyboard.text(`🛒 ${variantLabel.slice(0, 14)}`, `cart:v:${compactId}:${idx}`);
      });
      keyboard.row(...chunk);
    }
  } else {
    // Add to cart button
    keyboard.row(InlineKeyboard.text(t(locale, 'catalog.add_to_cart'), `cart:add:${productId}`));
  }

  // Pagination navigation row
  const navRow = [];
  if (page > 1) {
    navRow.push(InlineKeyboard.text(t(locale, 'catalog.prev'), `page:${page - 1}`));
  }
  navRow.push(
    InlineKeyboard.text(
      t(locale, 'catalog.page_of', { current: page, total: Math.max(1, totalPages) }),
      'noop'
    )
  );
  if (page < totalPages) {
    navRow.push(InlineKeyboard.text(t(locale, 'catalog.next'), `page:${page + 1}`));
  }
  keyboard.row(...navRow);

  // Quick shortcuts
  keyboard.row(
    InlineKeyboard.text(t(locale, 'catalog.view_cart'), 'cart:view'),
    InlineKeyboard.text(t(locale, 'catalog.all_categories'), 'cat:all')
  );

  return keyboard;
}

/**
 * Builds interactive cart viewer inline keyboard.
 */
export function getCartInlineKeyboard(cart: CartItem[], _currency: string, locale: Locale): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (cart.length === 0) {
    keyboard.text(t(locale, 'cart.continue'), 'catalog:browse');
    return keyboard;
  }

  // Item adjustments
  cart.forEach((item) => {
    const itemKey = getCartItemKey(item);
    const shortTitle = item.variant
      ? `${item.title.slice(0, 10)}(${item.variant.slice(0, 4)})`
      : item.title.slice(0, 14);
    keyboard.row(
      InlineKeyboard.text(`❌ ${shortTitle}`, `cart:remove:${itemKey}`),
      InlineKeyboard.text('➖', `cart:dec:${itemKey}`),
      InlineKeyboard.text(`${item.quantity}`, 'noop'),
      InlineKeyboard.text('➕', `cart:inc:${itemKey}`)
    );
  });

  // Action buttons
  keyboard.row(
    InlineKeyboard.text(t(locale, 'cart.checkout'), 'cart:checkout'),
    InlineKeyboard.text(t(locale, 'cart.clear'), 'cart:clear')
  );

  keyboard.row(InlineKeyboard.text(t(locale, 'cart.continue'), 'catalog:browse'));

  return keyboard;
}

/**
 * Builds upgrade upsell inline keyboard for Basic plan merchants/customers.
 */
export function getUpgradeInlineKeyboard(locale: Locale): InlineKeyboard {
  const env = getEnv();
  const keyboard = new InlineKeyboard();
  const landingUrl = `${env.PUBLIC_LANDING_URL}#pricing`;
  if (isSafeTelegramUrl(landingUrl)) {
    keyboard.url(t(locale, 'webapp.upgrade_btn'), landingUrl);
  } else {
    keyboard.text(t(locale, 'webapp.upgrade_btn'), 'catalog:browse');
  }
  return keyboard;
}
