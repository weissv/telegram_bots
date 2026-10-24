import { InlineKeyboard, type Context } from 'grammy';
import { getEnv, isSafeTelegramUrl, isHttpsUrl } from '@telegram-commerce/config';

export async function handleSales(ctx: Context) {
  const env = getEnv();
  const lang = (ctx as any).session?.lang || 'ru';
  const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
  const adminUrl = env.PUBLIC_ADMIN_URL;

  const keyboard = new InlineKeyboard();

  if (isHttpsUrl(miniappUrl)) {
    keyboard.webApp('📱 Демо: Telegram Mini App витрина', miniappUrl);
  } else if (isSafeTelegramUrl(miniappUrl)) {
    keyboard.url('📱 Демо: Telegram Mini App витрина', miniappUrl);
  }

  keyboard
    .row()
    .text('🤖 Демо: Обычный бот в чате', 'chatdemo:catalog')
    .row();

  if (isSafeTelegramUrl(adminUrl)) {
    keyboard.url('💼 Демо: Панель мерчанта (Admin)', adminUrl);
  }

  keyboard
    .row()
    .text('🚀 Создать свой магазин', 'onboard:start')
    .row()
    .text("🌐 Сменить язык / O'zbekcha / EN", 'lang:select');

  const text = `
🛍️ <b>MODA Tashkent • Платформа Telegram-торговли</b>

Добро пожаловать в витрину передовых решений для e-commerce в Telegram в Узбекистане и СНГ.

<b>Выберите, какую демо-версию протестировать прямо сейчас:</b>

1️⃣ <b>📱 Полноэкранный Telegram Mini App (TMA):</b>
  • Визуальный каталог, фотогалереи, выбор размеров
  • Интерактивная корзина и моментальный чекаут
  • Адаптация под тему Telegram и аппаратный Haptic Feedback

2️⃣ <b>🤖 Обычный бот (покупки прямо в чате):</b>
  • Каталог товаров в сообщениях Telegram с кнопками
  • Управление корзиной и расчет суммы прямо в диалоге
  • Для пользователей на слабых смартфонах или медленном интернете

3️⃣ <b>💼 Панель управления (Admin Backoffice):</b>
  • Веб-кабинет для владельца магазина: остатки, заказы, аналитика
  • Логин: <code>demo_merchant@telegram-commerce.local</code> / Пароль: <code>password123</code>

👇 <b>Нажмите на нужную кнопку ниже:</b>
`.trim();

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
