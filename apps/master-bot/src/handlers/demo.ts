import { InlineKeyboard, type Context } from 'grammy';
import { getEnv, isHttpsUrl, isSafeTelegramUrl } from '@telegram-commerce/config';
import { resolveLang, type BotLang } from '../utils.js';

interface DemoCopy {
  miniAppBtn: string;
  fallbackProductsBtn: string;
  adminBtn: string;
  onboardBtn: string;
  body: string;
}

const DEMO_COPY: Record<BotLang, DemoCopy> = {
  ru: {
    miniAppBtn: '📱 Открыть демо Mini App',
    fallbackProductsBtn: '🛍️ Товары каталога',
    adminBtn: '💼 Панель управления (Админка)',
    onboardBtn: '🚀 Создать свой магазин',
    body: `
✨ <b>Интерактивное тестирование платформы</b>

Оцените ключевые возможности Telegram Commerce:

1. <b>Витрина покупателя (Mini App):</b> Полноэкранный магазин прямо в Telegram, фильтрация по категориям, интерактивная корзина и моментальный чекаут через Paynet.
2. <b>Панель управления (Admin):</b> Управление каталогом товаров в реальном времени, статусы заказов и аналитика продаж.
`.trim(),
  },
  uz: {
    miniAppBtn: '📱 Demo Mini Appni ochish',
    fallbackProductsBtn: "🛍️ Katalog mahsulotlarini ko'rish",
    adminBtn: '💼 Boshqaruv paneli (Admin)',
    onboardBtn: "🚀 O'z do'koningizni yaratish",
    body: `
✨ <b>Platformani jonli sinab ko'rish</b>

Telegram Commerce imkoniyatlarini baholang:

1. <b>Xaridor vitrinasi (Mini App):</b> Telegram ichida to'liq ekranli do'kon, toifalar bo'yicha saralash, interaktiv savatcha va Paynet orqali tezkor to'lov.
2. <b>Boshqaruv paneli (Admin):</b> Mahsulot katalogini real vaqtda tahrirlash, buyurtma holatlari va savdo tahlili.
`.trim(),
  },
  en: {
    miniAppBtn: '📱 Open Demo Mini App',
    fallbackProductsBtn: '🛍️ View Demo Products',
    adminBtn: '💼 View Merchant Admin Demo',
    onboardBtn: '🚀 Ready to build yours? Click here',
    body: `
✨ <b>Interactive Live Demos</b>

Experience the power of our Telegram Commerce Platform:

1. <b>Customer Mini App:</b> Test the fast, responsive storefront with category tabs, cart slide-over, and instant Paynet checkout.
2. <b>Merchant Admin Backoffice:</b> Test real-time product catalog editing, order status workflows, and live sales analytics.
`.trim(),
  },
};

export async function handleDemo(ctx: Context) {
  const env = getEnv();
  const lang = resolveLang(ctx);
  const copy = DEMO_COPY[lang];
  const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
  const adminUrl = env.PUBLIC_ADMIN_URL;

  const keyboard = new InlineKeyboard();

  if (isHttpsUrl(miniappUrl)) {
    keyboard.webApp(copy.miniAppBtn, miniappUrl);
  } else if (isSafeTelegramUrl(miniappUrl)) {
    keyboard.url(copy.miniAppBtn, miniappUrl);
  } else {
    keyboard.text(copy.fallbackProductsBtn, 'demo:products');
  }

  if (isSafeTelegramUrl(adminUrl)) {
    keyboard.row().url(copy.adminBtn, adminUrl);
  }

  keyboard.row().text(copy.onboardBtn, 'onboard:start');

  await ctx.reply(copy.body, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
