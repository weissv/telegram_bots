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

  // ─── Mini App General ───
  'miniapp.loading': 'Загрузка магазина…',
  'miniapp.error_title': 'Магазин недоступен',
  'miniapp.featured': 'Популярная коллекция',
  'miniapp.all_products': 'Все товары',
  'miniapp.items_count': '{count} шт.',
  'miniapp.no_products': 'Товары не найдены',
  'miniapp.no_products_hint': 'Попробуйте изменить категорию или поисковый запрос.',
  'miniapp.search_placeholder': 'Поиск товаров...',
  'miniapp.add_to_cart': 'В корзину',
  'miniapp.in_cart': 'В корзине',
  'miniapp.total': 'Итого',
  'miniapp.proceed_checkout': 'Оформить заказ',
  'miniapp.clear_cart': 'Очистить корзину',
  'miniapp.qty': 'Кол-во',

  // ─── Categories ───
  'category.all': 'Все товары',
  'category.apparel': 'Одежда',
  'category.footwear': 'Обувь',
  'category.accessories': 'Аксессуары',
  'category.electronics': 'Электроника',

  // ─── Product Card & Detail ───
  'product.out_of_stock': 'Нет в наличии',
  'product.low_stock': 'Осталось {count}',
  'product.sold_out': 'Товар распродан',
  'product.quantity': 'Количество:',
  'product.add_btn': 'Добавить в корзину · {price}',
  'product.added_toast': 'Товар добавлен в корзину',

  // ─── Cart Drawer ───
  'cart.drawer_title': 'Корзина',
  'cart.items_suffix': 'поз.',
  'cart.clear_btn': 'Очистить',
  'cart.empty_title': 'Корзина пуста',
  'cart.empty_subtitle': 'Выберите товары из каталога, чтобы сделать заказ.',
  'cart.item_total': 'Итого:',
  'cart.to_pay': 'К оплате:',
  'cart.proceed_btn': 'Перейти к оформлению',
  'cart.main_btn_cart': 'Корзина ({count}) · {amount}',
  'cart.main_btn_checkout': 'Оформить заказ · {amount}',

  // ─── Checkout ───
  'checkout.heading': 'Оформление заказа',
  'checkout.customer_data': 'Данные покупателя',
  'checkout.full_name': 'Имя и фамилия',
  'checkout.phone': 'Контактный телефон',
  'checkout.phone_placeholder': '+998 (90) 123-45-67',
  'checkout.address': 'Адрес или комментарий к доставке',
  'checkout.address_placeholder': 'Ташкент, улица, дом, квартира',
  'checkout.payment_method': 'Способ оплаты',
  'checkout.pay_mock_title': 'Быстрая демо-оплата (Тест)',
  'checkout.pay_mock_desc': 'Мгновенное подтверждение без списания средств',
  'checkout.pay_paynet_title': 'Paynet Xolis (0% комиссия)',
  'checkout.pay_paynet_desc': 'Оплата для самозанятых через QR-online / приложение Paynet',
  'checkout.pay_stars_title': 'Telegram Stars',
  'checkout.pay_stars_desc': 'Оплата звездами Telegram внутри приложения',
  'checkout.pay_stripe_title': 'Банковская карта (Stripe / Uzcard)',
  'checkout.pay_stripe_desc': 'Uzcard, Humo, Visa, Mastercard',
  'checkout.pay_button': 'Оплатить заказ · {amount}',
  'checkout.processing_btn': 'Обработка заказа…',
  'checkout.paynet_heading': 'Оплата Paynet Xolis (0%)',
  'checkout.paynet_badge': '0% КОМИССИЯ ДЛЯ САМОЗАНЯТЫХ',
  'checkout.paynet_step1': '1. Откройте приложение Paynet кнопкой ниже или отсканируйте QR',
  'checkout.paynet_step2': '2. Оплатите точную сумму заказа без комиссии',
  'checkout.paynet_step3': '3. После перевода нажмите кнопку «Я оплатил заказ»',
  'checkout.paynet_open_btn': '⚡ Оплатить в приложении Paynet',
  'checkout.paynet_confirm_btn': '✅ Я оплатил заказ',
  'checkout.paynet_scan_qr': 'Или отсканируйте QR-код в мобильном банке:',
  'checkout.paynet_waiting_notice': 'Заказ зарегистрирован. Ожидаем подтверждение оплаты.',

  // ─── Order Success ───
  'success.heading': 'Заказ оплачен!',
  'success.subtitle': 'Мы уже начали готовить ваш заказ к отправке.',
  'success.order_num': 'Номер: #{id}',
  'success.items_qty': 'Позиций в заказе:',
  'success.total_paid': 'Сумма оплаты:',
  'success.status_label': 'Статус:',
  'success.status_paid': 'Оплачено',
  'success.back_catalog': 'Вернуться в магазин',
  'success.close_app': 'Закрыть приложение',

  // ─── Header ───
  'header.default_title': 'Каталог товаров',
  'header.switch_language': 'Сменить язык',
};
