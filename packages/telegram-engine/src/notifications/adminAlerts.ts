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
🎉 <b>NEW PAID ORDER RECEIVED!</b>

🧾 <b>Order ID:</b> <code>#${order.orderId.slice(0, 8)}</code>
💰 <b>Total Amount:</b> <b>${order.totalAmount.toFixed(2)} ${order.currency}</b>
👤 <b>Customer:</b> ${escapeHtml(order.customerName || 'Telegram User')} (<code>${order.customerTelegramId}</code>)
${order.customerPhone ? `📞 <b>Phone:</b> ${escapeHtml(order.customerPhone)}\n` : ''}${order.shippingAddress ? `📍 <b>Delivery Address:</b> ${escapeHtml(order.shippingAddress)}\n` : ''}
📦 <b>Items Purchased:</b>
${itemsList}

⚡ <i>Manage this order in your Merchant Admin Backoffice.</i>
`.trim();

  try {
    await bot.api.sendMessage(merchantTelegramId, text, {
      parse_mode: 'HTML',
    });
  } catch (err) {
    console.error(`Failed to send merchant order alert to ${merchantTelegramId}:`, err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
