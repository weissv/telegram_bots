import { Worker, Queue } from 'bullmq';
import { prisma } from '@telegram-commerce/database';
import { getEnv, SUBSCRIPTION_GRACE_PERIOD_DAYS } from '@telegram-commerce/config';
import { getOrInitBot, invalidateTenantBot } from './botManager.js';
import { getRedisClient } from './redisService.js';

const QUEUE_NAME = 'recurring-billing';
let billingQueue: Queue | null = null;
let billingWorker: Worker | null = null;

export async function initBillingWorker() {
  const env = getEnv();
  if (env.MODE !== 'saas') {
    return;
  }

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  const connection = {
    host: redis.options.host || 'localhost',
    port: redis.options.port || 6379,
  };

  billingQueue = new Queue(QUEUE_NAME, { connection });

  // Add daily repeatable job
  await billingQueue.add(
    'check-subscriptions',
    {},
    {
      repeat: {
        pattern: '0 0 * * *', // Every midnight
      },
    }
  );

  billingWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === 'check-subscriptions') {
        await processSubscriptionExpirations();
      }
    },
    { connection }
  );

  billingWorker.on('failed', (job, err) => {
    console.error(`[Billing Worker] Job ${job?.id} failed:`, err);
  });
}

/**
 * Scans and processes expired SaaS subscriptions and grace periods.
 */
export async function processSubscriptionExpirations(): Promise<void> {
  const now = new Date();
  const gracePeriodLimit = new Date();
  gracePeriodLimit.setDate(gracePeriodLimit.getDate() - SUBSCRIPTION_GRACE_PERIOD_DAYS);

  // 1. Find subscriptions past current_period_end
  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      current_period_end: {
        lt: now,
      },
    },
    include: {
      tenant: {
        include: { botConfig: true },
      },
    },
  });

  for (const sub of expiredSubscriptions) {
    const periodEnd = sub.current_period_end || now;

    if (periodEnd < gracePeriodLimit) {
      // Grace period expired: Deactivate tenant storefront
      await prisma.tenant.update({
        where: { id: sub.tenant_id },
        data: { is_active: false },
      });

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'PAST_DUE' },
      });

      await invalidateTenantBot(sub.tenant_id);

      // Send deactivation notice
      try {
        const botData = await getOrInitBot(sub.tenant_id);
        if (botData && sub.tenant.owner_telegram_id) {
          await botData.bot.api.sendMessage(
            sub.tenant.owner_telegram_id,
            `⚠️ <b>Storefront Suspended</b>\n\nYour subscription for <b>${sub.tenant.name}</b> has expired and the grace period has ended. Your storefront bot is currently paused.\n\nPlease renew via your merchant dashboard to resume operations.`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (err) {
        console.error(`Failed to send deactivation notice to ${sub.tenant.owner_telegram_id}:`, err);
      }
    } else {
      // Within 3-day grace period: Send friendly warning reminder
      try {
        const botData = await getOrInitBot(sub.tenant_id);
        if (botData && sub.tenant.owner_telegram_id) {
          const daysRemaining = Math.max(
            1,
            SUBSCRIPTION_GRACE_PERIOD_DAYS -
              Math.floor((now.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24))
          );

          await botData.bot.api.sendMessage(
            sub.tenant.owner_telegram_id,
            `🔔 <b>Subscription Renewal Reminder</b>\n\nYour subscription for <b>${sub.tenant.name}</b> recently expired. You have <b>${daysRemaining} day(s)</b> remaining in your grace period before storefront deactivation.\n\nPlease renew your plan to avoid interruption.`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (err) {
        console.error(`Failed to send renewal warning to ${sub.tenant.owner_telegram_id}:`, err);
      }
    }
  }
}
