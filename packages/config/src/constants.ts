export const PLAN_TIERS = {
  BASIC_20: 'BASIC_20',
  PRO_30: 'PRO_30',
  STANDALONE_LIFETIME: 'STANDALONE_LIFETIME',
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

export const SELF_SERVE_PLANS = [PLAN_TIERS.BASIC_20, PLAN_TIERS.PRO_30] as const;
export type SelfServePlanTier = (typeof SELF_SERVE_PLANS)[number];

export const PLAN_PRICING = {
  [PLAN_TIERS.BASIC_20]: {
    name: 'Basic Inline Bot',
    price: 20,
    priceUzs: 255000,
    interval: 'month',
    selfServe: true,
    hasMiniApp: false,
    hasInlineCatalog: true,
    hasCart: true,
    hasOrderTracking: true,
    hasAdminNotifications: true,
  },
  [PLAN_TIERS.PRO_30]: {
    name: 'Pro Mini App Storefront',
    price: 30,
    priceUzs: 385000,
    interval: 'month',
    selfServe: true,
    hasMiniApp: true,
    hasInlineCatalog: true,
    hasCart: true,
    hasOrderTracking: true,
    hasAdminNotifications: true,
  },
  [PLAN_TIERS.STANDALONE_LIFETIME]: {
    name: 'Standalone Self-Hosted Lifetime',
    price: 350,
    priceUzs: 4500000,
    interval: 'lifetime',
    selfServe: false,
    hasMiniApp: true,
    hasInlineCatalog: true,
    hasCart: true,
    hasOrderTracking: true,
    hasAdminNotifications: true,
  },
} as const;

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PAYMENT_REVIEW: 'PAYMENT_REVIEW',
  PAID: 'PAID',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;

export const SUBSCRIPTION_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
  TRIALING: 'TRIALING',
} as const;

export type SubscriptionStatus = keyof typeof SUBSCRIPTION_STATUS;

export const PAYMENT_METHODS = {
  PAYNET_XOLIS: 'PAYNET_XOLIS',
  TELEGRAM_STARS: 'TELEGRAM_STARS',
  STRIPE: 'STRIPE',
  MOCK: 'MOCK',
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

/**
 * Platform Paynet QR-Online URL (FOR PLATFORM SAAS SUBSCRIPTIONS ONLY — NEVER for merchant storefront fallback).
 */
export const PLATFORM_PAYNET_QR_URL =
  "https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r2s8nPSzGNGRQjdxV0202115204531153038605802UZ5910AO'PAYNET'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63043D65";

/**
 * @deprecated Use PLATFORM_PAYNET_QR_URL for SaaS platform billing only. NEVER return or use for merchant storefronts.
 */
export const DEFAULT_PAYNET_QR_URL = PLATFORM_PAYNET_QR_URL;

/**
 * Validates that a URL is a legitimate Paynet QR-Online HTTPS link (`https://app.paynet.uz/qr-online/...`).
 */
export function isValidPaynetQrUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname.toLowerCase() !== 'app.paynet.uz') return false;
    return parsed.pathname.startsWith('/qr-online/') && parsed.pathname.length > '/qr-online/'.length + 4;
  } catch {
    return false;
  }
}

export const DEFAULT_THEME_CONFIG = {
  primaryColor: '#0ea5e9', // Sky blue default
  accentColor: '#38bdf8',
  backgroundColor: '#0f172a',
  textColor: '#f8fafc',
  layoutStyle: 'grid',
  showHeroBanner: true,
  bannerTitle: '',
  storeName: 'Telegram Storefront',
  bannerUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80',
  logoUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80',
  description: 'Welcome to our premium Telegram storefront. Instant checkout & seamless shopping.',
  currency: 'UZS',
  currencySymbol: "so'm",
  paynetEnabled: false,
  paynetQrUrl: '',
  deliveryFeeUzs: 25000,
  freeDeliveryThresholdUzs: 300000,
  deliveryTerms: 'Доставка по Ташкенту 1–2 дня, по Узбекистану 2–5 дней.',
  legalName: '',
  innOrPinfl: '',
  supportContact: '',
  returnPolicy: 'Возврат и обмен товара надлежащего качества в течение 10 дней согласно Закону РУз о защите прав потребителей.',
  privacyPolicyUrl: '/#legal',
};

export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 3;
export const CACHE_TTL_SECONDS = 3600; // 1 hour for bot configuration
export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 86400; // 24 hours
