import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types.js';
import { getMainMenuKeyboard } from '../keyboards/index.js';
import { t } from '@telegram-commerce/i18n';
import { PLAN_TIERS } from '@telegram-commerce/config';

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
    .text('🇷🇺 Русский', 'lang:ru')
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
