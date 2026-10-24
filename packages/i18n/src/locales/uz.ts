import type { TranslationDictionary } from '../index.js';

export const uz: TranslationDictionary = {
  // ─── Language Selector ───
  'lang.select': '🌐 Выберите язык / Tilni tanlang:',
  'lang.selected': "✅ Til tanlandi: O'zbekcha 🇺🇿",

  // ─── Start / Welcome ───
  'start.welcome': "🛍️ <b>{storeName} ga xush kelibsiz!</b>",
  'start.description_default': "Katalogni ko'rib chiqing va Telegram orqali buyurtma bering.",
  'start.tip_pro': "✨ <i>Maslahat: vizual xaridlar uchun «🛍️ Do'konni ochish» tugmasini bosing!</i>",
  'start.tip_basic': "📦 <i>Mahsulotlarni ko'rish, savat va buyurtmalar uchun quyidagi tugmalardan foydalaning.</i>",

  // ─── Main Menu Keyboard ───
  'kb.open_store': "🛍️ Do'konni ochish",
  'kb.catalog': '📦 Katalog',
  'kb.cart': '🛒 Savatcha',
  'kb.my_orders': '📋 Buyurtmalarim',
  'kb.store_info': "ℹ️ Do'kon haqida",
  'kb.change_lang': '🌐 Til',

  // ─── Catalog ───
  'catalog.title': '🏷️ <b>{title}</b>',
  'catalog.category': '📁 <i>Kategoriya: {category}</i>',
  'catalog.price': '💵 <b>Narxi:</b> <code>{price}</code>',
  'catalog.stock_in': '🟢 Mavjud',
  'catalog.stock_low': '🟡 Kam qoldi ({count} dona)',
  'catalog.stock_out': "🔴 Yo'q",
  'catalog.item_of': '<i>Mahsulot {current} / {total}</i>',
  'catalog.empty': "📦 Katalog yangilanmoqda. Keyinroq tekshiring!",
  'catalog.empty_category': '«<b>{category}</b>» kategoriyasida mahsulot topilmadi.',
  'catalog.add_to_cart': '🛒 Savatga (+1)',
  'catalog.prev': '⬅️ Oldingi',
  'catalog.next': "Keyingi ➡️",
  'catalog.page_of': '📄 {current}/{total}',
  'catalog.view_cart': '🛒 Savatcha',
  'catalog.all_categories': "🔍 Barcha kategoriyalar",

  // ─── Cart ───
  'cart.title': '🛒 <b>SAVATCHANGIZ</b>',
  'cart.empty': "🛒 <b>Savatingiz bo'sh!</b>\n\nMahsulot qo'shish uchun katalogni ko'ring.",
  'cart.total': '💰 <b>Jami:</b> <b>{total}</b>',
  'cart.item_line': '{idx}. <b>{title}</b>\n   {qty} × {price} = <code>{subtotal}</code>',
  'cart.checkout': '💳 Buyurtma berish',
  'cart.clear': "🗑️ Tozalash",
  'cart.continue': "📦 Xaridni davom ettirish",
  'cart.added': "«{title}» savatga qo'shildi! 🛒",
  'cart.not_found': "Mahsulot topilmadi yoki mavjud emas.",
  'cart.out_of_stock': "Kechirasiz, mahsulot tugagan!",
  'cart.max_stock': "Ko'proq qo'shib bo'lmaydi. Faqat {stock} dona mavjud.",
  'cart.empty_alert': "Savatingiz bo'sh!",

  // ─── Checkout ───
  'checkout.created': "🎉 <b>Buyurtma yaratildi!</b>",
  'checkout.order_id': '🧾 <b>Buyurtma:</b> <code>#{orderId}</code>',
  'checkout.total': '💰 <b>Jami:</b> <b>{total}</b>',
  'checkout.pay_prompt': "Xavfsiz to'lov uchun quyidagi tugmani bosing.",
  'checkout.pay_now': "💳 To'lash",
  'checkout.failed': "Buyurtma xatosi: {error}",

  // ─── Orders ───
  'orders.title': '📋 <b>OXIRGI BUYURTMALARINGIZ</b>',
  'orders.empty': "📋 <b>Sizda hali buyurtma yo'q.</b>\n\nXaridni 📦 Katalogda boshlang!",
  'orders.browse': "📦 Katalogga o'tish",
  'orders.status_pending': "⏳ To'lov kutilmoqda",
  'orders.status_paid': "✅ To'langan / Jarayonda",
  'orders.status_delivered': '🚚 Yetkazildi',
  'orders.status_cancelled': '❌ Bekor qilindi',
  'orders.order_line': "🧾 <b>Buyurtma #{orderId}</b>\n📅 <i>{date}</i>\n📊 <b>Holat:</b> {status}\n💰 <b>Summa:</b> <code>{total}</code>\n📦 <i>Mahsulotlar: {items}</i>",

  // ─── WebApp ───
  'webapp.launch': "🚀 Quyida interaktiv do'konni oching:",
  'webapp.upgrade_title': "✨ <b>Pro tarifga o'ting!</b>",
  'webapp.upgrade_body': "Vizual katalog bilan mini-ilova Pro tarifda mavjud ($30/oy).\n\n/catalog buyrug'i orqali bot ichida xarid qilishni davom ettirishingiz mumkin.",
  'webapp.upgrade_btn': "🚀 Pro ga o'tish ($30/oy)",

  // ─── Store Info ───
  'store_info.title': "ℹ️ <b>Do'kon haqida</b>",
  'store_info.default': "Premium Telegram do'kon",

  // ─── Help ───
  'help.title': "🤖 <b>Do'konda navigatsiya</b>",
  'help.commands': "• /start — Bosh menyu\n• /catalog — Mahsulotlar katalogi\n• /cart — Savatchani ko'rish\n• /orders — Buyurtmalar holati\n• /webapp — Mini-ilovani ochish\n• /lang — Tilni o'zgartirish",

  // ─── Reservation Expiry ───
  'reservation.expired': "⏰ <b>Buyurtma #{orderId} bekor qilindi</b>\n\nTo'lov vaqti tugadi (15 daqiqa). Mahsulotlar omborga qaytarildi.",

  // ─── Merchant Alerts ───
  'merchant.new_order': "🔔 <b>YANGI BUYURTMA!</b>\n\n🧾 Buyurtma: <code>#{orderId}</code>\n💰 Summa: <b>{total}</b>\n👤 Xaridor: {customerName}\n📱 Telegram ID: <code>{telegramId}</code>\n📦 Mahsulotlar:\n{items}",

  // ─── Billing / Subscription ───
  'billing.expired_warning': "🔔 <b>Obunani yangilash eslatmasi</b>\n\n<b>{storeName}</b> obunasi tugadi.",
  'billing.deactivated': "⚠️ <b>Do'kon to'xtatildi</b>\n\n<b>{storeName}</b> obuna muddati tugadi.",

  // ─── Currency ───
  'currency.usd': '$',
  'currency.uzs': "so'm",
  'currency.rub': '₽',

  // ─── Mini App General ───
  'miniapp.loading': "Do'kon yuklanmoqda…",
  'miniapp.error_title': "Do'kon mavjud emas",
  'miniapp.featured': "Mashhur to'plam",
  'miniapp.all_products': 'Barcha mahsulotlar',
  'miniapp.items_count': '{count} ta',
  'miniapp.no_products': 'Mahsulotlar topilmadi',
  'miniapp.no_products_hint': "Qidiruv yoki kategoriya filtrini o'zgartirib ko'ring.",
  'miniapp.search_placeholder': 'Mahsulotlarni qidirish...',
  'miniapp.add_to_cart': 'Savatchaga',
  'miniapp.in_cart': 'Savatchada',
  'miniapp.total': 'Jami',
  'miniapp.proceed_checkout': 'Buyurtma berish',
  'miniapp.clear_cart': 'Savatchani tozalash',
  'miniapp.qty': 'Soni',

  // ─── Categories ───
  'category.all': 'Barcha mahsulotlar',
  'category.apparel': 'Kiyimlar',
  'category.footwear': 'Poyabzal',
  'category.accessories': 'Aksessuarlar',
  'category.electronics': 'Elektronika',

  // ─── Product Card & Detail ───
  'product.out_of_stock': 'Mavjud emas',
  'product.low_stock': 'Faqat {count} ta qoldi',
  'product.sold_out': 'Sotib bo’lingan',
  'product.quantity': 'Miqdori:',
  'product.add_btn': "Savatchaga qo'shish · {price}",
  'product.added_toast': "Mahsulot savatchaga qo'shildi",

  // ─── Cart Drawer ───
  'cart.drawer_title': 'Savatcha',
  'cart.items_suffix': 'ta',
  'cart.clear_btn': 'Tozalash',
  'cart.empty_title': "Savatchangiz bo'sh",
  'cart.empty_subtitle': "Buyurtma berish uchun katalogdan mahsulotlarni tanlang.",
  'cart.item_total': 'Jami:',
  'cart.to_pay': "To'lov uchun:",
  'cart.proceed_btn': "Rasmiylashtirishga o'tish",
  'cart.main_btn_cart': 'Savatcha ({count}) · {amount}',
  'cart.main_btn_checkout': 'Buyurtma berish · {amount}',

  // ─── Checkout ───
  'checkout.heading': 'Buyurtmani rasmiylashtirish',
  'checkout.customer_data': "Xaridor ma'lumotlari",
  'checkout.full_name': 'Ism va familiya',
  'checkout.phone': 'Telefon raqami',
  'checkout.phone_placeholder': '+998 (90) 123-45-67',
  'checkout.address': 'Yetkazib berish manzili / Izoh',
  'checkout.address_placeholder': 'Toshkent, ko’cha, uy, xonadon',
  'checkout.payment_method': "To'lov usuli",
  'checkout.pay_mock_title': "Tezkor sinov to'lovi (Test)",
  'checkout.pay_mock_desc': "Mablag' yechmasdan tezkor tasdiqlash",
  'checkout.pay_stars_title': 'Telegram Stars',
  'checkout.pay_stars_desc': "Ilova ichida Telegram yulduzlari orqali to'lash",
  'checkout.pay_stripe_title': 'Bank kartasi (Stripe / Uzcard)',
  'checkout.pay_stripe_desc': 'Uzcard, Humo, Visa, Mastercard',
  'checkout.pay_button': "Buyurtmani to'lash · {amount}",
  'checkout.processing_btn': 'Buyurtma qayta ishlanmoqda…',

  // ─── Order Success ───
  'success.heading': "Buyurtma to'landi!",
  'success.subtitle': "Biz buyurtmangizni jo'natishga tayyorlashni boshladik.",
  'success.order_num': 'Raqam: #{id}',
  'success.items_qty': 'Buyurtmadagi mahsulotlar:',
  'success.total_paid': "To'langan summa:",
  'success.status_label': 'Holati:',
  'success.status_paid': "To'landi",
  'success.back_catalog': "Do'konga qaytish",
  'success.close_app': 'Ilovani yopish',

  // ─── Header ───
  'header.default_title': 'Mahsulotlar katalogi',
  'header.switch_language': "Tilni o'zgartirish",
};
