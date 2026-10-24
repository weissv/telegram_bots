import { InlineKeyboard, type Context } from 'grammy';
import { getEnv, PLAN_PRICING, PLAN_TIERS, isSafeTelegramUrl, isHttpsUrl } from '@telegram-commerce/config';
import { createSubscriptionCheckoutSession } from '@telegram-commerce/payments';

export async function handleSales(ctx: Context) {
  const env = getEnv();
  const lang = (ctx as any).session?.lang || 'ru';
  const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;

  if (lang === 'en') {
    const keyboard = new InlineKeyboard();
    if (isHttpsUrl(miniappUrl)) {
      keyboard.webApp('📱 Open Store Mini App', miniappUrl);
    } else if (isSafeTelegramUrl(miniappUrl)) {
      keyboard.url('📱 Open Store Mini App', miniappUrl);
    }

    keyboard
      .row()
      .text('🚀 Setup My Store Bot', 'onboard:start')
      .text('🛍️ Chat Demo', 'demo:view')
      .row()
      .text('🌐 Сменить язык (RU)', 'lang:ru');

    const text = `
🌟 <b>Mirai Shop • Telegram E-Commerce Platform</b>

Transform any Telegram bot into a full-featured online store with instant checkout, live order tracking, and an admin backoffice.

<b>🏆 Plans & Features:</b>
1️⃣ <b>Basic Inline Bot ($20/mo)</b> — Interactive chat catalog, cart, and instant order alerts.
2️⃣ <b>Pro Mini App ($30/mo)</b> — Full-screen Telegram Mini App, animated UI, branding, and Apple/Google Pay.
3️⃣ <b>Standalone VPS ($350 Lifetime)</b> — Dedicated private server, zero monthly fees, full source code.

👇 <b>Tap below to test our live Mini App or launch your own store!</b>
`.trim();

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    return;
  }

  // Primary Russian Version
  const keyboard = new InlineKeyboard();

  if (isHttpsUrl(miniappUrl)) {
    keyboard.webApp('📱 Открыть витрину (Mini App)', miniappUrl);
  } else if (isSafeTelegramUrl(miniappUrl)) {
    keyboard.url('📱 Открыть витрину (Mini App)', miniappUrl);
  }

  keyboard
    .row()
    .text('🚀 Запустить свой магазин', 'onboard:start')
    .text('🛍️ Демо в чате', 'demo:view')
    .row()
    .text('🌐 English / O\'zbekcha', 'lang:select');

  const text = `
🌟 <b>Mirai Shop • Платформа интернет-магазинов в Telegram</b>

Превратите ваш Telegram-бот в полноценный современный онлайн-магазин с каталогом, корзиной, приемом платежей и веб-панелью управления для владельца.

<b>🏆 ТАРИФЫ И ВОЗМОЖНОСТИ:</b>

1️⃣ <b>Базовый чат-бот — $20 / мес</b>
 • Интерактивный каталог товаров с категориями и поиском
 • Управление корзиной и расчет стоимости в чате
 • Моментальные уведомления о новых заказах мерчанту
 • Веб-панель управления товарами и заказами

2️⃣ <b>Pro Mini App витрина — $30 / мес</b> <i>(Рекомендуемый)</i>
 • <b>Полноэкранное Telegram Mini App (TWA)</b> с плавным интерфейсом
 • Персональный брендинг, логотипы, баннеры и фирменные цвета
 • Фильтрация, галереи фото высокого разрешения и мгновенный поиск
 • Моментальная оплата картами / Apple Pay / Google Pay в один клик

3️⃣ <b>Автономный сервер (Standalone VPS) — $350 навсегда</b>
 • Развертывание на вашем отдельном выделенном VPS
 • 0% комиссии с продаж, отсутствие абонентской платы
 • Полный доступ к исходному коду и данным

👇 <b>Нажмите кнопку ниже, чтобы протестировать магазин или создать свой:</b>
`.trim();

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
