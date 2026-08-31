import { InlineKeyboard, type Context } from 'grammy';
import { getEnv } from '@telegram-commerce/config';

export async function handleDemo(ctx: Context) {
  const env = getEnv();

  const keyboard = new InlineKeyboard()
    .webApp('📱 Open Demo Mini App', `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`)
    .row()
    .url('💼 View Merchant Admin Demo', `${env.PUBLIC_ADMIN_URL}`)
    .row()
    .text('🚀 Ready to build yours? Click here', 'onboard:start');

  const text = `
✨ <b>Interactive Live Demos</b>

Experience the power of our Telegram Commerce Platform:

1. <b>Customer Mini App:</b> Test the fast, responsive storefront with category tabs, cart slide-over, and instant checkout.
2. <b>Merchant Admin Backoffice:</b> Test real-time product catalog editing, order status workflows, and live sales analytics.
`.trim();

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
