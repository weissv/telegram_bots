import type { TranslationDictionary } from '../index.js';

export const en: TranslationDictionary = {
  // ─── Language Selector ───
  'lang.select': '🌐 Select language / Выберите язык:',
  'lang.selected': '✅ Language set to English 🇬🇧',

  // ─── Start / Welcome ───
  'start.welcome': '🛍️ <b>Welcome to {storeName}!</b>',
  'start.description_default': 'Browse the catalog and place orders directly inside Telegram.',
  'start.tip_pro': '✨ <i>Tip: Tap the «🛍️ Open Store» button below for a full-screen shopping experience!</i>',
  'start.tip_basic': '📦 <i>Use the keyboard below to browse products, check your cart, and view orders.</i>',

  // ─── Main Menu Keyboard ───
  'kb.open_store': '🛍️ Open Store',
  'kb.catalog': '📦 Catalog',
  'kb.cart': '🛒 Cart',
  'kb.my_orders': '📋 My Orders',
  'kb.store_info': 'ℹ️ About Store',
  'kb.change_lang': '🌐 Language',

  // ─── Catalog ───
  'catalog.title': '🏷️ <b>{title}</b>',
  'catalog.category': '📁 <i>Category: {category}</i>',
  'catalog.price': '💵 <b>Price:</b> <code>{price}</code>',
  'catalog.stock_in': '🟢 In stock',
  'catalog.stock_low': '🟡 Low stock ({count} left)',
  'catalog.stock_out': '🔴 Out of stock',
  'catalog.item_of': '<i>Product {current} of {total}</i>',
  'catalog.empty': '📦 The catalog is currently being updated. Check back soon!',
  'catalog.empty_category': 'No products found in category «<b>{category}</b>».',
  'catalog.add_to_cart': '🛒 Add to Cart (+1)',
  'catalog.prev': '⬅️ Back',
  'catalog.next': 'Next ➡️',
  'catalog.page_of': '📄 {current}/{total}',
  'catalog.view_cart': '🛒 Cart',
  'catalog.all_categories': '🔍 All Categories',

  // ─── Cart ───
  'cart.title': '🛒 <b>YOUR CART</b>',
  'cart.empty': '🛒 <b>Your cart is empty!</b>\n\nBrowse the catalog to add items.',
  'cart.total': '💰 <b>Total:</b> <b>{total}</b>',
  'cart.item_line': '{idx}. <b>{title}</b>\n   {qty} × {price} = <code>{subtotal}</code>',
  'cart.checkout': '💳 Checkout',
  'cart.clear': '🗑️ Clear',
  'cart.continue': '📦 Continue Shopping',
  'cart.added': '«{title}» added to cart! 🛒',
  'cart.not_found': 'Product not found or unavailable.',
  'cart.out_of_stock': 'Sorry, this product is out of stock!',
  'cart.max_stock': 'Cannot add more. Only {stock} available in stock.',
  'cart.empty_alert': 'Your cart is empty!',

  // ─── Checkout ───
  'checkout.created': '🎉 <b>Order Created!</b>',
  'checkout.order_id': '🧾 <b>Order:</b> <code>#{orderId}</code>',
  'checkout.total': '💰 <b>Total:</b> <b>{total}</b>',
  'checkout.pay_prompt': 'Tap the button below for secure checkout.',
  'checkout.pay_now': '💳 Pay Now',
  'checkout.failed': 'Checkout error: {error}',

  // ─── Orders ───
  'orders.title': '📋 <b>YOUR RECENT ORDERS</b>',
  'orders.empty': '📋 <b>You have no orders yet.</b>\n\nStart shopping in our 📦 Catalog!',
  'orders.browse': '📦 Open Catalog',
  'orders.status_pending': '⏳ Pending payment',
  'orders.status_paid': '✅ Paid / Processing',
  'orders.status_delivered': '🚚 Delivered',
  'orders.status_cancelled': '❌ Cancelled',
  'orders.order_line': '🧾 <b>Order #{orderId}</b>\n📅 <i>{date}</i>\n📊 <b>Status:</b> {status}\n💰 <b>Total:</b> <code>{total}</code>\n📦 <i>Items: {items}</i>',

  // ─── WebApp ───
  'webapp.launch': '🚀 Launch the interactive storefront below:',
  'webapp.upgrade_title': '✨ <b>Upgrade to Pro Plan!</b>',
  'webapp.upgrade_body': 'The full visual Mini App is available on the Pro plan ($30/mo).\n\nYou can continue shopping directly via bot commands.',
  'webapp.upgrade_btn': '🚀 Upgrade to Pro ($30/mo)',

  // ─── Store Info ───
  'store_info.title': 'ℹ️ <b>Store Information</b>',
  'store_info.default': 'Premium Telegram Storefront',

  // ─── Help ───
  'help.title': '🤖 <b>Store Navigation</b>',
  'help.commands': '• /start — Welcome & main menu\n• /catalog — Product catalog\n• /cart — View cart & checkout\n• /orders — Order history & tracking\n• /webapp — Launch Telegram Mini App\n• /lang — Change language',

  // ─── Reservation Expiry ───
  'reservation.expired': '⏰ <b>Order #{orderId} Cancelled</b>\n\nPayment window expired (15 min). Items have been restored to inventory.\n\nYou can create a new order anytime.',

  // ─── Merchant Alerts ───
  'merchant.new_order': '🔔 <b>NEW ORDER!</b>\n\n🧾 Order: <code>#{orderId}</code>\n💰 Total: <b>{total}</b>\n👤 Customer: {customerName}\n📱 Telegram ID: <code>{telegramId}</code>\n📦 Items:\n{items}',

  // ─── Billing / Subscription ───
  'billing.expired_warning': '🔔 <b>Subscription Renewal Reminder</b>\n\nYour plan for <b>{storeName}</b> recently expired. <b>{days} days</b> remaining in grace period.\n\nRenew to avoid service suspension.',
  'billing.deactivated': '⚠️ <b>Store Suspended</b>\n\nYour subscription for <b>{storeName}</b> has ended. Your storefront bot is temporarily paused.\n\nRenew in your backoffice.',

  // ─── Currency ───
  'currency.usd': '$',
  'currency.uzs': "so'm",
  'currency.rub': '₽',

  // ─── Mini App ───
  'miniapp.loading': 'Loading store...',
  'miniapp.error_title': 'Store Unavailable',
  'miniapp.featured': 'Featured Collection',
  'miniapp.all_products': 'All Products',
  'miniapp.items_count': '{count} items',
  'miniapp.no_products': 'No products found',
  'miniapp.no_products_hint': 'Try adjusting your search or category filter.',
  'miniapp.search_placeholder': 'Search products...',
  'miniapp.add_to_cart': 'Add to Cart',
  'miniapp.in_cart': 'In Cart',
  'miniapp.cart_title': 'Shopping Cart',
  'miniapp.cart_empty': 'Your cart is empty',
  'miniapp.checkout_title': 'Checkout Order',
  'miniapp.checkout_name': 'Full Name',
  'miniapp.checkout_phone': 'Phone Number',
  'miniapp.checkout_address': 'Delivery Address',
  'miniapp.checkout_confirm': 'Confirm Order',
  'miniapp.checkout_processing': 'Processing...',
  'miniapp.total': 'Total',
  'miniapp.proceed_checkout': 'Proceed to Checkout',
  'miniapp.clear_cart': 'Clear Cart',
  'miniapp.qty': 'Qty',

  // ─── Admin Backoffice ───
  'admin.dashboard': 'Dashboard',
  'admin.products': 'Products',
  'admin.orders': 'Orders',
  'admin.settings': 'Settings',
  'admin.login_title': 'Sign In to Backoffice',
  'admin.email': 'Email',
  'admin.password': 'Password',
  'admin.login_btn': 'Sign In',
  'admin.logout': 'Sign Out',
  'admin.total_revenue': 'Total Revenue',
  'admin.paid_orders': 'Paid Orders',
  'admin.avg_order': 'Average Order',
  'admin.active_products': 'Active Products',
  'admin.add_product': 'Add Product',
  'admin.edit_product': 'Edit Product',
  'admin.product_title': 'Title',
  'admin.product_desc': 'Description',
  'admin.product_price': 'Price',
  'admin.product_stock': 'Stock',
  'admin.product_category': 'Category',
  'admin.product_images': 'Images (URL)',
  'admin.product_active': 'Active',
  'admin.save': 'Save',
  'admin.cancel': 'Cancel',
  'admin.delete': 'Delete',
  'admin.order_id': 'Order ID',
  'admin.customer': 'Customer',
  'admin.amount': 'Amount',
  'admin.status': 'Status',
  'admin.date': 'Date',
  'admin.actions': 'Actions',
  'admin.store_name': 'Store Name',
  'admin.bot_token': 'Bot Token',
  'admin.currency': 'Currency',
  'admin.language': 'Language',
};
