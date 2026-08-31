import { FastifyPluginAsync } from 'fastify';
import { getOrInitBot } from '../services/botManager.js';

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { tenant_id: string };
  }>('/api/v1/webhooks/:tenant_id', async (req, reply) => {
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

    // 3. Feature gate: Check if tenant is active
    if (!botData.isActive) {
      // 200 OK with no-op to pause bot updates without triggering Telegram retry queue
      return reply.status(200).send({ ok: true, reason: 'Tenant storefront is inactive or expired' });
    }

    // 4. Dispatch Telegram update to tenant's grammY bot instance
    try {
      await botData.bot.handleUpdate(req.body as any);
      return reply.status(200).send({ ok: true });
    } catch (err: any) {
      req.log.error({ err }, `Error processing webhook update for tenant ${tenant_id}`);
      return reply.status(200).send({ ok: false, error: err?.message });
    }
  });
};
