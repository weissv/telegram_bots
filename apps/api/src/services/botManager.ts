import { Bot } from 'grammy';
import { BotContext, createTenantBot, TenantInfo } from '@telegram-commerce/telegram-engine';
import { prisma } from '@telegram-commerce/database';
import { decryptBotToken, getEnv } from '@telegram-commerce/config';
import { cacheGet, cacheSet, cacheDel } from './redisService.js';

const botInstances = new Map<string, { bot: Bot<BotContext>; token: string }>();

export interface TenantBotData {
  tenant: TenantInfo;
  encryptedToken: string;
  webhookSecret: string;
  isActive: boolean;
}

/**
 * Resolves tenant bot configuration from cache or PostgreSQL.
 */
export async function getTenantBotData(tenantId: string): Promise<TenantBotData | null> {
  const cacheKey = `tenant:bot:${tenantId}`;
  const cached = await cacheGet(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached) as TenantBotData;
    } catch {
      // cache decode failed
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { botConfig: true },
  });

  if (!tenant || !tenant.botConfig) {
    return null;
  }

  const data: TenantBotData = {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan as any,
      ownerTelegramId: tenant.owner_telegram_id,
      currency: tenant.botConfig.currency || 'USD',
      themeConfig: (tenant.botConfig.theme_config as any) || {},
    },
    encryptedToken: tenant.botConfig.bot_token_encrypted,
    webhookSecret: tenant.botConfig.webhook_secret,
    isActive: tenant.is_active,
  };

  await cacheSet(cacheKey, JSON.stringify(data), 3600); // 1-hour TTL
  return data;
}

/**
 * Returns or dynamically initializes a running grammY Bot instance for the tenant.
 */
export async function getOrInitBot(tenantId: string): Promise<{ bot: Bot<BotContext>; botToken: string; webhookSecret: string; isActive: boolean } | null> {
  const data = await getTenantBotData(tenantId);
  if (!data) return null;

  const decryptedToken = decryptBotToken(data.encryptedToken);

  const existing = botInstances.get(tenantId);
  if (existing && existing.token === decryptedToken) {
    return {
      bot: existing.bot,
      botToken: decryptedToken,
      webhookSecret: data.webhookSecret,
      isActive: data.isActive,
    };
  }

  const bot = createTenantBot({
    tenant: data.tenant,
    botToken: decryptedToken,
  });

  botInstances.set(tenantId, { bot, token: decryptedToken });

  return {
    bot,
    botToken: decryptedToken,
    webhookSecret: data.webhookSecret,
    isActive: data.isActive,
  };
}

/**
 * Invalidates cached bot instances and configuration upon merchant update.
 */
export async function invalidateTenantBot(tenantId: string): Promise<void> {
  botInstances.delete(tenantId);
  await cacheDel(`tenant:bot:${tenantId}`);
}
