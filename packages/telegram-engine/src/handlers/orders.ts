import { BotContext } from '../types.js';
import { InlineKeyboard } from 'grammy';

export async function handleOrders(ctx: BotContext) {
  const { db, tenant, from } = ctx;
  const telegramUserId = from?.id ? String(from.id) : '';
  const currency = tenant.currency || 'USD';

  if (!telegramUserId) {
    await ctx.reply('Unable to retrieve user information.');
    return;
  }

  const orders = await db.order.findMany({
    where: { customer_telegram_id: telegramUserId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (orders.length === 0) {
    const text = '📋 <b>You have no previous orders yet.</b>\n\nStart shopping by clicking 📦 Catalog!';
    const keyboard = new InlineKeyboard().text('📦 Browse Catalog', 'catalog:browse');
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    return;
  }

  const statusIcons: Record<string, string> = {
    PENDING: '⏳ Pending Payment',
    PAID: '✅ Paid / Processing',
    DELIVERED: '🚚 Delivered',
    CANCELLED: '❌ Cancelled',
  };

  const list = orders
    .map((o: any) => {
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      const itemsSummary = items.map((i: any) => `${i.title} (x${i.quantity})`).join(', ');
      const statusLabel = statusIcons[o.status] || o.status;
      return `🧾 <b>Order #${o.id.slice(0, 8)}</b>\n📅 <i>${new Date(o.createdAt).toLocaleDateString()}</i>\n📊 <b>Status:</b> ${statusLabel}\n💰 <b>Amount:</b> <code>${Number(o.total_amount).toFixed(2)} ${currency}</code>\n📦 <i>Items: ${escapeHtml(itemsSummary || 'Standard package')}</i>`;
    })
    .join('\n\n━━━━━━━━━━━━━━━━━━━\n\n');

  const text = `
📋 <b>YOUR RECENT ORDERS</b>

${list}
`.trim();

  await ctx.reply(text, { parse_mode: 'HTML' });
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
