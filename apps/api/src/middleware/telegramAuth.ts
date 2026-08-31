import { FastifyRequest, FastifyReply } from 'fastify';
import { validateTelegramInitData, TelegramUser, decryptBotToken } from '@telegram-commerce/config';
import { getTenantBotData } from '../services/botManager.js';

declare module 'fastify' {
  interface FastifyRequest {
    telegramUser?: TelegramUser;
    authDate?: Date;
  }
}

/**
 * Middleware validating Telegram Mini App initData cryptographic HMAC-SHA256 signature.
 */
export async function telegramAuthMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const initData =
    (req.headers['x-telegram-init-data'] as string) ||
    (req.headers['authorization']?.startsWith('tma ') ? req.headers['authorization'].substring(4) : '');

  if (!initData) {
    return reply.status(401).send({
      error: 'Missing X-Telegram-Init-Data header or Authorization: tma <data>',
    });
  }

  const tenantData = await getTenantBotData(req.tenantId);
  if (!tenantData) {
    return reply.status(404).send({
      error: 'Storefront tenant configuration not found',
    });
  }

  const botToken = decryptBotToken(tenantData.encryptedToken);
  const result = validateTelegramInitData(initData, botToken);

  if (!result.isValid) {
    return reply.status(401).send({
      error: `Invalid Telegram authentication: ${result.error}`,
    });
  }

  req.telegramUser = result.user;
  req.authDate = result.authDate;
}
