import { BotContext } from '../types.js';
import { InlineKeyboard } from 'grammy';
import { ORDER_STATUS } from '@telegram-commerce/config';
import { t, formatCurrency } from '@telegram-commerce/i18n';

export async function handleOrders(ctx: BotContext) {
  const { db, tenant, from } = ctx;
  const locale = ctx.locale;
  const telegramUserId = from?.id ? String(from.id) : '';
  const currency = tenant.currency || 'UZS';

  if (!telegramUserId) {
    await ctx.reply(
      locale === 'uz'
        ? "Foydalanuvchi ma'lumotlarini olib bo'lmadi."
        : locale === 'en'
          ? 'Unable to retrieve user information.'
          : 'Не удалось определить пользователя Telegram.'
    );
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
    [ORDER_STATUS.PENDING]: 'orders.status_pending',
    [ORDER_STATUS.PAYMENT_REVIEW]: 'orders.status_payment_review',
    [ORDER_STATUS.PAID]: 'orders.status_paid',
    [ORDER_STATUS.DELIVERED]: 'orders.status_delivered',
    [ORDER_STATUS.CANCELLED]: 'orders.status_cancelled',
    [ORDER_STATUS.REFUNDED]: 'orders.status_refunded',
  };

  const list = orders
    .map((o: any) => {
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      const itemsSummary = items
        .map((i: any) => `${i.title}${i.variant ? ` (${i.variant})` : ''} (x${i.quantity})`)
        .join(', ');
      const statusLabel = t(locale, statusKeys[o.status] || 'orders.status_pending');
      const baseLine = t(locale, 'orders.order_line', {
        orderId: o.id.slice(0, 8),
        date: new Date(o.createdAt).toLocaleDateString(),
        status: statusLabel,
        total: formatCurrency(Number(o.total_amount), currency, locale),
        items: escapeHtml(itemsSummary || '—'),
      });
      const deliveryLabel =
        o.delivery_method === 'PICKUP'
          ? t(locale, 'checkout.delivery_pickup')
          : t(locale, 'checkout.delivery_courier');
      const extraLines = [
        o.delivery_method ? `🚚 <i>${escapeHtml(deliveryLabel)}</i>` : '',
        o.receipt_url ? `🧾 <a href="${escapeHtml(String(o.receipt_url))}">Чек</a>` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      return extraLines ? `${baseLine}\n${extraLines}` : baseLine;
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
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
