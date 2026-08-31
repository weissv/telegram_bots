import type { TranslationDictionary } from '../index.js';

export const ru: TranslationDictionary = {
  // ─── Language Selector ───
  'lang.select': '🌐 Выберите язык / Tilni tanlang:',
  'lang.selected': '✅ Язык установлен: Русский 🇷🇺',

  // ─── Start / Welcome ───
  'start.welcome': '🛍️ <b>Добро пожаловать в {storeName}!</b>',
  'start.description_default': 'Просматривайте каталог и оформляйте заказы прямо в Telegram.',
  'start.tip_pro': '✨ <i>Совет: нажмите кнопку «🛍️ Открыть магазин» ниже для визуального шопинга!</i>',
  'start.tip_basic': '📦 <i>Используйте клавиатуру ниже для просмотра товаров, корзины и заказов.</i>',

  // ─── Main Menu Keyboard ───
  'kb.open_store': '🛍️ Открыть магазин',
  'kb.catalog': '📦 Каталог',
  'kb.cart': '🛒 Корзина',
  'kb.my_orders': '📋 Мои заказы',
  'kb.store_info': 'ℹ️ О магазине',
  'kb.change_lang': '🌐 Язык',

  // ─── Catalog ───
  'catalog.title': '🏷️ <b>{title}</b>',
  'catalog.category': '📁 <i>Категория: {category}</i>',
  'catalog.price': '💵 <b>Цена:</b> <code>{price}</code>',
  'catalog.stock_in': '🟢 В наличии',
  'catalog.stock_low': '🟡 Мало ({count} шт.)',
  'catalog.stock_out': '🔴 Нет в наличии',
  'catalog.item_of': '<i>Товар {current} из {total}</i>',
  'catalog.empty': '📦 Каталог пока обновляется. Загляните позже!',
  'catalog.empty_category': 'Товары в категории «<b>{category}</b>» не найдены.',
  'catalog.add_to_cart': '🛒 В корзину (+1)',
  'catalog.prev': '⬅️ Назад',
  'catalog.next': 'Далее ➡️',
  'catalog.page_of': '📄 {current}/{total}',
  'catalog.view_cart': '🛒 Корзина',
  'catalog.all_categories': '🔍 Все категории',

  // ─── Cart ───
  'cart.title': '🛒 <b>ВАША КОРЗИНА</b>',
  'cart.empty': '🛒 <b>Ваша корзина пуста!</b>\n\nПросмотрите каталог, чтобы добавить товары.',
  'cart.total': '💰 <b>Итого:</b> <b>{total}</b>',
  'cart.item_line': '{idx}. <b>{title}</b>\n   {qty} × {price} = <code>{subtotal}</code>',
  'cart.checkout': '💳 Оформить заказ',
  'cart.clear': '🗑️ Очистить',
  'cart.continue': '📦 Продолжить покупки',
  'cart.added': '«{title}» добавлен в корзину! 🛒',
  'cart.not_found': 'Товар не найден или недоступен.',
  'cart.out_of_stock': 'Извините, товар закончился!',
  'cart.max_stock': 'Нельзя добавить больше. Доступно только {stock} шт.',
  'cart.empty_alert': 'Ваша корзина пуста!',

  // ─── Checkout ───
  'checkout.created': '🎉 <b>Заказ создан!</b>',
  'checkout.order_id': '🧾 <b>Заказ:</b> <code>#{orderId}</code>',
  'checkout.total': '💰 <b>Итого:</b> <b>{total}</b>',
  'checkout.pay_prompt': 'Нажмите кнопку ниже для безопасной оплаты.',
  'checkout.pay_now': '💳 Оплатить',
  'checkout.failed': 'Ошибка оформления: {error}',

  // ─── Orders ───
  'orders.title': '📋 <b>ВАШИ ПОСЛЕДНИЕ ЗАКАЗЫ</b>',
  'orders.empty': '📋 <b>У вас пока нет заказов.</b>\n\nНачните покупки в 📦 Каталоге!',
  'orders.browse': '📦 Перейти в каталог',
  'orders.status_pending': '⏳ Ожидает оплаты',
  'orders.status_paid': '✅ Оплачен / В обработке',
  'orders.status_delivered': '🚚 Доставлен',
  'orders.status_cancelled': '❌ Отменён',
  'orders.order_line': '🧾 <b>Заказ #{orderId}</b>\n📅 <i>{date}</i>\n📊 <b>Статус:</b> {status}\n💰 <b>Сумма:</b> <code>{total}</code>\n📦 <i>Товары: {items}</i>',

  // ─── WebApp ───
  'webapp.launch': '🚀 Откройте интерактивный магазин ниже:',
  'webapp.upgrade_title': '✨ <b>Перейдите на Pro план!</b>',
  'webapp.upgrade_body': 'Мини-приложение с визуальным каталогом доступно на тарифе Pro ($30/мес).\n\nМожете продолжать покупки через бота с помощью команды /catalog.',
  'webapp.upgrade_btn': '🚀 Перейти на Pro ($30/мес)',

  // ─── Store Info ───
  'store_info.title': 'ℹ️ <b>Информация о магазине</b>',
  'store_info.default': 'Премиальный Telegram-магазин',

  // ─── Help ───
  'help.title': '🤖 <b>Навигация по магазину</b>',
  'help.commands': '• /start — Приветствие и главное меню\n• /catalog — Каталог товаров\n• /cart — Просмотр корзины\n• /orders — Статус заказов\n• /webapp — Открыть мини-приложение\n• /lang — Сменить язык',

  // ─── Reservation Expiry ───
  'reservation.expired': '⏰ <b>Заказ #{orderId} отменён</b>\n\nВремя на оплату истекло (15 мин). Товары возвращены в наличие.\n\nВы можете оформить новый заказ в любое время.',

  // ─── Merchant Alerts ───
  'merchant.new_order': '🔔 <b>НОВЫЙ ЗАКАЗ!</b>\n\n🧾 Заказ: <code>#{orderId}</code>\n💰 Сумма: <b>{total}</b>\n👤 Покупатель: {customerName}\n📱 Telegram ID: <code>{telegramId}</code>\n📦 Товары:\n{items}',

  // ─── Billing / Subscription ───
  'billing.expired_warning': '🔔 <b>Напоминание о продлении подписки</b>\n\nПодписка для <b>{storeName}</b> недавно истекла. Осталось <b>{days} дн.</b> льготного периода.\n\nПродлите тариф, чтобы избежать приостановки.',
  'billing.deactivated': '⚠️ <b>Магазин приостановлен</b>\n\nПодписка для <b>{storeName}</b> истекла и льготный период закончился. Ваш бот-магазин приостановлен.\n\nПродлите подписку в личном кабинете.',

  // ─── Currency ───
  'currency.usd': '$',
  'currency.uzs': "so'm",
  'currency.rub': '₽',

  // ─── Mini App ───
  'miniapp.loading': 'Загрузка магазина...',
  'miniapp.error_title': 'Магазин недоступен',
  'miniapp.featured': 'Популярная коллекция',
  'miniapp.all_products': 'Все товары',
  'miniapp.items_count': '{count} товаров',
  'miniapp.no_products': 'Товары не найдены',
  'miniapp.no_products_hint': 'Попробуйте изменить поиск или фильтр.',
  'miniapp.search_placeholder': 'Поиск товаров...',
  'miniapp.add_to_cart': 'В корзину',
  'miniapp.in_cart': 'В корзине',
  'miniapp.cart_title': 'Корзина',
  'miniapp.cart_empty': 'Ваша корзина пуста',
  'miniapp.checkout_title': 'Оформление заказа',
  'miniapp.checkout_name': 'Ваше имя',
  'miniapp.checkout_phone': 'Телефон',
  'miniapp.checkout_address': 'Адрес доставки',
  'miniapp.checkout_confirm': 'Подтвердить заказ',
  'miniapp.checkout_processing': 'Обработка...',
  'miniapp.total': 'Итого',
  'miniapp.proceed_checkout': 'Оформить заказ',
  'miniapp.clear_cart': 'Очистить корзину',
  'miniapp.qty': 'Кол-во',

  // ─── Admin Backoffice ───
  'admin.dashboard': 'Панель управления',
  'admin.products': 'Товары',
  'admin.orders': 'Заказы',
  'admin.settings': 'Настройки',
  'admin.login_title': 'Вход в панель управления',
  'admin.email': 'Email',
  'admin.password': 'Пароль',
  'admin.login_btn': 'Войти',
  'admin.logout': 'Выйти',
  'admin.total_revenue': 'Общий доход',
  'admin.paid_orders': 'Оплаченные заказы',
  'admin.avg_order': 'Средний чек',
  'admin.active_products': 'Активные товары',
  'admin.add_product': 'Добавить товар',
  'admin.edit_product': 'Редактировать товар',
  'admin.product_title': 'Название',
  'admin.product_desc': 'Описание',
  'admin.product_price': 'Цена',
  'admin.product_stock': 'Остаток',
  'admin.product_category': 'Категория',
  'admin.product_images': 'Изображения (URL)',
  'admin.product_active': 'Активен',
  'admin.save': 'Сохранить',
  'admin.cancel': 'Отмена',
  'admin.delete': 'Удалить',
  'admin.order_id': 'Номер заказа',
  'admin.customer': 'Покупатель',
  'admin.amount': 'Сумма',
  'admin.status': 'Статус',
  'admin.date': 'Дата',
  'admin.actions': 'Действия',
  'admin.store_name': 'Название магазина',
  'admin.bot_token': 'Токен бота',
  'admin.currency': 'Валюта',
  'admin.language': 'Язык',
};
