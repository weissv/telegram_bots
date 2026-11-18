import { InlineKeyboard, type Context } from 'grammy';
import { getEnv, isSafeTelegramUrl, isHttpsUrl } from '@telegram-commerce/config';
import { resolveLang, type BotLang } from '../utils.js';

interface SalesCopy {
  miniAppBtn: string;
  chatDemoBtn: string;
  adminBtn: string;
  pricingBtn: string;
  onboardBtn: string;
  langBtn: string;
  body: string;
}

const showDemoCreds =
  process.env.ALLOW_DEMO_LOGIN === 'true' || process.env.NODE_ENV !== 'production';

const SALES_COPY: Record<BotLang, SalesCopy> = {
  ru: {
    miniAppBtn: '📱 Демо: Telegram Mini App витрина',
    chatDemoBtn: '🤖 Демо: Обычный бот в чате',
    adminBtn: '💼 Демо: Панель мерчанта (Admin)',
    pricingBtn: '💳 Тарифы и оплата (Paynet)',
    onboardBtn: '🚀 Создать свой магазин',
    langBtn: "🌐 Сменить язык / O'zbekcha / EN",
    body: `
🛍️ <b>MODA Tashkent • Платформа Telegram-торговли</b>

Добро пожаловать в витрину передовых решений для e-commerce в Telegram в Узбекистане и СНГ.

<b>Выберите, какую демо-версию протестировать прямо сейчас:</b>

1️⃣ <b>📱 Полноэкранный Telegram Mini App (TMA):</b>
  • Визуальный каталог, фотогалереи, выбор размеров
  • Интерактивная корзина и моментальный чекаут
  • Оплата через Paynet QR-Online (0% комиссия)

2️⃣ <b>🤖 Обычный бот (покупки прямо в чате):</b>
  • Каталог товаров в сообщениях Telegram с кнопками
  • Управление корзиной и чекаут Paynet прямо в диалоге
  • Для пользователей на слабых смартфонах или медленном интернете

3️⃣ <b>💼 Панель управления (Admin Backoffice):</b>
  • Веб-кабинет для владельца магазина: остатки, заказы, аналитика${showDemoCreds ? '\n  • Логин: <code>demo_merchant@telegram-commerce.local</code> / Пароль: <code>password123</code>' : ''}

👇 <b>Нажмите на нужную кнопку ниже:</b>
`.trim(),
  },
  uz: {
    miniAppBtn: '📱 Demo: Telegram Mini App vitrina',
    chatDemoBtn: '🤖 Demo: Oddiy chat-bot',
    adminBtn: '💼 Demo: Sotuvchi paneli (Admin)',
    pricingBtn: "💳 Tariflar va to'lov (Paynet)",
    onboardBtn: "🚀 O'z do'koningizni yaratish",
    langBtn: "🌐 Tilni o'zgartirish / RU / EN",
    body: `
🛍️ <b>MODA Tashkent • Telegram Savdo Platformasi</b>

O'zbekiston va MDHda Telegram orqali zamonaviy e-commerce yechimlari vitrinasiga xush kelibsiz.

<b>Hozir sinab ko'rmoqchi bo'lgan demo versiyani tanlang:</b>

1️⃣ <b>📱 To'liq ekranli Telegram Mini App (TMA):</b>
  • Vizual katalog, fotogalereya, o'lcham tanlash
  • Interaktiv savatcha va tezkor buyurtma
  • Paynet QR-Online orqali to'lov (0% komissiya)

2️⃣ <b>🤖 Oddiy bot (to'g'ridan-to'g'ri chatda xarid):</b>
  • Tugmali Telegram xabarlarida mahsulotlar katalogi
  • Savatchani boshqarish va chat ichida Paynet orqali to'lash
  • Sekin internet yoki oddiy smartfonlar uchun qulay

3️⃣ <b>💼 Boshqaruv paneli (Admin Backoffice):</b>
  • Do'kon egasi uchun veb-kabinet: qoldiqlar, buyurtmalar, tahlil${showDemoCreds ? '\n  • Login: <code>demo_merchant@telegram-commerce.local</code> / Parol: <code>password123</code>' : ''}

👇 <b>Quyidagi kerakli tugmani bosing:</b>
`.trim(),
  },
  en: {
    miniAppBtn: '📱 Demo: Telegram Mini App Storefront',
    chatDemoBtn: '🤖 Demo: Standard Inline Chat Bot',
    adminBtn: '💼 Demo: Merchant Admin Panel',
    pricingBtn: '💳 Pricing & Payment (Paynet)',
    onboardBtn: '🚀 Create Your Own Store',
    langBtn: "🌐 Change Language / RU / O'zbekcha",
    body: `
🛍️ <b>MODA Tashkent • Telegram Commerce Platform</b>

Welcome to the showcase of next-gen Telegram e-commerce solutions for Uzbekistan and CIS.

<b>Choose a live demo to test right now:</b>

1️⃣ <b>📱 Fullscreen Telegram Mini App (TMA):</b>
  • Visual catalog, photo galleries, size selection
  • Interactive cart and instant checkout
  • Paynet QR-Online payment integration (0% commission)

2️⃣ <b>🤖 Standard Bot (in-chat shopping):</b>
  • Button-driven product catalog inside Telegram chat
  • Cart management and Paynet checkout right in the dialog
  • Great for older devices or slow internet connections

3️⃣ <b>💼 Merchant Backoffice (Admin Panel):</b>
  • Web dashboard for store owners: stock, orders, analytics${showDemoCreds ? '\n  • Login: <code>demo_merchant@telegram-commerce.local</code> / Password: <code>password123</code>' : ''}

👇 <b>Tap a button below to get started:</b>
`.trim(),
  },
};

export async function handleSales(ctx: Context) {
  const env = getEnv();
  const lang = resolveLang(ctx);
  const copy = SALES_COPY[lang];
  const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
  const adminUrl = env.PUBLIC_ADMIN_URL;

  const keyboard = new InlineKeyboard();

  if (isHttpsUrl(miniappUrl)) {
    keyboard.webApp(copy.miniAppBtn, miniappUrl).row();
  } else if (isSafeTelegramUrl(miniappUrl)) {
    keyboard.url(copy.miniAppBtn, miniappUrl).row();
  }

  keyboard.text(copy.chatDemoBtn, 'chatdemo:catalog').row();

  if (isSafeTelegramUrl(adminUrl)) {
    keyboard.url(copy.adminBtn, adminUrl).row();
  }

  keyboard
    .text(copy.pricingBtn, 'pricing:view')
    .row()
    .text(copy.onboardBtn, 'onboard:start')
    .row()
    .text(copy.langBtn, 'lang:select');

  await ctx.reply(copy.body, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
