import { createMasterBot, MasterBotContext } from './bot.js';
import { getEnv } from '@telegram-commerce/config';

export { createMasterBot, type MasterBotContext };
export * from './handlers/sales.js';
export * from './handlers/demo.js';
export * from './conversations/onboarding.js';

export async function startMasterBotRunner(token?: string) {
  const env = getEnv();
  const botToken = token || env.MASTER_BOT_TOKEN;

  if (!botToken || botToken.includes('placeholder')) {
    console.warn('⚠️ MASTER_BOT_TOKEN not provided; master bot runner skipped.');
    return null;
  }

  const bot = createMasterBot(botToken);
  console.log('🤖 Starting Master Onboarding & Storefront Bot...');

  bot.start({
    onStart: async (botInfo) => {
      console.log(`✅ Master Bot @${botInfo.username} is running in polling mode`);
      try {
        await bot.api.setMyCommands([
          { command: 'start', description: '🚀 Platform Overview & Plans' },
          { command: 'catalog', description: '🛍️ Browse Demo Store' },
          { command: 'demo', description: '📱 Interactive Demos (Mini App & Admin)' },
          { command: 'newstore', description: '⚡ Create Your Own Store' },
          { command: 'admin', description: '👑 Superadmin Control Center' },
        ]);

        if (env.PUBLIC_MINIAPP_URL) {
          await bot.api.setChatMenuButton({
            menu_button: {
              type: 'web_app',
              text: '🛍️ Open Store',
              web_app: { url: `${env.PUBLIC_MINIAPP_URL}?tenant_id=demo-tenant` },
            },
          });
        }
      } catch (err: any) {
        console.warn('⚠️ Non-critical: Could not set bot menu commands:', err?.message);
      }
    },
  });

  return bot;
}

if (process.env.NODE_ENV !== 'test' && !process.env.EMBEDDED_RUNNER) {
  startMasterBotRunner();
}
