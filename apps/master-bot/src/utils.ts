import { type Context } from 'grammy';
import { DEFAULT_PAYNET_QR_URL, PLAN_PRICING, PLAN_TIERS, type PlanTier } from '@telegram-commerce/config';

export type BotLang = 'ru' | 'uz' | 'en';

export function resolveLang(ctx: Context): BotLang {
  const raw = (ctx as any).session?.lang;
  if (raw === 'uz' || raw === 'en') {
    return raw;
  }
  return 'ru';
}

export function escapeHtml(value: string): string {
  return value
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

export function getPeriodEndForPlan(plan: PlanTier): Date {
  if (plan === PLAN_TIERS.STANDALONE_LIFETIME) {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 100);
    return end;
  }
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export function buildPaynetQrImageUrl(paynetUrl: string = DEFAULT_PAYNET_QR_URL): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(paynetUrl)}`;
}

/**
 * Telegram enforces a strict 64-byte limit on callback_data.
 * For UUID tenant IDs with STANDALONE_LIFETIME, strip hyphens (exact 64 bytes) and restore on parse.
 */
export function buildSubConfirmCallback(tenantId: string, plan: string): string {
  const full = `sub:confirm:${tenantId}:${plan}`;
  if (Buffer.byteLength(full, 'utf8') <= 64) {
    return full;
  }
  const compactTenantId = tenantId.replace(/-/g, '');
  const compact = `sub:confirm:${compactTenantId}:${plan}`;
  if (Buffer.byteLength(compact, 'utf8') <= 64) {
    return compact;
  }
  const shortPlan = plan === PLAN_TIERS.STANDALONE_LIFETIME ? 'STANDALONE' : plan;
  return `sub:confirm:${compactTenantId}:${shortPlan}`.slice(0, 64);
}

export function restoreUuid(rawId: string): string {
  if (/^[0-9a-f]{32}$/i.test(rawId)) {
    return `${rawId.slice(0, 8)}-${rawId.slice(8, 12)}-${rawId.slice(12, 16)}-${rawId.slice(16, 20)}-${rawId.slice(20)}`;
  }
  return rawId;
}

export function buildAdminSubApproveCallback(tenantId: string, plan: string): string {
  const compactId = tenantId.replace(/-/g, '');
  const shortPlan = plan === PLAN_TIERS.STANDALONE_LIFETIME ? 'STANDALONE' : plan;
  return `admin:sub:approve:${compactId}:${shortPlan}`;
}

export function buildAdminSubSuspendCallback(tenantId: string): string {
  return `admin:sub:suspend:${tenantId.replace(/-/g, '')}`;
}

export function parseAdminSubCallback(rawTenantId: string, rawPlan?: string): {
  tenantId: string;
  plan: PlanTier;
} {
  return {
    tenantId: restoreUuid(rawTenantId),
    plan: normalizePlanTier(rawPlan),
  };
}

export function parseSubConfirmCallback(rawTenantId: string, rawPlan: string): {
  tenantId: string;
  plan: PlanTier;
} {
  const tenantId = rawTenantId !== 'platform' ? restoreUuid(rawTenantId) : rawTenantId;

  return {
    tenantId,
    plan: normalizePlanTier(rawPlan),
  };
}
