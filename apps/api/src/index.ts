import { createServer } from './server.js';
import { getEnv } from '@telegram-commerce/config';
import { initBillingWorker } from './services/billingWorker.js';

async function main() {
  const env = getEnv();
  const server = await createServer();

  // Initialize BullMQ worker if in SaaS mode
  if (env.MODE === 'saas') {
    try {
      await initBillingWorker();
      console.log('⚡ BullMQ recurring billing worker initialized');
    } catch (err) {
      console.warn('⚠️ BullMQ worker init skipped or Redis offline:', err);
    }
  }

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
}

if (process.env.NODE_ENV !== 'test') {
  main();
}
