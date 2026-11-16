import { InlineKeyboard, type Context } from 'grammy';
import { prisma } from '@telegram-commerce/database';
import { getEnv, isHttpsUrl, isSafeTelegramUrl, DEFAULT_PAYNET_QR_URL } from '@telegram-commerce/config';
import { escapeHtml, formatUzs } from '../utils.js';

interface DemoCartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
}

function getCart(ctx: Context): DemoCartItem[] {
  const session = (ctx as any).session;
  if (!session) return [];
  if (!session.chatDemoCart) session.chatDemoCart = [];
  return session.chatDemoCart;
}

function formatPrice(amount: number): string {
  return formatUzs(amount, 'ru');
}

export async function handleChatBotDemoCatalog(ctx: Context, pageIndex = 0, isEdit = false) {
  const env = getEnv();
  const demoTenantId = env.STANDALONE_TENANT_ID || '00000000-0000-0000-0000-000000000001';

  let products = await prisma.product.findMany({
    where: { tenant_id: demoTenantId, is_active: true },
    orderBy: { createdAt: 'desc' },
  });

  // Fallback realistic Tashkent products if DB is empty
  if (products.length === 0) {
    products = [
      {
        id: 'p1',
        tenant_id: demoTenantId,
        title: 'Оверсайз худи Tashkent Edition',
        description: 'Плотный футер 420г/м² из 100% узбекского хлопка пенье. Мягкий начес, глубокий капюшон, минималистичная вышивка.',
        price: '420000' as any,
        stock: 35,
        category: 'Одежда',
        images: ['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80'],
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'p2',
        tenant_id: demoTenantId,
        title: 'Базовая футболка Heavyweight Cotton',
        description: 'Премиальный плотный узбекский хлопок 240г/м². Идеальная свободная посадка, не теряет форму после стирок.',
        price: '190000' as any,
        stock: 50,
        category: 'Одежда',
        images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'],
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'p3',
        tenant_id: demoTenantId,
        title: 'Кожаные кроссовки Classic Street Low',
        description: 'Натуральная матовая телячья кожа, анатомическая стелька с поддержкой стопы, износостойкая подошва.',
        price: '650000' as any,
        stock: 20,
        category: 'Обувь',
        images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'],
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'p4',
        tenant_id: demoTenantId,
        title: 'Бейсболка с вышивкой Toshkent',
        description: 'Плотный саржевый хлопок, металлическая застежка-регулятор, вентиляционные люверсы.',
        price: '140000' as any,
        stock: 45,
        category: 'Аксессуары',
        images: ['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80'],
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  const total = products.length;
  const currentIdx = Math.max(0, Math.min(pageIndex, total - 1));
  const product = products[currentIdx];
  const cart = getCart(ctx);
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  (ctx as any).session.chatDemoIndex = currentIdx;

  const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
  const keyboard = new InlineKeyboard();

  // Row 1: Add to cart
  keyboard.text(`➕ В корзину (${formatPrice(Number(product.price))})`, `chatdemo:add:${product.id}`);

  // Row 2: Navigation
  keyboard.row();
  if (currentIdx > 0) {
    keyboard.text('⬅️ Назад', `chatdemo:nav:${currentIdx - 1}`);
  } else {
    keyboard.text('⏹️ Начало', `chatdemo:nav:0`);
  }
  keyboard.text(`📄 ${currentIdx + 1} / ${total}`, `chatdemo:nav:${currentIdx}`);
  if (currentIdx < total - 1) {
    keyboard.text('Вперед ➡️', `chatdemo:nav:${currentIdx + 1}`);
  } else {
    keyboard.text('Конец ⏹️', `chatdemo:nav:${total - 1}`);
  }

  // Row 3: Cart View
  keyboard.row().text(`🛒 Корзина в чате (${totalCartCount})`, 'chatdemo:cart');

  // Row 4: Compare with Mini App
  if (isHttpsUrl(miniappUrl)) {
    keyboard.row().webApp('📱 Открыть эту же витрину в Mini App', miniappUrl);
  } else if (isSafeTelegramUrl(miniappUrl)) {
    keyboard.row().url('📱 Открыть витрину в Mini App', miniappUrl);
  }

  // Row 5: Return to main menu
  keyboard.row().text('🏠 Главное меню', 'chatdemo:menu');

  const text = `
🛍️ <b>ДЕМО ОБЫЧНОГО БОТА (ПОКУПКИ В ЧАТЕ)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>${escapeHtml(product.title)}</b>
📁 <i>Категория: ${escapeHtml(product.category || 'Одежда')}</i>
💰 <b>Цена:</b> <code>${formatPrice(Number(product.price))}</code>
🟢 <b>В наличии:</b> ${product.stock} шт.

📝 <b>Описание:</b>
${escapeHtml(product.description || 'Качественный товар с быстрой доставкой по Ташкенту.')}

<i>👆 Листайте товары кнопками ниже или нажмите «В корзину»!</i>
`.trim();

  const photoUrl = product.images?.[0];

  try {
    if (photoUrl && !isEdit) {
      await ctx.replyWithPhoto(photoUrl, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    }
  } catch {
    // fallback to text reply if photo fails
  }

  if (isEdit && ctx.callbackQuery?.message) {
    try {
      if (ctx.callbackQuery.message.caption !== undefined) {
        await ctx.editMessageCaption({
          caption: text,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
      } else {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
      }
    } catch {
      // If edit fails, send a fresh message
    }
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handleChatBotDemoAddToCart(ctx: Context, productId: string) {
  const env = getEnv();
  const demoTenantId = env.STANDALONE_TENANT_ID || '00000000-0000-0000-0000-000000000001';

  let product = await prisma.product.findUnique({
    where: { id: productId },
  });

  const cart = getCart(ctx);
  const existing = cart.find((i) => i.id === productId);

  if (product) {
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        title: product.title,
        price: Number(product.price),
        quantity: 1,
      });
    }
    await ctx.answerCallbackQuery({
      text: `✅ «${product.title.slice(0, 24)}» добавлен в корзину!`,
    });
  } else {
    // demo fallback
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: productId,
        title: 'Товар каталога',
        price: 350000,
        quantity: 1,
      });
    }
    await ctx.answerCallbackQuery({ text: '✅ Товар добавлен в корзину!' });
  }

  // Refresh current view to update cart badge
  const currentIndex = (ctx as any).session.chatDemoIndex || 0;
  await handleChatBotDemoCatalog(ctx, currentIndex, true);
}

export async function handleChatBotDemoViewCart(ctx: Context) {
  const cart = getCart(ctx);
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const keyboard = new InlineKeyboard();

  if (cart.length === 0) {
    keyboard.text('📦 Перейти в каталог товаров', 'chatdemo:catalog');
    keyboard.row().text('🏠 Главное меню', 'chatdemo:menu');

    const emptyText = `
🛒 <b>ВАША КОРЗИНА В ЧАТЕ ПУСТА</b>

Вы еще не добавили ни одного товара. Нажмите кнопку ниже, чтобы открыть каталог и выбрать понравившиеся вещи!
`.trim();

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
      await ctx.reply(emptyText, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(emptyText, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return;
  }

  let text = `🛒 <b>ВАША КОРЗИНА (ДЕМО БОТА)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  cart.forEach((item, index) => {
    text += `${index + 1}. <b>${escapeHtml(item.title)}</b>\n   ${item.quantity} шт. × ${formatPrice(item.price)} = <code>${formatPrice(item.price * item.quantity)}</code>\n\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💰 <b>Итого к оплате:</b> <b>${formatPrice(totalAmount)}</b> (${totalCount} поз.)\n\n`;
  text += `<i>Оформите заказ в один клик прямо здесь в чате:</i>`;

  keyboard
    .text(`💳 Оформить заказ (${formatPrice(totalAmount)})`, 'chatdemo:checkout')
    .row()
    .text('📦 Добавить еще товары', 'chatdemo:catalog')
    .text('🗑️ Очистить', 'chatdemo:clear')
    .row()
    .text('🏠 Главное меню', 'chatdemo:menu');

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handleChatBotDemoCheckout(ctx: Context) {
  const cart = getCart(ctx);
  if (cart.length === 0) {
    await ctx.answerCallbackQuery({ text: 'Корзина пуста!' });
    await handleChatBotDemoViewCart(ctx);
    return;
  }

  const env = getEnv();
  const demoTenantId = env.STANDALONE_TENANT_ID || '00000000-0000-0000-0000-000000000001';
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const customerTelegramId = String(ctx.from?.id || 'demo');
  const customerName =
    [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ').trim() ||
    (ctx.from?.username ? `@${ctx.from.username}` : 'Покупатель Telegram');

  let order;
  try {
    order = await prisma.order.create({
      data: {
        tenant_id: demoTenantId,
        status: 'PENDING',
        payment_method: 'PAYNET_XOLIS',
        customer_telegram_id: customerTelegramId,
        customer_name: customerName,
        items: cart as any,
        total_amount: totalAmount as any,
      },
    });
  } catch (err: any) {
    console.error('Failed to create demo chat order:', err);
    await ctx.answerCallbackQuery({
      text: '⚠️ Не удалось создать заказ. Попробуйте позже.',
      show_alert: true,
    });
    return;
  }

  // Clear cart only after order persistence succeeds
  (ctx as any).session.chatDemoCart = [];

  const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
  const paynetUrl = DEFAULT_PAYNET_QR_URL;
  const keyboard = new InlineKeyboard()
    .url('⚡ Оплатить в Paynet (0% комиссия)', paynetUrl)
    .row()
    .text('✅ Я оплатил заказ', `chatdemo:pay:${order.id}`);

  if (isHttpsUrl(miniappUrl)) {
    keyboard.row().webApp('📱 Открыть витрину (Mini App)', miniappUrl);
  } else if (isSafeTelegramUrl(miniappUrl)) {
    keyboard.row().url('📱 Открыть витрину (Mini App)', miniappUrl);
  }

  keyboard
    .row()
    .text('🛍️ Вернуться в демо-каталог бота', 'chatdemo:catalog')
    .row()
    .text('🚀 Запустить такой же магазин', 'onboard:start');

  const shortOrderId = order.id.slice(0, 8);
  const text = `
🎉 <b>ЗАКАЗ УСПЕШНО ОФОРМЛЕН!</b>
━━━━━━━━━━━━━━━━━━━━
🧾 <b>Номер заказа:</b> <code>#${shortOrderId}</code>
💰 <b>Сумма:</b> <b>${formatPrice(totalAmount)}</b>
📦 <b>Товаров:</b> ${itemsCount} шт.
🚚 <b>Доставка:</b> Курьером по Ташкенту (в течение 3 часов)
💳 <b>Оплата:</b> Paynet Xolis (0% комиссия)

⚡ <b>Как оплатить через Paynet Xolis:</b>
1. Нажмите кнопку «⚡ Оплатить в Paynet (0% комиссия)» ниже — откроется государственная система QR-Online (Soliq).
2. Подтвердите платеж в приложении Paynet.
3. Нажмите кнопку «✅ Я оплатил заказ», чтобы получить чек и уведомить владельца магазина.

━━━━━━━━━━━━━━━━━━━━
Так работает стандартный <b>Базовый чат-бот ($20/мес)</b>.
Для интерактивного опыта с анимацией выберите <b>Pro Mini App ($30/мес)</b>!
`.trim();

  await ctx.answerCallbackQuery({ text: '🎉 Заказ создан! Ожидает оплаты через Paynet.' });
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handleChatBotDemoConfirmPay(ctx: Context, orderId: string) {
  const env = getEnv();
  const ownerTelegramId = env.STANDALONE_ADMIN_TELEGRAM_ID || '8240936731';

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    await ctx.answerCallbackQuery({ text: '⚠️ Заказ не найден', show_alert: true });
    return;
  }

  const shortOrderId = order.id.slice(0, 8);

  if (order.status === 'PAID') {
    await ctx.answerCallbackQuery({ text: '✅ Заказ уже отмечен как оплаченный!' });
    await ctx.reply(
      `✅ <b>Заказ #${shortOrderId} уже оплачен!</b>\n\n` +
      `Вы можете проверить статус заказа в разделе /orders.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const updateResult = await prisma.order.updateMany({
    where: { id: order.id, status: { not: 'PAID' } },
    data: {
      status: 'PAID',
      payment_method: order.payment_method || 'PAYNET_XOLIS',
      payment_id: `paynet_demo_${Date.now()}`,
    },
  });

  if (updateResult.count === 0) {
    await ctx.answerCallbackQuery({ text: '✅ Заказ уже оплачен!' });
    return;
  }

  const rawItems = Array.isArray(order.items) ? (order.items as Array<Record<string, any>>) : [];
  const itemsSummary = rawItems
    .map((item) => {
      const title = escapeHtml(String(item.title || 'Товар'));
      const qty = Number(item.quantity || 1);
      const lineTotal = Number(item.price || 0) * qty;
      return `  • <b>${title}</b> × ${qty} — <code>${formatPrice(lineTotal)}</code>`;
    })
    .join('\n');

  const totalFormatted = formatPrice(Number(order.total_amount));
  const customerName = escapeHtml(order.customer_name || ctx.from?.first_name || 'Покупатель Telegram');
  const customerUsername = ctx.from?.username ? `@${escapeHtml(ctx.from.username)}` : 'без @username';

  const ownerAlert = `
💰 <b>НОВЫЙ ОПЛАЧЕННЫЙ ЗАКАЗ (Демо-бот Paynet)</b>
━━━━━━━━━━━━━━━━━━━━
🧾 <b>Заказ:</b> <code>#${shortOrderId}</code>
💵 <b>Сумма:</b> <b>${totalFormatted}</b>
💳 <b>Способ оплаты:</b> Paynet Xolis (QR-Online)
👤 <b>Покупатель:</b> ${customerName} (${customerUsername})
🆔 <b>Telegram ID:</b> <code>${escapeHtml(order.customer_telegram_id)}</code>

📦 <b>Состав заказа:</b>
${itemsSummary || '  • Позиции демо-каталога'}
`.trim();

  try {
    await ctx.api.sendMessage(ownerTelegramId, ownerAlert, { parse_mode: 'HTML' });
  } catch (err) {
    console.warn(`Failed to send demo order payment alert to owner ${ownerTelegramId}:`, err);
  }

  await ctx.answerCallbackQuery({ text: '✅ Оплата подтверждена!' });

  const receiptKeyboard = new InlineKeyboard()
    .text('🛍️ Вернуться в каталог', 'chatdemo:catalog')
    .row()
    .text('🚀 Запустить свой магазин', 'onboard:start');

  const receiptText = `
✅ <b>ОПЛАТА ПОЛУЧЕНА! ВАШ ЧЕК:</b>
━━━━━━━━━━━━━━━━━━━━
🧾 <b>Заказ:</b> <code>#${shortOrderId}</code>
💰 <b>Оплачено:</b> <b>${totalFormatted}</b>
💳 <b>Метод:</b> Paynet Xolis (0% комиссия)
📌 <b>Статус:</b> ✅ Оплачен

📦 <b>Товары:</b>
${itemsSummary || '  • Позиции заказа'}

🔔 <i>Владелец платформы получил мгновенное уведомление в Telegram. Детали всегда доступны по команде /orders.</i>
`.trim();

  await ctx.reply(receiptText, {
    parse_mode: 'HTML',
    reply_markup: receiptKeyboard,
  });
}
