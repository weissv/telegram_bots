import { Worker, Queue, type Job } from 'bullmq';
import { prisma } from '@telegram-commerce/database';
import { getEnv, ORDER_STATUS } from '@telegram-commerce/config';
import { t } from '@telegram-commerce/i18n';
import { getOrInitBot } from './botManager.js';
import { getRedisClient } from './redisService.js';

const QUEUE_NAME = 'order-reservation-expiry';
const RESERVATION_TTL_MS = 15 * 60 * 1000; // 15 minutes

let reservationQueue: Queue | null = null;
let reservationWorker: Worker | null = null;

export interface ReservationJobData {
  orderId: string;
  tenantId: string;
  customerTelegramId: string;
  items: Array<{ productId: string; quantity: number }>;
}

/**
 * Initializes the BullMQ reservation expiry worker.
 * When an order stays PENDING for 15 minutes, it is auto-cancelled
 * and stock is atomically restored.
 */
export async function initReservationWorker() {
  const redis = getRedisClient();
  if (!redis) {
    console.warn('[ReservationWorker] No Redis available. Reservation expiry disabled.');
    return;
  }

  const connection = {
    host: redis.options.host || 'localhost',
    port: redis.options.port || 6379,
  };

  reservationQueue = new Queue(QUEUE_NAME, { connection });

  reservationWorker = new Worker(
    QUEUE_NAME,
    async (job: Job<ReservationJobData>) => {
      await processReservationExpiry(job.data);
    },
    { connection }
  );

  reservationWorker.on('failed', (job, err) => {
    console.error(`[ReservationWorker] Job ${job?.id} failed:`, err);
  });

  console.log('[ReservationWorker] Initialized successfully.');
}

/**
 * Enqueues a delayed reservation expiry job for a newly created PENDING order.
 * The job fires after 15 minutes.
 */
export async function enqueueReservationExpiry(data: ReservationJobData): Promise<void> {
  if (!reservationQueue) {
    console.warn('[ReservationWorker] Queue not initialized. Skipping reservation enqueue.');
    return;
  }

  await reservationQueue.add(
    `expire-order-${data.orderId}`,
    data,
    {
      delay: RESERVATION_TTL_MS,
      removeOnComplete: true,
      removeOnFail: { count: 100 },
      jobId: `reservation:${data.orderId}`,
    }
  );
}

/**
 * Cancels a pending reservation expiry job (e.g., when order transitions to PAID).
 */
export async function cancelReservationExpiry(orderId: string): Promise<void> {
  if (!reservationQueue) return;

  try {
    const job = await reservationQueue.getJob(`reservation:${orderId}`);
    if (job) {
      const state = await job.getState();
      if (state === 'delayed' || state === 'waiting') {
        await job.remove();
      }
    }
  } catch (err) {
    console.warn(`[ReservationWorker] Failed to cancel reservation for order ${orderId}:`, err);
  }
}

/**
 * Processes reservation expiry: cancels the order and restores stock if still PENDING.
 */
async function processReservationExpiry(data: ReservationJobData): Promise<void> {
  const { orderId, tenantId, customerTelegramId, items } = data;

  // Check if order is still PENDING
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId, status: ORDER_STATUS.PENDING as any },
  });

  if (!order) {
    // Order already paid, delivered, or cancelled — nothing to do
    return;
  }

  // Transaction: cancel order + restore stock atomically
  await prisma.$transaction(async (tx) => {
    // Mark order as CANCELLED
    await tx.order.update({
      where: { id: orderId },
      data: { status: ORDER_STATUS.CANCELLED as any },
    });

    // Restore stock for each item
    for (const item of items) {
      await tx.$executeRaw`
        UPDATE "Product"
        SET "stock" = "stock" + ${item.quantity}
        WHERE "id" = ${item.productId}
          AND "tenant_id" = ${tenantId}
      `;
    }
  });

  // Notify customer about cancellation
  try {
    const botData = await getOrInitBot(tenantId);
    if (botData && customerTelegramId) {
      // Default to 'ru' for reservation expiry notifications
      const locale = 'ru';
      await botData.bot.api.sendMessage(
        customerTelegramId,
        t(locale, 'reservation.expired', { orderId: orderId.slice(0, 8) }),
        { parse_mode: 'HTML' }
      );
    }
  } catch (err) {
    console.error(`[ReservationWorker] Failed to notify customer ${customerTelegramId}:`, err);
  }

  console.log(`[ReservationWorker] Order ${orderId} expired and cancelled. Stock restored.`);
}
