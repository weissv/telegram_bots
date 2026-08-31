import { InlineKeyboard, type Context } from 'grammy';
import { getEnv, PLAN_PRICING, PLAN_TIERS } from '@telegram-commerce/config';
import { createSubscriptionCheckoutSession } from '@telegram-commerce/payments';

export async function handleSales(ctx: Context) {
  const env = getEnv();
  const telegramUserId = ctx.from?.id ? String(ctx.from.id) : '';

  const keyboard = new InlineKeyboard()
    .text('🚀 Setup My Store Bot (Free Trial)', 'onboard:start')
    .row()
    .text('🛍️ Test-Drive Demo Store', 'demo:view')
    .row()
    .url('💳 Pro Plan ($30/mo)', `${env.PUBLIC_LANDING_URL}#pricing`)
    .url('⚡ Standalone VPS ($350)', `${env.PUBLIC_LANDING_URL}#pricing`);

  const text = `
🌟 <b>Telegram E-Commerce Engine — Automated SaaS Platform</b>

Transform any Telegram bot into an enterprise-grade online storefront with instant checkout, live order tracking, and a powerful web admin backoffice.

<b>🏆 PRICING TIERS:</b>

1️⃣ <b>Basic Inline Bot — $20 / month</b>
 • Interactive inline keyboard catalog with pagination
 • In-chat shopping cart & order receipts
 • Instant Telegram alerts for new orders
 • Complete Merchant Web Admin backoffice

2️⃣ <b>Pro Mini App Storefront — $30 / month</b> <i>(Most Popular)</i>
 • <b>Full-Screen Telegram Mini App (TWA)</b> with animated UI
 • Custom brand colors, banners, and logos
 • Category filters, high-resolution galleries, and search
 • Instant one-tap checkout with Apple Pay / Google Pay / Cards

3️⃣ <b>Standalone Self-Hosted VPS — $350 Lifetime</b>
 • 100% isolated private VPS deployment
 • Automated curl-to-bash zero-touch installer with Let's Encrypt SSL
 • Zero monthly fees, zero revenue cuts, full code access

👇 <b>Tap below to launch your store or test our live demo!</b>
`.trim();

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
