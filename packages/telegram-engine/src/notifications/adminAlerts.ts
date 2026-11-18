import { Bot, InlineKeyboard } from 'grammy';
import { formatCurrency } from '@telegram-commerce/i18n';

export interface OrderNotificationPayload {
  orderId: string;
  totalAmount: number;
  deliveryFee?: number;
  deliveryMethod?: string;
  currency: string;
  customerTelegramId: string;
  customerName?: string;
  shippingAddress?: string;
  customerPhone?: string;
  status?: string;
  items: Array<{
    title: string;
    quantity: number;
    price: number;
    variant?: string;
  }>;
}

export type MerchantOrderAction = 'confirm_pay' | 'deliver' | 'cancel';

export function compactOrderId(orderId: string): string {
  return orderId.replace(/-/g, '');
}

export function restoreOrderUuid(rawId: string): string {
  if (/^[0-9a-f]{32}$/i.test(rawId)) {
    return `${rawId.slice(0, 8)}-${rawId.slice(8, 12)}-${rawId.slice(12, 16)}-${rawId.slice(16, 20)}-${rawId.slice(20)}`;
  }
  return rawId;
}

export function buildMerchantOrderCallback(action: MerchantOrderAction, orderId: string): string {
  return `merchant:order:${action}:${compactOrderId(orderId)}`;
}

export function buildMerchantOrderKeyboard(orderId: string, includeConfirmPay = true): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (includeConfirmPay) {
    keyboard.text('✅ Оплата поступила (В сборку)', buildMerchantOrderCallback('confirm_pay', orderId)).row();
  }
  keyboard
    .text('🚚 Заказ доставлен', buildMerchantOrderCallback('deliver', orderId))
    .row()
    .text('❌ Отменить заказ', buildMerchantOrderCallback('cancel', orderId));
  return keyboard;
}

/**
 * Broadcasts an instant rich HTML order alert directly to merchant's personal Telegram ID.
 */
export async function sendMerchantOrderAlert(
  bot: Bot<any>,
  merchantTelegramId: string,
  order: OrderNotificationPayload
) {
  if (!merchantTelegramId) return;

  const currency = order.currency || 'UZS';
  const itemsList = order.items
    .map((item) => {
      const variantLabel = item.variant ? ` (${escapeHtml(item.variant)})` : '';
      return `  • <b>${escapeHtml(item.title)}</b>${variantLabel} × ${item.quantity} — <code>${formatCurrency(Number(item.price), currency, 'ru')}</code>`;
    })
    .join('\n');

  const isAlreadyPaid = order.status === 'PAID';
  const heading = isAlreadyPaid
    ? '🎉 <b>ПОЛУЧЕН НОВЫЙ ОПЛАЧЕННЫЙ ЗАКАЗ!</b>'
    : '🔍 <b>НОВАЯ ЗАЯВКА НА ПРОВЕРКУ ОПЛАТЫ!</b>';

  const deliveryLabel =
    order.deliveryMethod === 'PICKUP'
      ? '🏪 Самовывоз'
      : '🚚 Курьер';
  const deliveryFeeLine =
    order.deliveryFee !== undefined
      ? `\n🚚 <b>Доставка (${deliveryLabel}):</b> ${order.deliveryFee > 0 ? formatCurrency(Number(order.deliveryFee), currency, 'ru') : 'Бесплатно'}`
      : order.deliveryMethod
        ? `\n🚚 <b>Способ получения:</b> ${deliveryLabel}`
        : '';

  const text = `
${heading}

🧾 <b>Номер заказа:</b> <code>#${order.orderId.slice(0, 8)}</code>
💰 <b>Итого к оплате:</b> <b>${formatCurrency(Number(order.totalAmount), currency, 'ru')}</b>${deliveryFeeLine}
👤 <b>Покупатель:</b> ${escapeHtml(order.customerName || 'Пользователь Telegram')} (<code>${order.customerTelegramId}</code>)
${order.customerPhone ? `📞 <b>Телефон:</b> ${escapeHtml(order.customerPhone)}\n` : ''}${order.shippingAddress ? `📍 <b>Адрес доставки:</b> ${escapeHtml(order.shippingAddress)}\n` : ''}
📦 <b>Состав заказа:</b>
${itemsList}

${isAlreadyPaid ? '⚡ <i>Управляйте сборкой и доставкой заказа кнопками ниже.</i>' : '💳 <i>Проверьте поступление средств в Paynet и нажмите «Оплата поступила», чтобы передать заказ в сборку.</i>'}
`.trim();

  const keyboard = buildMerchantOrderKeyboard(order.orderId, !isAlreadyPaid);

  try {
    await bot.api.sendMessage(merchantTelegramId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error(`Failed to send merchant order alert to ${merchantTelegramId}:`, err);
  }
}

export interface CustomerReceiptPayload {
  orderId: string;
  totalAmount: number;
  deliveryFee?: number;
  deliveryMethod?: string;
  currency: string;
  items: Array<{
    title: string;
    quantity: number;
    price: number;
    variant?: string;
  }>;
}

/**
 * Sends order payment confirmation & receipt to customer via their bot chat.
 */
export async function sendCustomerOrderReceipt(
  bot: Bot<any>,
  customerTelegramId: string,
  receipt: CustomerReceiptPayload
) {
  if (!customerTelegramId) return;

  const currency = receipt.currency || 'UZS';
  const itemsList = receipt.items
    .map((item) => {
      const variantLabel = item.variant ? ` (${escapeHtml(item.variant)})` : '';
      return `  • <b>${escapeHtml(item.title)}</b>${variantLabel} × ${item.quantity} — <code>${formatCurrency(Number(item.price), currency, 'ru')}</code>`;
    })
    .join('\n');

  const deliveryLine =
    receipt.deliveryFee !== undefined
      ? `\n🚚 <b>Доставка (${receipt.deliveryMethod === 'PICKUP' ? 'Самовывоз' : 'Курьер'}):</b> ${receipt.deliveryFee > 0 ? formatCurrency(Number(receipt.deliveryFee), currency, 'ru') : 'Бесплатно'}`
      : '';

  const text = `
💳 <b>Оплата подтверждена! Заказ в сборке.</b>

🧾 <b>Чек по заказу:</b> <code>#${receipt.orderId.slice(0, 8)}</code>
💰 <b>Итого оплачено:</b> <b>${formatCurrency(Number(receipt.totalAmount), currency, 'ru')}</b>${deliveryLine}

📦 <b>Содержимое заказа:</b>
${itemsList}

Мерчант уже получил подтверждение и собирает ваш заказ.
Вы можете проверить статус в меню /orders.
`.trim();

  try {
    await bot.api.sendMessage(customerTelegramId, text, { parse_mode: 'HTML' });
  } catch (err) {
    console.warn(`Customer order receipt send notice for ${customerTelegramId}:`, err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
