import { BotContext } from '../types.js';
import { InlineKeyboard } from 'grammy';
import { t, formatCurrency } from '@telegram-commerce/i18n';

export async function handleOrders(ctx: BotContext) {
  const { db, tenant, from } = ctx;
  const locale = ctx.locale;
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
    const text = t(locale, 'orders.empty');
    const keyboard = new InlineKeyboard().text(t(locale, 'orders.browse'), 'catalog:browse');
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    return;
  }

  const statusKeys: Record<string, string> = {
    PENDING: 'orders.status_pending',
    PAID: 'orders.status_paid',
    DELIVERED: 'orders.status_delivered',
    CANCELLED: 'orders.status_cancelled',
  };

  const list = orders
    .map((o: any) => {
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      const itemsSummary = items.map((i: any) => `${i.title} (x${i.quantity})`).join(', ');
      const statusLabel = t(locale, statusKeys[o.status] || 'orders.status_pending');
      return t(locale, 'orders.order_line', {
        orderId: o.id.slice(0, 8),
        date: new Date(o.createdAt).toLocaleDateString(),
        status: statusLabel,
        total: formatCurrency(Number(o.total_amount), currency, locale),
        items: escapeHtml(itemsSummary || '—'),
      });
    })
    .join('\n\n━━━━━━━━━━━━━━━━━━━\n\n');

  const text = `
${t(locale, 'orders.title')}

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
