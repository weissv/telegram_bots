import { BotContext } from '../types.js';
import { getMainMenuKeyboard } from '../keyboards/index.js';
import { getEnv, PLAN_TIERS } from '@telegram-commerce/config';

export async function handleStart(ctx: BotContext) {
  const { tenant } = ctx;
  const storeName = tenant.themeConfig?.storeName || tenant.name || 'Store';
  const bannerUrl = tenant.themeConfig?.bannerUrl;
  const description =
    tenant.themeConfig?.description || 'Browse our catalog and place your order directly in Telegram.';

  const isPro = tenant.plan === PLAN_TIERS.PRO_30 || tenant.plan === PLAN_TIERS.STANDALONE_LIFETIME;

  const welcomeMessage = `
🛍️ <b>Welcome to ${escapeHtml(storeName)}!</b>

${escapeHtml(description)}

${isPro ? '✨ <i>Tip: Tap the "🛍️ Open Storefront App" button below for an immersive visual shopping experience!</i>' : '📦 <i>Use the keyboard below to browse products, manage your cart, and track orders.</i>'}
`.trim();

  const keyboard = getMainMenuKeyboard(tenant);

  if (bannerUrl) {
    try {
      await ctx.replyWithPhoto(bannerUrl, {
        caption: welcomeMessage,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    } catch {
      // Fallback to text message if image fails to load
    }
  }

  await ctx.reply(welcomeMessage, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
