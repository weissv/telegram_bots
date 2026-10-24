import { InlineKeyboard, type Context } from 'grammy';
import { getEnv, isHttpsUrl, isSafeTelegramUrl } from '@telegram-commerce/config';

export async function handleDemo(ctx: Context) {
  const env = getEnv();
  const lang = (ctx as any).session?.lang || 'ru';
  const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
  const adminUrl = env.PUBLIC_ADMIN_URL;

  const keyboard = new InlineKeyboard();

  if (isHttpsUrl(miniappUrl)) {
    keyboard.webApp(lang === 'en' ? '📱 Open Demo Mini App' : '📱 Открыть демо Mini App', miniappUrl);
  } else if (isSafeTelegramUrl(miniappUrl)) {
    keyboard.url(lang === 'en' ? '📱 Open Demo Mini App' : '📱 Открыть демо Mini App', miniappUrl);
  } else {
    keyboard.text(lang === 'en' ? '🛍️ View Demo Products' : '🛍️ Товары каталога', 'demo:products');
  }

  if (isSafeTelegramUrl(adminUrl)) {
    keyboard.row().url(lang === 'en' ? '💼 View Merchant Admin Demo' : '💼 Панель управления (Админка)', adminUrl);
  }

  keyboard.row().text(lang === 'en' ? '🚀 Ready to build yours? Click here' : '🚀 Создать свой магазин', 'onboard:start');

  const text = lang === 'en' ? `
✨ <b>Interactive Live Demos</b>

Experience the power of our Telegram Commerce Platform:

1. <b>Customer Mini App:</b> Test the fast, responsive storefront with category tabs, cart slide-over, and instant checkout.
2. <b>Merchant Admin Backoffice:</b> Test real-time product catalog editing, order status workflows, and live sales analytics.
`.trim() : `
✨ <b>Интерактивное тестирование платформы</b>

Оцените ключевые возможности Telegram Commerce:

1. <b>Витрина покупателя (Mini App):</b> Полноэкранный магазин прямо в Telegram, фильтрация по категориям, интерактивная корзина и моментальный чекаут.
2. <b>Панель управления (Admin):</b> Управление каталогом товаров в реальном времени, статусы заказов и аналитика продаж.
`.trim();

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
