import { InlineKeyboard, type Context, InputFile } from 'grammy';
import { prisma } from '@telegram-commerce/database';
import { getEnv, isHttpsUrl, isSafeTelegramUrl } from '@telegram-commerce/config';

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
  // Format as Uzbek Sums (UZS)
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(amount))} сум`;
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
  keyboard.row();
  if (isHttpsUrl(miniappUrl)) {
    keyboard.webApp('📱 Открыть эту же витрину в Mini App', miniappUrl);
  } else {
    keyboard.url('📱 Открыть витрину в Mini App', miniappUrl);
  }

  // Row 5: Return to main menu
  keyboard.row().text('🏠 Главное меню', 'chatdemo:menu');

  const text = `
🛍️ <b>ДЕМО ОБЫЧНОГО БОТА (ПОКУПКИ В ЧАТЕ)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>${product.title}</b>
📁 <i>Категория: ${product.category || 'Одежда'}</i>
💰 <b>Цена:</b> <code>${formatPrice(Number(product.price))}</code>
🟢 <b>В наличии:</b> ${product.stock} шт.

📝 <b>Описание:</b>
${product.description || 'Качественный товар с быстрой доставкой по Ташкенту.'}

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
    text += `${index + 1}. <b>${item.title}</b>\n   ${item.quantity} шт. × ${formatPrice(item.price)} = <code>${formatPrice(item.price * item.quantity)}</code>\n\n`;
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

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const orderNum = Math.floor(100000 + Math.random() * 900000);
  const orderId = `TAS-${orderNum}`;

  // Clear cart
  (ctx as any).session.chatDemoCart = [];

  const env = getEnv();
  const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant`;
  const keyboard = new InlineKeyboard();

  if (isHttpsUrl(miniappUrl)) {
    keyboard.webApp('📱 Открыть витрину (Mini App)', miniappUrl);
  } else {
    keyboard.url('📱 Открыть витрину (Mini App)', miniappUrl);
  }

  keyboard
    .row()
    .text('🛍️ Вернуться в демо-каталог бота', 'chatdemo:catalog')
    .row()
    .text('🚀 Запустить такой же магазин', 'onboard:start');

  const text = `
🎉 <b>ЗАКАЗ УСПЕШНО ОФОРМЛЕН!</b>
━━━━━━━━━━━━━━━━━━━━
🧾 <b>Номер заказа:</b> <code>#${orderId}</code>
💰 <b>Сумма:</b> <b>${formatPrice(totalAmount)}</b>
📦 <b>Товаров:</b> ${itemsCount} шт.
🚚 <b>Доставка:</b> Курьером по Ташкенту (в течение 3 часов)
💳 <b>Оплата:</b> Наличными или через Click / Payme при получении

🔔 <i>Мерчант магазина уже получил мгновенное уведомление в Telegram с составом вашего заказа!</i>

━━━━━━━━━━━━━━━━━━━━
Так работает стандартный <b>Базовый чат-бот ($20/мес)</b>.
Для интерактивного опыта с анимацией выберите <b>Pro Mini App ($30/мес)</b>!
`.trim();

  await ctx.answerCallbackQuery({ text: '🎉 Заказ успешно создан!' });
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
