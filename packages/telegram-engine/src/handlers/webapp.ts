import { BotContext } from '../types.js';
import { getUpgradeInlineKeyboard } from '../keyboards/index.js';
import { getEnv, PLAN_TIERS, isHttpsUrl, isSafeTelegramUrl } from '@telegram-commerce/config';
import { t } from '@telegram-commerce/i18n';

export async function handleWebApp(ctx: BotContext) {
  const { tenant } = ctx;
  const locale = ctx.locale;
  const env = getEnv();

  const isPro = tenant.plan === PLAN_TIERS.PRO_30 || tenant.plan === PLAN_TIERS.STANDALONE_LIFETIME;

  if (isPro) {
    const webAppUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=${tenant.id}`;
    let button: any;

    if (isHttpsUrl(webAppUrl)) {
      button = { text: t(locale, 'kb.open_store'), web_app: { url: webAppUrl } };
    } else if (isSafeTelegramUrl(webAppUrl)) {
      button = { text: t(locale, 'kb.open_store'), url: webAppUrl };
    } else {
      button = { text: `🛍️ ${t(locale, 'kb.catalog')}`, callback_data: 'catalog:browse' };
    }

    await ctx.reply(t(locale, 'webapp.launch'), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[button]],
      },
    });
  } else {
    const text = `
${t(locale, 'webapp.upgrade_title')}

${t(locale, 'webapp.upgrade_body')}
`.trim();

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: getUpgradeInlineKeyboard(locale),
    });
  }
}
