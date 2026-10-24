import { createServer } from './server.js';
import { getEnv } from '@telegram-commerce/config';
import { initBillingWorker } from './services/billingWorker.js';
import { initReservationWorker } from './services/reservationWorker.js';
import { ensureDatabaseSeeded } from './services/seedService.js';

async function main() {
  const env = getEnv();

  // 1. Ensure database has demo store and superadmin initialized
  await ensureDatabaseSeeded();

  const server = await createServer();

  // 2. Initialize BullMQ workers
  try {
    await initReservationWorker();
  } catch (err) {
    console.warn('⚠️ BullMQ reservation worker init skipped or Redis offline:', err);
  }

  if (env.MODE === 'saas') {
    try {
      await initBillingWorker();
      console.log('⚡ BullMQ recurring billing worker initialized');
    } catch (err) {
      console.warn('⚠️ BullMQ billing worker init skipped or Redis offline:', err);
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
      const { startMasterBotRunner } = (await import('@telegram-commerce/master-bot' as any)) as any;
      if (typeof startMasterBotRunner === 'function') {
        await startMasterBotRunner(masterToken);
      }
    } catch (err) {
      console.error('⚠️ Master Bot startup error:', err);
    }
  }

  // 5. Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    try {
      await server.close();
      console.log('✅ Fastify server closed cleanly.');
    } catch (err) {
      console.error('Error during server close:', err);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (process.env.NODE_ENV !== 'test') {
  main();
}
