import { InlineKeyboard, Keyboard } from 'grammy';
import { TenantInfo, CartItem } from '../types.js';
import { getEnv, PLAN_TIERS } from '@telegram-commerce/config';

/**
 * Builds standard reply keyboard for bottom menu bar.
 */
export function getMainMenuKeyboard(tenant: TenantInfo): Keyboard {
  const env = getEnv();
  const keyboard = new Keyboard();

  const isProOrStandalone =
    tenant.plan === PLAN_TIERS.PRO_30 || tenant.plan === PLAN_TIERS.STANDALONE_LIFETIME;

  if (isProOrStandalone) {
    const webAppUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=${tenant.id}`;
    keyboard.webApp('🛍️ Open Storefront App', webAppUrl).row();
  }

  keyboard
    .text('📦 Catalog')
    .text('🛒 Cart')
    .row()
    .text('📋 My Orders')
    .text('ℹ️ Store Info');

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
  keyboard.row(InlineKeyboard.text('🛒 Add to Cart (+1)', `cart:add:${productId}`));

  // Pagination navigation row
  const navRow = [];
  if (page > 1) {
    navRow.push(InlineKeyboard.text('⬅️ Prev', `page:${page - 1}`));
  }
  navRow.push(InlineKeyboard.text(`📄 ${page}/${Math.max(1, totalPages)}`, 'noop'));
  if (page < totalPages) {
    navRow.push(InlineKeyboard.text('Next ➡️', `page:${page + 1}`));
  }
  keyboard.row(...navRow);

  // Quick shortcuts
  keyboard.row(
    InlineKeyboard.text('🛒 View Cart', 'cart:view'),
    InlineKeyboard.text('🔍 All Categories', 'cat:all')
  );

  return keyboard;
}

/**
 * Builds interactive cart viewer inline keyboard.
 */
export function getCartInlineKeyboard(cart: CartItem[], currency: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (cart.length === 0) {
    keyboard.text('📦 Browse Products', 'catalog:browse');
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
    InlineKeyboard.text('💳 Proceed to Checkout', 'cart:checkout'),
    InlineKeyboard.text('🗑️ Clear Cart', 'cart:clear')
  );

  keyboard.row(InlineKeyboard.text('📦 Continue Shopping', 'catalog:browse'));

  return keyboard;
}

/**
 * Builds upgrade upsell inline keyboard for Basic plan merchants/customers.
 */
export function getUpgradeInlineKeyboard(): InlineKeyboard {
  const env = getEnv();
  const keyboard = new InlineKeyboard();
  keyboard.url('🚀 Upgrade to Pro Mini App ($30/mo)', `${env.PUBLIC_LANDING_URL}#pricing`);
  return keyboard;
}
