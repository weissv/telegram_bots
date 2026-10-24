import { Bot } from 'grammy';
import { BotContext } from '../types.js';

export interface OrderNotificationPayload {
  orderId: string;
  totalAmount: number;
  currency: string;
  customerTelegramId: string;
  customerName?: string;
  shippingAddress?: string;
  customerPhone?: string;
  items: Array<{
    title: string;
    quantity: number;
    price: number;
  }>;
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

  const itemsList = order.items
    .map(
      (item) =>
        `  • <b>${escapeHtml(item.title)}</b> × ${item.quantity} — <code>${item.price.toFixed(2)} ${order.currency}</code>`
    )
    .join('\n');

  const text = `
🎉 <b>ПОЛУЧЕН НОВЫЙ ОПЛАЧЕННЫЙ ЗАКАЗ!</b>

🧾 <b>Номер заказа:</b> <code>#${order.orderId.slice(0, 8)}</code>
💰 <b>Сумма к получению:</b> <b>${order.totalAmount.toFixed(2)} ${order.currency}</b>
👤 <b>Покупатель:</b> ${escapeHtml(order.customerName || 'Пользователь Telegram')} (<code>${order.customerTelegramId}</code>)
${order.customerPhone ? `📞 <b>Телефон:</b> ${escapeHtml(order.customerPhone)}\n` : ''}${order.shippingAddress ? `📍 <b>Адрес доставки:</b> ${escapeHtml(order.shippingAddress)}\n` : ''}
📦 <b>Состав заказа:</b>
${itemsList}

⚡ <i>Управляйте заказом и меняйте статус в вашей панели управления.</i>
`.trim();

  try {
    await bot.api.sendMessage(merchantTelegramId, text, {
      parse_mode: 'HTML',
    });
  } catch (err) {
    console.error(`Failed to send merchant order alert to ${merchantTelegramId}:`, err);
  }
}

export interface CustomerReceiptPayload {
  orderId: string;
  totalAmount: number;
  currency: string;
  items: Array<{
    title: string;
    quantity: number;
    price: number;
  }>;
}

/**
 * Sends order receipt and confirmation to customer via their bot chat.
 */
export async function sendCustomerOrderReceipt(
  bot: Bot<any>,
  customerTelegramId: string,
  receipt: CustomerReceiptPayload
) {
  if (!customerTelegramId) return;

  const itemsList = receipt.items
    .map(
      (item) =>
        `  • <b>${escapeHtml(item.title)}</b> × ${item.quantity} — <code>${item.price.toFixed(2)} ${receipt.currency}</code>`
    )
    .join('\n');

  const text = `
✅ <b>ОПЛАТА УСПЕШНО ПОЛУЧЕНА!</b>

🧾 <b>Заказ:</b> <code>#${receipt.orderId.slice(0, 8)}</code>
💰 <b>Сумма:</b> <b>${receipt.totalAmount.toFixed(2)} ${receipt.currency}</b>

📦 <b>Содержимое заказа:</b>
${itemsList}

Мерчант уже получил уведомление и собирает ваш заказ.
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

