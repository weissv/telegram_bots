import type { TranslationDictionary } from '../index.js';

export const en: TranslationDictionary = {
  // ─── Language Selector ───
  'lang.select': '🌐 Select language / Tilni tanlang:',
  'lang.selected': '✅ Language set: English 🇬🇧',

  // ─── Start / Welcome ───
  'start.welcome': '🛍️ <b>Welcome to {storeName}!</b>',
  'start.description_default': 'Browse the catalog and place orders directly in Telegram.',
  'start.tip_pro': '✨ <i>Tip: tap "🛍️ Open Store" below for visual shopping experience!</i>',
  'start.tip_basic': '📦 <i>Use the keyboard below to browse products, cart, and orders.</i>',

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
  'catalog.item_of': '<i>Item {current} of {total}</i>',
  'catalog.empty': '📦 Catalog is updating. Please check back later!',
  'catalog.empty_category': 'No products found in category «<b>{category}</b>».',
  'catalog.add_to_cart': '🛒 Add to Cart (+1)',
  'catalog.prev': '⬅️ Back',
  'catalog.next': 'Next ➡️',
  'catalog.page_of': '📄 {current}/{total}',
  'catalog.view_cart': '🛒 Cart',
  'catalog.all_categories': '🔍 All categories',

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
  'cart.max_stock': 'Cannot add more. Only {stock} available.',
  'cart.empty_alert': 'Your cart is empty!',

  // ─── Checkout ───
  'checkout.created': '🎉 <b>Order Created!</b>',
  'checkout.order_id': '🧾 <b>Order:</b> <code>#{orderId}</code>',
  'checkout.total': '💰 <b>Total:</b> <b>{total}</b>',
  'checkout.pay_prompt': 'Click the button below for secure payment.',
  'checkout.pay_now': '💳 Pay Now',
  'checkout.paynet_btn': '⚡ Pay with Paynet (0% fee)',
  'checkout.paynet_instructions': '1️⃣ Tap <b>"Pay with Paynet"</b> below\n2️⃣ Complete payment for the exact amount (0% fee)\n3️⃣ Return to the bot and tap <b>"I Paid the Order"</b>',
  'checkout.failed': 'Checkout error: {error}',

  // ─── Orders ───
  'orders.title': '📋 <b>YOUR RECENT ORDERS</b>',
  'orders.empty': '📋 <b>You have no orders yet.</b>\n\nStart shopping in 📦 Catalog!',
  'orders.browse': '📦 Browse catalog',
  'orders.status_pending': '⏳ Pending payment',
  'orders.status_payment_review': '🔍 Payment under review',
  'orders.status_paid': '✅ Paid / Processing',
  'orders.status_delivered': '🚚 Delivered',
  'orders.status_cancelled': '❌ Cancelled',
  'orders.status_refunded': '↩️ Refunded',
  'orders.order_line': '🧾 <b>Order #{orderId}</b>\n📅 <i>{date}</i>\n📊 <b>Status:</b> {status}\n💰 <b>Total:</b> <code>{total}</code>\n📦 <i>Items: {items}</i>',
  'orders.notify_payment_review': '🔍 <b>Payment claim received for Order #{orderId}!</b>\n\nWe sent your payment details to the store operator for verification. You will be notified once confirmed.',
  'orders.notify_paid': '✅ <b>Payment confirmed for Order #{orderId}!</b>\n\nWe are now preparing your order for shipping.',
  'orders.notify_paid_with_receipt': '✅ <b>Payment confirmed for Order #{orderId}!</b>\n\nWe are now preparing your order for shipping.\n🧾 Fiscal receipt: {receiptUrl}',
  'orders.notify_delivered': '🚚 <b>Order #{orderId} has been delivered!</b>\n\nThank you for shopping with us!',
  'orders.notify_cancelled': '❌ <b>Order #{orderId} has been cancelled.</b>\n\nPlease contact the store if you have any questions.',
  'orders.notify_refunded': '↩️ <b>Order #{orderId} has been refunded.</b>\n\nPlease contact store support if you have any questions.',

  // ─── WebApp ───
  'webapp.launch': '🚀 Launch interactive store below:',
  'webapp.upgrade_title': '✨ <b>Upgrade to Pro Plan!</b>',
  'webapp.upgrade_body': 'Mini App with full visual catalog is available on Pro plan ($30/mo).\n\nYou can keep shopping using the chat bot via /catalog.',
  'webapp.upgrade_btn': '🚀 Upgrade to Pro ($30/mo)',

  // ─── Store Info ───
  'store_info.title': 'ℹ️ <b>Store Information</b>',
  'store_info.default': 'Premium Telegram Store',

  // ─── Help ───
  'help.title': '🤖 <b>Store Navigation</b>',
  'help.commands': '• /start — Welcome and main menu\n• /catalog — Product catalog\n• /cart — View cart\n• /orders — Order history\n• /webapp — Open mini app\n• /lang — Change language',

  // ─── Reservation Expiry ───
  'reservation.expired': '⏰ <b>Order #{orderId} cancelled</b>\n\nPayment window expired (15 min). Products returned to stock.',

  // ─── Merchant Alerts ───
  'merchant.new_order': '🔔 <b>NEW ORDER!</b>\n\n🧾 Order: <code>#{orderId}</code>\n💰 Total: <b>{total}</b>\n👤 Customer: {customerName}\n📱 Telegram ID: <code>{telegramId}</code>\n📦 Items:\n{items}',

  // ─── Billing / Subscription ───
  'billing.status_pending_payment': 'Pending payment',
  'billing.status_pending_review': 'Under review',
  'billing.status_active': 'Active',
  'billing.status_past_due': 'Past due',
  'billing.status_canceled': 'Canceled',
  'billing.status_trialing': 'Trial',
  'billing.expired_warning': '🔔 <b>Subscription Renewal Notice</b>\n\nSubscription for <b>{storeName}</b> recently expired.',
  'billing.deactivated': '⚠️ <b>Store Suspended</b>\n\nSubscription for <b>{storeName}</b> has expired.',

  // ─── Currency ───
  'currency.usd': '$',
  'currency.uzs': "so'm",
  'currency.rub': '₽',

  // ─── Mini App General ───
  'miniapp.loading': 'Loading store…',
  'miniapp.error_title': 'Store unavailable',
  'miniapp.featured': 'Featured Collection',
  'miniapp.all_products': 'All Products',
  'miniapp.items_count': '{count} items',
  'miniapp.no_products': 'No products found',
  'miniapp.no_products_hint': 'Try changing your search or category filter.',
  'miniapp.search_placeholder': 'Search products...',
  'miniapp.add_to_cart': 'Add to Cart',
  'miniapp.in_cart': 'In Cart',
  'miniapp.total': 'Total',
  'miniapp.proceed_checkout': 'Proceed to Checkout',
  'miniapp.clear_cart': 'Clear Cart',
  'miniapp.qty': 'Qty',

  // ─── Categories ───
  'category.all': 'All Products',
  'category.general': 'General',
  'category.apparel': 'Apparel',
  'category.footwear': 'Footwear',
  'category.accessories': 'Accessories',
  'category.electronics': 'Electronics',
  'category.общее': 'General',
  'category.одежда': 'Apparel',
  'category.обувь': 'Footwear',
  'category.аксессуары': 'Accessories',
  'category.электроника': 'Electronics',

  // ─── Product Card & Detail ───
  'product.out_of_stock': 'Out of Stock',
  'product.low_stock': 'Only {count} left',
  'product.sold_out': 'Sold Out',
  'product.quantity': 'Quantity:',
  'product.add_btn': 'Add to Cart · {price}',
  'product.added_toast': 'Item added to cart',

  // ─── Cart Drawer ───
  'cart.drawer_title': 'Shopping Cart',
  'cart.items_suffix': 'items',
  'cart.clear_btn': 'Clear',
  'cart.empty_title': 'Cart is empty',
  'cart.empty_subtitle': 'Choose items from catalog to place an order.',
  'cart.item_total': 'Subtotal:',
  'cart.to_pay': 'Total to pay:',
  'cart.proceed_btn': 'Proceed to Checkout',
  'cart.main_btn_cart': 'Cart ({count}) · {amount}',
  'cart.main_btn_checkout': 'Checkout · {amount}',

  // ─── Checkout ───
  'checkout.heading': 'Checkout',
  'checkout.customer_data': 'Customer Information',
  'checkout.full_name': 'Full Name',
  'checkout.phone': 'Phone Number',
  'checkout.phone_placeholder': '+998 (90) 123-45-67',
  'checkout.address': 'Shipping Address / Notes',
  'checkout.address_placeholder': 'Tashkent, Street, Apt...',
  'checkout.payment_method': 'Payment Method',
  'checkout.pay_mock_title': 'Fast Demo Payment (Test)',
  'checkout.pay_mock_desc': 'Instant confirmation without charging funds',
  'checkout.pay_paynet_title': 'Paynet Xolis (0% commission)',
  'checkout.pay_paynet_desc': 'For self-employed via QR-online / Paynet app',
  'checkout.pay_stars_title': 'Telegram Stars',
  'checkout.pay_stars_desc': 'Pay with Telegram Stars in-app',
  'checkout.pay_stripe_title': 'Bank Card (Stripe / Uzcard)',
  'checkout.pay_stripe_desc': 'Uzcard, Humo, Visa, Mastercard',
  'checkout.pay_button': 'Pay Order · {amount}',
  'checkout.processing_btn': 'Processing Order…',
  'checkout.paynet_heading': 'Paynet Xolis Payment (0%)',
  'checkout.paynet_badge': '0% COMMISSION FOR SELF-EMPLOYED',
  'checkout.paynet_step1': '1. Open Paynet app using the button below or scan QR',
  'checkout.paynet_step2': '2. Pay the exact order sum with 0% fee',
  'checkout.paynet_step3': '3. Return here and tap "I Paid the Order"',
  'checkout.paynet_open_btn': '⚡ Pay in Paynet App',
  'checkout.paynet_confirm_btn': '✅ I Paid the Order',
  'checkout.paynet_scan_qr': 'Or scan the QR code with mobile banking:',
  'checkout.paynet_waiting_notice': 'Order registered. Awaiting merchant payment verification.',
  'checkout.delivery_method': 'Delivery Method',
  'checkout.delivery_courier': 'Courier Delivery',
  'checkout.delivery_pickup': 'Store Pickup',
  'checkout.items_subtotal': 'Items',
  'checkout.delivery_fee': 'Delivery',
  'checkout.delivery_free': 'Free',
  'checkout.free_delivery_hint': 'Free delivery from {threshold}',
  'checkout.phone_required': 'Please enter your contact phone number',
  'checkout.address_required': 'Please enter your delivery address',
  'checkout.payment_review_notice': 'Payment claim for order #{orderId} has been sent to the store operator for review.',
  'checkout.paynet_unavailable': 'Online payment is currently disabled by the seller. Please contact store support.',
  'checkout.store_not_published': 'This store has not been published by the seller yet.',
  'checkout.demo_disabled': 'Demo storefront: live orders and real payments are disabled.',

  // ─── Order Success ───
  'success.heading': 'Order Paid!',
  'success.heading_review': 'Payment Under Review!',
  'success.subtitle': 'We have started preparing your order for shipping.',
  'success.subtitle_review': 'Your payment confirmation has been sent to the store operator for verification.',
  'success.order_num': 'Order: #{id}',
  'success.items_qty': 'Items count:',
  'success.total_paid': 'Total paid:',
  'success.status_label': 'Status:',
  'success.status_paid': 'Paid',
  'success.status_review': 'Under operator review',
  'success.back_catalog': 'Return to Store',
  'success.close_app': 'Close App',

  // ─── Errors ───
  'errors.unauthorized': 'Unauthorized. Order access token or Telegram authentication required.',
  'errors.order_not_found': 'Order not found.',
  'errors.invalid_status': 'Invalid order status.',
  'errors.payment_id_required': 'Please provide the payment transaction/receipt ID (paymentId) to confirm payment.',
  'errors.duplicate_payment_id': 'This paymentId is already linked to another order.',

  // ─── Header ───
  'header.default_title': 'Product Catalog',
  'header.switch_language': 'Switch Language',
};
