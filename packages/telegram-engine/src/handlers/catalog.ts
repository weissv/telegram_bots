import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types.js';
import { getCatalogInlineKeyboard } from '../keyboards/index.js';
import { buildDisabledStorefrontMessage, isStorefrontDisabled } from './start.js';
import { t, formatCurrency } from '@telegram-commerce/i18n';

export async function handleCatalog(ctx: BotContext, targetPage = 1, targetCategory?: string) {
  const { db, tenant } = ctx;
  const locale = ctx.locale;

  if (isStorefrontDisabled(tenant)) {
    const msg = buildDisabledStorefrontMessage(tenant, locale);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: t(locale, 'checkout.store_not_published'), show_alert: true }).catch(() => {});
    }
    await ctx.reply(msg, { parse_mode: 'HTML' });
    return;
  }

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
      skip: Math.max(0, targetPage - 1),
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
        ? t(locale, 'catalog.empty_category', { category: escapeHtml(category) })
        : t(locale, 'catalog.empty'),
      { parse_mode: 'HTML' }
    );
    return;
  }

  const product = products[0];
  const totalPages = totalCount;
  const currency = tenant.currency || 'UZS';
  const variants = Array.isArray((product as any).variants)
    ? ((product as any).variants as any[]).map((v) => String(v).trim()).filter(Boolean)
    : [];

  const stockBadge =
    product.stock > 10
      ? t(locale, 'catalog.stock_in')
      : product.stock > 0
        ? t(locale, 'catalog.stock_low', { count: product.stock })
        : t(locale, 'catalog.stock_out');

  const variantsLine =
    variants.length > 0
      ? `\n📏 <b>${locale === 'uz' ? 'Variantlar' : locale === 'en' ? 'Options' : 'Варианты'}:</b> ${variants.map(escapeHtml).join(', ')}`
      : '';

  const caption = `
${t(locale, 'catalog.title', { title: escapeHtml(product.title) })}
${t(locale, 'catalog.category', { category: escapeHtml(product.category) })}

${escapeHtml(product.description || '')}

${t(locale, 'catalog.price', { price: formatCurrency(Number(product.price), currency, locale) })}
📦 <b>${locale === 'ru' ? 'Статус' : locale === 'en' ? 'Status' : 'Holat'}:</b> ${stockBadge}${variantsLine}

${t(locale, 'catalog.item_of', { current: targetPage, total: totalPages })}
`.trim();

  const keyboard = getCatalogInlineKeyboard(
    product.id,
    targetPage,
    totalPages,
    categories,
    locale,
    category,
    { stock: product.stock, variants }
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

/**
 * Handles /search <query> inside Telegram chat catalog.
 */
export async function handleCatalogSearch(ctx: BotContext, rawQuery: string) {
  const { db, tenant } = ctx;
  const locale = ctx.locale;

  if (isStorefrontDisabled(tenant)) {
    await ctx.reply(buildDisabledStorefrontMessage(tenant, locale), { parse_mode: 'HTML' });
    return;
  }

  const query = rawQuery.trim();
  if (!query) {
    const prompt =
      locale === 'uz'
        ? '🔍 Qidirish uchun buyruqdan keyin so‘z kiriting. Masalan: <code>/search xudi</code>'
        : locale === 'en'
          ? '🔍 Enter a keyword after the command. Example: <code>/search hoodie</code>'
          : '🔍 Укажите запрос после команды. Например: <code>/search худи</code>';
    await ctx.reply(prompt, { parse_mode: 'HTML' });
    return;
  }

  const currency = tenant.currency || 'UZS';
  const matches = await db.product.findMany({
    where: {
      is_active: true,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 8,
    orderBy: { createdAt: 'desc' },
  });

  if (matches.length === 0) {
    const emptyText =
      locale === 'uz'
        ? `🔍 «<b>${escapeHtml(query)}</b>» bo‘yicha mahsulot topilmadi.`
        : locale === 'en'
          ? `🔍 No products found matching "<b>${escapeHtml(query)}</b>".`
          : `🔍 По запросу «<b>${escapeHtml(query)}</b>» товары не найдены.`;
    const keyboard = new InlineKeyboard().text(t(locale, 'catalog.all_categories'), 'catalog:browse');
    await ctx.reply(emptyText, { parse_mode: 'HTML', reply_markup: keyboard });
    return;
  }

  const keyboard = new InlineKeyboard();
  const lines = matches.map((p: any, idx: number) => {
    const stockBadge = p.stock > 0 ? `${p.stock} шт.` : t(locale, 'catalog.stock_out');
    if (p.stock > 0) {
      keyboard.text(`🛒 ${p.title.slice(0, 20)}`, `cart:add:${p.id}`).row();
    }
    return `${idx + 1}. <b>${escapeHtml(p.title)}</b> — <code>${formatCurrency(Number(p.price), currency, locale)}</code> (${stockBadge})`;
  });
  keyboard.text(t(locale, 'catalog.view_cart'), 'cart:view');

  const header =
    locale === 'uz'
      ? `🔍 <b>Qidiruv natijalari («${escapeHtml(query)}»):</b>`
      : locale === 'en'
        ? `🔍 <b>Search results ("${escapeHtml(query)}"):</b>`
        : `🔍 <b>Результаты поиска («${escapeHtml(query)}»):</b>`;

  await ctx.reply(`${header}\n\n${lines.join('\n')}`, {
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
