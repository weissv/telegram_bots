export const PLAN_TIERS = {
  BASIC_20: 'BASIC_20',
  PRO_30: 'PRO_30',
  STANDALONE_LIFETIME: 'STANDALONE_LIFETIME',
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

export const PLAN_PRICING = {
  [PLAN_TIERS.BASIC_20]: {
    name: 'Basic Inline Bot',
    price: 20,
    interval: 'month',
    hasMiniApp: false,
    hasInlineCatalog: true,
    hasCart: true,
    hasOrderTracking: true,
    hasAdminNotifications: true,
  },
  [PLAN_TIERS.PRO_30]: {
    name: 'Pro Mini App Storefront',
    price: 30,
    interval: 'month',
    hasMiniApp: true,
    hasInlineCatalog: true,
    hasCart: true,
    hasOrderTracking: true,
    hasAdminNotifications: true,
  },
  [PLAN_TIERS.STANDALONE_LIFETIME]: {
    name: 'Standalone Self-Hosted Lifetime',
    price: 350,
    interval: 'lifetime',
    hasMiniApp: true,
    hasInlineCatalog: true,
    hasCart: true,
    hasOrderTracking: true,
    hasAdminNotifications: true,
  },
} as const;

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;

export const PAYMENT_METHODS = {
  PAYNET_XOLIS: 'PAYNET_XOLIS',
  TELEGRAM_STARS: 'TELEGRAM_STARS',
  STRIPE: 'STRIPE',
  MOCK: 'MOCK',
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const DEFAULT_PAYNET_QR_URL =
  'https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r2s8nPSzGNGRQjdxV0202115204531153038605802UZ5910AO\'PAYNET\'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63043D65';

export const DEFAULT_THEME_CONFIG = {
  primaryColor: '#0ea5e9', // Sky blue default
  accentColor: '#38bdf8',
  backgroundColor: '#0f172a',
  textColor: '#f8fafc',
  storeName: 'Telegram Storefront',
  bannerUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80',
  logoUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80',
  description: 'Welcome to our premium Telegram storefront. Instant checkout & seamless shopping.',
  currency: 'USD',
  currencySymbol: '$',
  paynetEnabled: true,
  paynetQrUrl: DEFAULT_PAYNET_QR_URL,
};

export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 3;
export const CACHE_TTL_SECONDS = 3600; // 1 hour for bot configuration
export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 86400; // 24 hours
