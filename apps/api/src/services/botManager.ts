import { Bot } from 'grammy';
import { BotContext, createTenantBot, TenantInfo } from '@telegram-commerce/telegram-engine';

type UserFromGetMe = Bot['botInfo'];
import { prisma } from '@telegram-commerce/database';
import { decryptBotToken, getEnv } from '@telegram-commerce/config';
import { cacheGet, cacheSet, cacheDel } from './redisService.js';

const botInstances = new Map<string, { bot: Bot<BotContext>; token: string }>();
const botInfoCache = new Map<string, UserFromGetMe>();

export interface TenantBotData {
  tenant: TenantInfo;
  encryptedToken: string;
  webhookSecret: string;
  botUsername?: string;
  isActive: boolean;
  tenantActive: boolean;
  botActive: boolean;
  subscriptionStatus: string;
}

function buildFallbackBotInfo(botToken: string, botUsername?: string, storeName?: string): UserFromGetMe {
  const prefix = Number.parseInt(botToken.split(':')[0] || '0', 10);
  return {
    id: Number.isFinite(prefix) && prefix > 0 ? prefix : 1000000,
    is_bot: true,
    first_name: storeName || 'Store Bot',
    username: botUsername || 'store_bot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  } as UserFromGetMe;
}

/**
 * Ensures `bot.botInfo` is populated before calling `bot.handleUpdate(update)`
 * so grammY never throws `Bot info not initialized`.
 */
export async function ensureBotInitialized(
  bot: Bot<BotContext>,
  botToken: string,
  botUsername?: string,
  storeName?: string
): Promise<void> {
  if (bot.isInited()) {
    return;
  }

  const cachedInfo = botInfoCache.get(botToken);
  if (cachedInfo) {
    bot.botInfo = cachedInfo;
    return;
  }

  const looksRealToken =
    Boolean(botToken) &&
    !botToken.toUpperCase().includes('PLACEHOLDER') &&
    botToken.includes(':');

  if (looksRealToken) {
    try {
      await bot.init();
      if (bot.isInited()) {
        botInfoCache.set(botToken, bot.botInfo);
        return;
      }
    } catch (err: any) {
      console.warn(
        `[BotManager] bot.init() failed for ${botUsername || 'unknown'}, using fallback botInfo:`,
        err?.message || err
      );
    }
  }

  bot.botInfo = buildFallbackBotInfo(botToken, botUsername, storeName);
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

  const tenantActive = Boolean(tenant.is_active);
  const botActive = Boolean(tenant.botConfig.is_active);
  const subscriptionStatus = String((tenant as any).subscription_status || 'PENDING_PAYMENT');
  const subscriptionAllowed = subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIALING';

  const data: TenantBotData = {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan as any,
      ownerTelegramId: tenant.owner_telegram_id,
      currency: tenant.botConfig.currency || 'UZS',
      themeConfig: (tenant.botConfig.theme_config as any) || {},
    },
    encryptedToken: tenant.botConfig.bot_token_encrypted,
    webhookSecret: tenant.botConfig.webhook_secret,
    botUsername: tenant.botConfig.bot_username || undefined,
    isActive: Boolean(tenantActive && botActive && subscriptionAllowed),
    tenantActive,
    botActive,
    subscriptionStatus,
  };

  await cacheSet(cacheKey, JSON.stringify(data), 3600); // 1-hour TTL
  return data;
}

/**
 * Returns or dynamically initializes a running grammY Bot instance for the tenant.
 */
export async function getOrInitBot(tenantId: string): Promise<{
  bot: Bot<BotContext>;
  botToken: string;
  webhookSecret: string;
  isActive: boolean;
  tenantActive: boolean;
  botActive: boolean;
  subscriptionStatus: string;
  tenant: TenantInfo;
} | null> {
  const data = await getTenantBotData(tenantId);
  if (!data) return null;

  const decryptedToken = decryptBotToken(data.encryptedToken);

  const existing = botInstances.get(tenantId);
  if (existing && existing.token === decryptedToken) {
    await ensureBotInitialized(existing.bot, decryptedToken, data.botUsername, data.tenant.name);
    return {
      bot: existing.bot,
      botToken: decryptedToken,
      webhookSecret: data.webhookSecret,
      isActive: data.isActive,
      tenantActive: data.tenantActive,
      botActive: data.botActive,
      subscriptionStatus: data.subscriptionStatus,
      tenant: data.tenant,
    };
  }

  const bot = createTenantBot({
    tenant: data.tenant,
    botToken: decryptedToken,
    redisUrl: getEnv().REDIS_URL,
  });

  bot.catch((err) => {
    console.error(`[BotManager Error - Tenant ${tenantId}]:`, err?.error || err);
  });

  await ensureBotInitialized(bot, decryptedToken, data.botUsername, data.tenant.name);

  botInstances.set(tenantId, { bot, token: decryptedToken });

  return {
    bot,
    botToken: decryptedToken,
    webhookSecret: data.webhookSecret,
    isActive: data.isActive,
    tenantActive: data.tenantActive,
    botActive: data.botActive,
    subscriptionStatus: data.subscriptionStatus,
    tenant: data.tenant,
  };
}

/**
 * Invalidates cached bot instances and configuration upon merchant update.
 */
export async function invalidateTenantBot(tenantId: string): Promise<void> {
  const existing = botInstances.get(tenantId);
  if (existing) {
    botInfoCache.delete(existing.token);
  }
  botInstances.delete(tenantId);
  await cacheDel(`tenant:bot:${tenantId}`);
}
