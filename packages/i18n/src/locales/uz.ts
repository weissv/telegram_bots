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
  'orders.browse': '📦 Katalogga o\'tish',
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
  'help.commands': "• /start — Salomlash va asosiy menyu\n• /catalog — Mahsulotlar katalogi\n• /cart — Savatni ko'rish\n• /orders — Buyurtmalar holati\n• /webapp — Mini-ilovani ochish\n• /lang — Tilni o'zgartirish",

  // ─── Reservation Expiry ───
  'reservation.expired': "⏰ <b>#{orderId} buyurtma bekor qilindi</b>\n\nTo'lov vaqti tugadi (15 daqiqa). Mahsulotlar ombarga qaytarildi.\n\nYangi buyurtma berishingiz mumkin.",

  // ─── Merchant Alerts ───
  'merchant.new_order': "🔔 <b>YANGI BUYURTMA!</b>\n\n🧾 Buyurtma: <code>#{orderId}</code>\n💰 Summa: <b>{total}</b>\n👤 Xaridor: {customerName}\n📱 Telegram ID: <code>{telegramId}</code>\n📦 Mahsulotlar:\n{items}",

  // ─── Billing / Subscription ───
  'billing.expired_warning': "🔔 <b>Obuna yangilash eslatmasi</b>\n\n<b>{storeName}</b> uchun obuna muddati tugadi. Imtiyozli davr <b>{days} kun</b> qoldi.\n\nTo'xtab qolishning oldini olish uchun tarifingizni yangilang.",
  'billing.deactivated': "⚠️ <b>Do'kon to'xtatildi</b>\n\n<b>{storeName}</b> uchun obuna muddati tugadi va imtiyozli davr yakunlandi. Bot-do'koningiz to'xtatildi.\n\nShaxsiy kabinetingiz orqali obunani yangilang.",

  // ─── Currency ───
  'currency.usd': '$',
  'currency.uzs': "so'm",
  'currency.rub': '₽',

  // ─── Mini App ───
  'miniapp.loading': "Do'kon yuklanmoqda...",
  'miniapp.error_title': "Do'kon mavjud emas",
  'miniapp.featured': "Mashhur to'plam",
  'miniapp.all_products': 'Barcha mahsulotlar',
  'miniapp.items_count': '{count} mahsulot',
  'miniapp.no_products': 'Mahsulot topilmadi',
  'miniapp.no_products_hint': "Qidiruvni yoki filtrni o'zgartirib ko'ring.",
  'miniapp.search_placeholder': 'Mahsulot qidirish...',
  'miniapp.add_to_cart': "Savatga qo'shish",
  'miniapp.in_cart': 'Savatda',
  'miniapp.cart_title': 'Savatcha',
  'miniapp.cart_empty': "Savatingiz bo'sh",
  'miniapp.checkout_title': 'Buyurtmani rasmiylashtirish',
  'miniapp.checkout_name': 'Ismingiz',
  'miniapp.checkout_phone': 'Telefon raqam',
  'miniapp.checkout_address': 'Yetkazish manzili',
  'miniapp.checkout_confirm': 'Buyurtmani tasdiqlash',
  'miniapp.checkout_processing': 'Jarayonda...',
  'miniapp.total': 'Jami',
  'miniapp.proceed_checkout': 'Buyurtma berish',
  'miniapp.clear_cart': "Savatni tozalash",
  'miniapp.qty': 'Soni',

  // ─── Admin Backoffice ───
  'admin.dashboard': 'Boshqaruv paneli',
  'admin.products': 'Mahsulotlar',
  'admin.orders': 'Buyurtmalar',
  'admin.settings': 'Sozlamalar',
  'admin.login_title': 'Boshqaruv paneliga kirish',
  'admin.email': 'Email',
  'admin.password': 'Parol',
  'admin.login_btn': 'Kirish',
  'admin.logout': 'Chiqish',
  'admin.total_revenue': 'Umumiy daromad',
  'admin.paid_orders': "To'langan buyurtmalar",
  'admin.avg_order': "O'rtacha chek",
  'admin.active_products': 'Faol mahsulotlar',
  'admin.add_product': "Mahsulot qo'shish",
  'admin.edit_product': 'Mahsulotni tahrirlash',
  'admin.product_title': 'Nomi',
  'admin.product_desc': 'Tavsif',
  'admin.product_price': 'Narxi',
  'admin.product_stock': 'Qoldiq',
  'admin.product_category': 'Kategoriya',
  'admin.product_images': 'Rasmlar (URL)',
  'admin.product_active': 'Faol',
  'admin.save': 'Saqlash',
  'admin.cancel': 'Bekor qilish',
  'admin.delete': "O'chirish",
  'admin.order_id': 'Buyurtma raqami',
  'admin.customer': 'Xaridor',
  'admin.amount': 'Summa',
  'admin.status': 'Holat',
  'admin.date': 'Sana',
  'admin.actions': 'Amallar',
  'admin.store_name': "Do'kon nomi",
  'admin.bot_token': 'Bot tokeni',
  'admin.currency': 'Valyuta',
  'admin.language': 'Til',
};
