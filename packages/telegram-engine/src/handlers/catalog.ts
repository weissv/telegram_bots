import { BotContext } from '../types.js';
import { getCatalogInlineKeyboard } from '../keyboards/index.js';

export async function handleCatalog(ctx: BotContext, targetPage = 1, targetCategory?: string) {
  const { db, tenant } = ctx;

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
        ? `No products found in category "<b>${category}</b>".`
        : '📦 Our product catalog is currently being updated. Please check back soon!',
      {
        parse_mode: 'HTML',
      }
    );
    return;
  }

  const product = products[0];
  const totalPages = totalCount;
  const currency = tenant.currency || 'USD';

  const stockBadge =
    product.stock > 10
      ? '🟢 In Stock'
      : product.stock > 0
        ? `🟡 Low Stock (${product.stock} left)`
        : '🔴 Out of Stock';

  const caption = `
🏷️ <b>${escapeHtml(product.title)}</b>
📁 <i>Category: ${escapeHtml(product.category)}</i>

${escapeHtml(product.description || '')}

💵 <b>Price:</b> <code>${Number(product.price).toFixed(2)} ${currency}</code>
📦 <b>Status:</b> ${stockBadge}

<i>Item ${targetPage} of ${totalPages}</i>
`.trim();

  const keyboard = getCatalogInlineKeyboard(
    product.id,
    targetPage,
    totalPages,
    categories,
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
      // If edit fails (e.g. same content or media conversion issue), edit caption or reply
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
      // Fallback
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
      // Fallback to text
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
