import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { ensureBotInitialized, getOrInitBot } from '../services/botManager.js';

const SUSPENDED_SUBSCRIPTION_STATUSES = new Set([
  'PAST_DUE',
  'CANCELED',
  'PENDING_PAYMENT',
  'PENDING_REVIEW',
]);

async function handleTelegramWebhook(
  req: FastifyRequest<{ Params: { tenant_id: string } }>,
  reply: FastifyReply
) {
  const { tenant_id } = req.params;
  const secretTokenHeader = req.headers['x-telegram-bot-api-secret-token'] as string;

  // 1. Resolve bot instance and stored secret
  const botData = await getOrInitBot(tenant_id);

  if (!botData) {
    // Return 200 to prevent Telegram retry storms on deleted bots
    return reply.status(200).send({ ok: false, reason: 'Tenant bot not found' });
  }

  // 2. Validate webhook secret token
  if (botData.webhookSecret && botData.webhookSecret !== secretTokenHeader) {
    return reply.status(403).send({ error: 'Invalid secret token header' });
  }

  // 3. Feature gate: Check if tenant subscription is active and bot storefront is published
  const isSuspendedOrUnpublished =
    !botData.tenantActive ||
    !botData.botActive ||
    SUSPENDED_SUBSCRIPTION_STATUSES.has(botData.subscriptionStatus);

  if (isSuspendedOrUnpublished) {
    const update = req.body as any;
    const chatId = update?.message?.chat?.id;
    const msgText = update?.message?.text;

    if (
      chatId &&
      typeof msgText === 'string' &&
      botData.botToken &&
      !botData.botToken.toUpperCase().includes('PLACEHOLDER')
    ) {
      const supportContact = (botData.tenant.themeConfig as any)?.supportContact;
      const noticeText = supportContact
        ? `Магазин временно приостановлен или находится на проверке. Обратитесь в поддержку магазина: ${supportContact}`
        : 'Магазин временно приостановлен или находится на проверке. Обратитесь в поддержку магазина.';

      // Fire-and-forget safe reply so Telegram doesn't time out or retry
      void fetch(`https://api.telegram.org/bot${botData.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: noticeText,
        }),
      }).catch((err) => {
        req.log.warn({ err }, `Failed to send paused-store notice for tenant ${tenant_id}`);
      });
    }

    // 200 OK to prevent Telegram retry queue buildup
    return reply.status(200).send({
      ok: true,
      reason: 'Tenant storefront is paused, unpublished, or pending verification',
    });
  }

  // 4. Ensure botInfo is initialized and dispatch Telegram update
  try {
    await ensureBotInitialized(botData.bot, botData.botToken, undefined, botData.tenant.name);
    await botData.bot.handleUpdate(req.body as any);
    return reply.status(200).send({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, `Error processing webhook update for tenant ${tenant_id}`);
    return reply.status(200).send({ ok: false, error: err?.message });
  }
}

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { tenant_id: string } }>('/api/v1/webhooks/:tenant_id', handleTelegramWebhook);
  fastify.post<{ Params: { tenant_id: string } }>('/api/v1/webhooks/telegram/:tenant_id', handleTelegramWebhook);
};
