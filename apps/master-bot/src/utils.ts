import crypto from 'node:crypto';
import { type Context } from 'grammy';
import {
  getEnv,
  PLATFORM_PAYNET_QR_URL,
  PLAN_PRICING,
  PLAN_TIERS,
  type PlanTier,
} from '@telegram-commerce/config';

export type BotLang = 'ru' | 'uz' | 'en';

export function resolveLang(ctx: Context): BotLang {
  const raw = (ctx as any).session?.lang;
  if (raw === 'uz' || raw === 'en') {
    return raw;
  }
  return 'ru';
}

export function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatUzs(amount: number, lang: BotLang = 'ru'): string {
  const formatted = new Intl.NumberFormat('ru-RU').format(Math.round(amount));
  if (lang === 'uz') return `${formatted} so'm`;
  if (lang === 'en') return `${formatted} UZS`;
  return `${formatted} сум`;
}

export function getSuperAdminTelegramId(): string {
  const env = getEnv();
  return env.SUPERADMIN_TELEGRAM_ID || env.STANDALONE_ADMIN_TELEGRAM_ID || '8240936731';
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const rand = crypto.randomInt(1000, 9999);
  return `INV-${y}${m}${d}-${rand}`;
}

export function generateStrongPassword(): string {
  return `Mr${crypto.randomBytes(6).toString('base64url')}!9`;
}

export function computeAdditivePeriodEnd(existingEnd?: Date | null): Date {
  const baseMs = Math.max(Date.now(), existingEnd ? new Date(existingEnd).getTime() : 0);
  return new Date(baseMs + 30 * 24 * 60 * 60 * 1000);
}

export interface PlanDetails {
  tier: PlanTier;
  priceUsd: number;
  priceUzs: number;
  priceUzsFormatted: string;
  labels: Record<BotLang, string>;
  periodLabels: Record<BotLang, string>;
}

const PLAN_COPY: Record<
  PlanTier,
  { labels: Record<BotLang, string>; periodLabels: Record<BotLang, string> }
> = {
  [PLAN_TIERS.BASIC_20]: {
    labels: {
      ru: 'Базовый чат-бот',
      uz: 'Bazaviy chat-bot',
      en: 'Basic Inline Bot',
    },
    periodLabels: {
      ru: 'мес',
      uz: 'oy',
      en: 'mo',
    },
  },
  [PLAN_TIERS.PRO_30]: {
    labels: {
      ru: 'Pro Mini App витрина',
      uz: 'Pro Mini App vitrina',
      en: 'Pro Mini App Storefront',
    },
    periodLabels: {
      ru: 'мес',
      uz: 'oy',
      en: 'mo',
    },
  },
  [PLAN_TIERS.STANDALONE_LIFETIME]: {
    labels: {
      ru: 'Standalone VPS Lifetime',
      uz: 'Standalone VPS Lifetime',
      en: 'Standalone VPS Lifetime',
    },
    periodLabels: {
      ru: 'разово',
      uz: 'bir martalik',
      en: 'lifetime',
    },
  },
};

export function normalizePlanTier(raw?: string): PlanTier {
  if (raw === PLAN_TIERS.BASIC_20) return PLAN_TIERS.BASIC_20;
  if (raw === PLAN_TIERS.STANDALONE_LIFETIME || raw === 'STANDALONE') {
    return PLAN_TIERS.STANDALONE_LIFETIME;
  }
  return PLAN_TIERS.PRO_30;
}

export function getPlanDetails(plan: PlanTier): PlanDetails {
  const tier = normalizePlanTier(plan);
  const pricingEntry = PLAN_PRICING[tier];
  const copy = PLAN_COPY[tier];

  return {
    tier,
    priceUsd: pricingEntry.price,
    priceUzs: pricingEntry.priceUzs,
    priceUzsFormatted: formatUzs(pricingEntry.priceUzs, 'ru'),
    labels: copy.labels,
    periodLabels: copy.periodLabels,
  };
}

export function getPeriodEndForPlan(plan: PlanTier, existingEnd?: Date | null): Date {
  if (plan === PLAN_TIERS.STANDALONE_LIFETIME) {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 100);
    return end;
  }
  return computeAdditivePeriodEnd(existingEnd);
}

export function buildPaynetQrImageUrl(paynetUrl: string = PLATFORM_PAYNET_QR_URL): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(paynetUrl)}`;
}

/**
 * Telegram enforces a strict 64-byte limit on callback_data.
 * Supports either `sub:confirm:<compactSubId>` (44 bytes) OR legacy `sub:confirm:<id>:<plan>`.
 */
export function buildSubConfirmCallback(idOrTenantId: string, plan?: string): string {
  const compactId = idOrTenantId.replace(/-/g, '');
  if (!plan) {
    return `sub:confirm:${compactId}`.slice(0, 64);
  }
  const full = `sub:confirm:${idOrTenantId}:${plan}`;
  if (Buffer.byteLength(full, 'utf8') <= 64) {
    return full;
  }
  const compact = `sub:confirm:${compactId}:${plan}`;
  if (Buffer.byteLength(compact, 'utf8') <= 64) {
    return compact;
  }
  const shortPlan = plan === PLAN_TIERS.STANDALONE_LIFETIME ? 'STANDALONE' : plan;
  return `sub:confirm:${compactId}:${shortPlan}`.slice(0, 64);
}

export function restoreUuid(rawId: string): string {
  if (/^[0-9a-f]{32}$/i.test(rawId)) {
    return `${rawId.slice(0, 8)}-${rawId.slice(8, 12)}-${rawId.slice(12, 16)}-${rawId.slice(16, 20)}-${rawId.slice(20)}`;
  }
  return rawId;
}

export function buildAdminSubApproveCallback(id: string, plan?: string): string {
  const compactId = id.replace(/-/g, '');
  if (!plan) {
    return `admin:sub:approve:${compactId}`;
  }
  const shortPlan = plan === PLAN_TIERS.STANDALONE_LIFETIME ? 'STANDALONE' : plan;
  return `admin:sub:approve:${compactId}:${shortPlan}`;
}

export function buildAdminSubSuspendCallback(id: string): string {
  return `admin:sub:suspend:${id.replace(/-/g, '')}`;
}

export function parseAdminSubCallback(rawId: string, rawPlan?: string): {
  tenantId: string;
  id: string;
  plan: PlanTier;
} {
  const restored = restoreUuid(rawId);
  return {
    tenantId: restored,
    id: restored,
    plan: normalizePlanTier(rawPlan),
  };
}

export function parseSubConfirmCallback(rawId: string, rawPlan?: string): {
  tenantId: string;
  id: string;
  plan: PlanTier;
} {
  const restored = rawId !== 'platform' ? restoreUuid(rawId) : rawId;

  return {
    tenantId: restored,
    id: restored,
    plan: normalizePlanTier(rawPlan),
  };
}
