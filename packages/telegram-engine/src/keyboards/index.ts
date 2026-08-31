import { InlineKeyboard, Keyboard } from 'grammy';
import { TenantInfo, CartItem } from '../types.js';
import { getEnv, PLAN_TIERS } from '@telegram-commerce/config';
import { t, type Locale } from '@telegram-commerce/i18n';

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
    keyboard.webApp(t(locale, 'kb.open_store'), webAppUrl).row();
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
 * Builds interactive paginated catalog inline keyboard with category filtering.
 */
export function getCatalogInlineKeyboard(
  productId: string,
  page: number,
  totalPages: number,
  categories: string[],
  locale: Locale,
  currentCategory?: string
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

  // Add to cart button
  keyboard.row(InlineKeyboard.text(t(locale, 'catalog.add_to_cart'), `cart:add:${productId}`));

  // Pagination navigation row
  const navRow = [];
  if (page > 1) {
    navRow.push(InlineKeyboard.text(t(locale, 'catalog.prev'), `page:${page - 1}`));
  }
  navRow.push(InlineKeyboard.text(
    t(locale, 'catalog.page_of', { current: page, total: Math.max(1, totalPages) }),
    'noop'
  ));
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
export function getCartInlineKeyboard(cart: CartItem[], currency: string, locale: Locale): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (cart.length === 0) {
    keyboard.text(t(locale, 'cart.continue'), 'catalog:browse');
    return keyboard;
  }

  // Item adjustments
  cart.forEach((item) => {
    keyboard.row(
      InlineKeyboard.text(`❌ ${item.title.slice(0, 14)}`, `cart:remove:${item.productId}`),
      InlineKeyboard.text(`➖`, `cart:dec:${item.productId}`),
      InlineKeyboard.text(`${item.quantity}`, 'noop'),
      InlineKeyboard.text(`➕`, `cart:inc:${item.productId}`)
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
  keyboard.url(t(locale, 'webapp.upgrade_btn'), `${env.PUBLIC_LANDING_URL}#pricing`);
  return keyboard;
}
