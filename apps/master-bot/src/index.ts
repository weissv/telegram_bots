import { createMasterBot } from './bot.js';
import { getEnv } from '@telegram-commerce/config';

async function main() {
  const env = getEnv();

  if (env.MODE !== 'saas') {
    console.log('ℹ️ Master bot is disabled in standalone mode.');
    return;
  }

  const token = env.MASTER_BOT_TOKEN;
  if (!token || token.includes('placeholder')) {
    console.warn('⚠️ MASTER_BOT_TOKEN not provided; master bot runner skipped.');
    return;
  }

  const bot = createMasterBot(token);
  console.log('🤖 Starting Master Onboarding & Sales Bot...');
  await bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Master Bot @${botInfo.username} is running in polling mode`);
    },
  });
}

if (process.env.NODE_ENV !== 'test') {
  main();
}
