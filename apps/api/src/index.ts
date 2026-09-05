import { createServer } from './server.js';
import { getEnv } from '@telegram-commerce/config';
import { initBillingWorker } from './services/billingWorker.js';
import { ensureDatabaseSeeded } from './services/seedService.js';
import { startMasterBotRunner } from '@telegram-commerce/master-bot';

async function main() {
  const env = getEnv();

  // 1. Ensure database has demo store and superadmin initialized
  await ensureDatabaseSeeded();

  const server = await createServer();

  // 2. Initialize BullMQ worker if in SaaS mode
  if (env.MODE === 'saas') {
    try {
      await initBillingWorker();
      console.log('⚡ BullMQ recurring billing worker initialized');
    } catch (err) {
      console.warn('⚠️ BullMQ worker init skipped or Redis offline:', err);
    }
  }

  // 3. Start API Server
  try {
    await server.listen({
      port: env.PORT,
      host: env.HOST,
    });
    console.log(`🚀 Telegram Commerce API running at http://${env.HOST}:${env.PORT} [MODE=${env.MODE}]`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // 4. Start Master Onboarding & Storefront Bot runner in polling mode
  const masterToken = env.MASTER_BOT_TOKEN;
  if (masterToken && !masterToken.includes('placeholder')) {
    try {
      await startMasterBotRunner(masterToken);
    } catch (err) {
      console.error('⚠️ Master Bot startup error:', err);
    }
  }
}

if (process.env.NODE_ENV !== 'test') {
  main();
}
