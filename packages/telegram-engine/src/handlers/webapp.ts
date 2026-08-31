import { BotContext } from '../types.js';
import { InlineKeyboard } from 'grammy';
import { getEnv, PLAN_TIERS } from '@telegram-commerce/config';
import { getUpgradeInlineKeyboard } from '../keyboards/index.js';

export async function handleWebApp(ctx: BotContext) {
  const { tenant } = ctx;
  const env = getEnv();

  const isProOrStandalone =
    tenant.plan === PLAN_TIERS.PRO_30 || tenant.plan === PLAN_TIERS.STANDALONE_LIFETIME;

  if (isProOrStandalone) {
    const webAppUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=${tenant.id}`;
    const keyboard = new InlineKeyboard().webApp('🛍️ Open Storefront App', webAppUrl);

    await ctx.reply(
      '✨ <b>Tap below to open our interactive Mini App Storefront:</b>',
      {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      }
    );
  } else {
    // Basic $20 Plan Feature Gate
    const keyboard = getUpgradeInlineKeyboard();
    await ctx.reply(
      `
🚀 <b>Telegram Mini App Storefront</b>

The interactive Mini App is available on the <b>Pro Plan ($30/mo)</b> or <b>Standalone VPS ($350)</b>.

<b>Pro Plan Features:</b>
 • Full-screen visual app storefront with animated cart & search
 • Native Telegram theme integration and haptic feedback
 • Category filters and high-resolution photo galleries
 • Instant single-tap checkout
`.trim(),
      {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      }
    );
  }
}
