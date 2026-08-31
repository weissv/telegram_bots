import { BotContext } from '../types.js';
import { getCatalogInlineKeyboard } from '../keyboards/index.js';
import { t, formatCurrency } from '@telegram-commerce/i18n';

export async function handleCatalog(ctx: BotContext, targetPage = 1, targetCategory?: string) {
  const { db, tenant } = ctx;
  const locale = ctx.locale;

  const category = targetCategory === 'all' ? undefined : targetCategory || ctx.session.currentCategory;
  ctx.session.currentCategory = category;
  ctx.session.catalogPage = targetPage;

  const whereClause: any = { is_active: true };
  if (category) {
    whereClause.category = category;
  }

  const [totalCount, products, allCategoriesRaw] = await Promise.all([
    db.product.count({ where: whereClause }),
    db.product.findMany({
      where: whereClause,
      skip: Math.max(0, (targetPage - 1)),
      take: 1,
      orderBy: { createdAt: 'desc' },
    }),
    db.product.findMany({
      where: { is_active: true },
      select: { category: true },
      distinct: ['category'],
    }),
  ]);

  const categories = allCategoriesRaw.map((c: { category: string }) => c.category).filter(Boolean);

  if (totalCount === 0 || products.length === 0) {
    await ctx.reply(
      category
        ? t(locale, 'catalog.empty_category', { category })
        : t(locale, 'catalog.empty'),
      { parse_mode: 'HTML' }
    );
    return;
  }

  const product = products[0];
  const totalPages = totalCount;
  const currency = tenant.currency || 'USD';

  const stockBadge =
    product.stock > 10
      ? t(locale, 'catalog.stock_in')
      : product.stock > 0
        ? t(locale, 'catalog.stock_low', { count: product.stock })
        : t(locale, 'catalog.stock_out');

  const caption = `
${t(locale, 'catalog.title', { title: escapeHtml(product.title) })}
${t(locale, 'catalog.category', { category: escapeHtml(product.category) })}

${escapeHtml(product.description || '')}

${t(locale, 'catalog.price', { price: formatCurrency(Number(product.price), currency, locale) })}
📦 <b>${locale === 'ru' ? 'Статус' : 'Holat'}:</b> ${stockBadge}

${t(locale, 'catalog.item_of', { current: targetPage, total: totalPages })}
`.trim();

  const keyboard = getCatalogInlineKeyboard(
    product.id,
    targetPage,
    totalPages,
    categories,
    locale,
    category
  );

  const primaryImage = product.images?.[0];

  if (primaryImage && ctx.callbackQuery) {
    try {
      await ctx.editMessageMedia(
        {
          type: 'photo',
          media: primaryImage,
          caption,
          parse_mode: 'HTML',
        },
        { reply_markup: keyboard }
      );
      await ctx.answerCallbackQuery();
      return;
    } catch {
      // fallback
    }
  }

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageCaption({
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      await ctx.answerCallbackQuery();
      return;
    } catch {
      // fallback
    }
  }

  if (primaryImage) {
    try {
      await ctx.replyWithPhoto(primaryImage, {
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    } catch {
      // fallback to text
    }
  }

  await ctx.reply(caption, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
