import { InlineKeyboard } from 'grammy';
import { BotContext, TenantInfo } from '../types.js';
import { getMainMenuKeyboard } from '../keyboards/index.js';
import { t, formatCurrency, type Locale } from '@telegram-commerce/i18n';
import { PLAN_TIERS } from '@telegram-commerce/config';

export function isStorefrontDisabled(tenant: TenantInfo): boolean {
  return tenant.isActive === false || tenant.botConfigActive === false;
}

export function buildDisabledStorefrontMessage(tenant: TenantInfo, locale: Locale): string {
  const support = tenant.themeConfig?.supportContact
    ? `\n📞 ${locale === 'uz' ? "Qo'llab-quvvatlash" : locale === 'en' ? 'Support' : 'Поддержка'}: ${escapeHtml(tenant.themeConfig.supportContact)}`
    : '';
  return `⚠️ ${t(locale, 'checkout.store_not_published')}${support}`;
}

/**
 * Handles /start command. Shows language selector on first interaction,
 * then localized welcome message with store banner.
 */
export async function handleStart(ctx: BotContext) {
  const { tenant } = ctx;

  // If user has not selected a language yet, show language picker
  if (!ctx.session.languageSelected) {
    await handleLanguageSelection(ctx);
    return;
  }

  const locale = ctx.locale;

  if (isStorefrontDisabled(tenant)) {
    await ctx.reply(buildDisabledStorefrontMessage(tenant, locale), { parse_mode: 'HTML' });
    return;
  }

  // Deep linking: t.me/bot?start=prod_<id>
  const match = (ctx as any).match;
  const payload = typeof match === 'string' ? match.trim() : '';
  if (payload.startsWith('prod_')) {
    const productId = payload.substring(5);
    try {
      const product = await ctx.db.product.findFirst({
        where: { id: productId, is_active: true },
      });
      if (product) {
        const variants = Array.isArray((product as any).variants)
          ? ((product as any).variants as any[]).map((v) => String(v).trim()).filter(Boolean)
          : [];
        const keyboard = new InlineKeyboard();
        if (product.stock <= 0) {
          keyboard.text(t(locale, 'catalog.stock_out'), 'noop');
        } else if (variants.length > 0) {
          const compactId = product.id.replace(/-/g, '');
          const visibleVariants = variants.slice(0, 8);
          for (let i = 0; i < visibleVariants.length; i += 4) {
            const chunk = visibleVariants.slice(i, i + 4).map((v, offset) =>
              InlineKeyboard.text(`🛒 ${v.slice(0, 14)}`, `cart:v:${compactId}:${i + offset}`)
            );
            keyboard.row(...chunk);
          }
        } else {
          keyboard.text(t(locale, 'catalog.add_to_cart'), `cart:add:${product.id}`);
        }
        keyboard.row().text(t(locale, 'catalog.view_cart'), 'cart:view');

        const variantsLine =
          variants.length > 0
            ? `\n📏 <b>${locale === 'uz' ? 'Variantlar' : locale === 'en' ? 'Options' : 'Варианты'}:</b> ${variants.map(escapeHtml).join(', ')}`
            : '';

        const stockText =
          product.stock <= 0
            ? t(locale, 'catalog.stock_out')
            : `${product.stock}`;

        const caption = `
<b>${escapeHtml(product.title)}</b> (${escapeHtml(product.category)})

${escapeHtml(product.description || '')}

💰 <b>${locale === 'ru' ? 'Цена' : locale === 'en' ? 'Price' : 'Narxi'}:</b> ${formatCurrency(Number(product.price), tenant.currency || 'UZS', locale)}
📦 <b>${locale === 'ru' ? 'В наличии' : locale === 'en' ? 'In stock' : 'Mavjud'}:</b> ${stockText}${variantsLine}
`.trim();

        if (product.images?.[0]) {
          await ctx.replyWithPhoto(product.images[0], {
            caption,
            parse_mode: 'HTML',
            reply_markup: keyboard,
          }).catch(async () => {
            await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
          });
        } else {
          await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        return;
      }
    } catch {
      // fallback to welcome message
    }
  }

  const storeName = tenant.themeConfig?.storeName || tenant.name || 'Store';
  const bannerUrl = tenant.themeConfig?.bannerUrl;
  const description = tenant.themeConfig?.description || t(locale, 'start.description_default');
  const isPro = tenant.plan === PLAN_TIERS.PRO_30 || tenant.plan === PLAN_TIERS.STANDALONE_LIFETIME;

  const welcomeMessage = `
${t(locale, 'start.welcome', { storeName: escapeHtml(storeName) })}

${escapeHtml(description)}

${isPro ? t(locale, 'start.tip_pro') : t(locale, 'start.tip_basic')}
`.trim();

  const keyboard = getMainMenuKeyboard(tenant, locale);

  if (bannerUrl) {
    try {
      await ctx.replyWithPhoto(bannerUrl, {
        caption: welcomeMessage,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    } catch {
      // Fallback to text message if image fails to load
    }
  }

  await ctx.reply(welcomeMessage, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

/**
 * Shows the inline language selector keyboard.
 */
export async function handleLanguageSelection(ctx: BotContext) {
  const keyboard = new InlineKeyboard()
    .text('🇷🇺 Русский (Основной)', 'lang:ru')
    .row()
    .text('🇬🇧 English', 'lang:en')
    .text("🇺🇿 O'zbekcha", 'lang:uz');

  await ctx.reply(t(ctx.locale, 'lang.select'), {
    reply_markup: keyboard,
  });
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
