import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAYNET_QR_URL,
  PLATFORM_PAYNET_QR_URL,
  DEFAULT_THEME_CONFIG,
  ORDER_STATUS,
  SUBSCRIPTION_STATUS,
  PAYMENT_METHODS,
  PLAN_PRICING,
  PLAN_TIERS,
  SELF_SERVE_PLANS,
  isValidPaynetQrUrl,
} from '@telegram-commerce/config';
import { t, SUPPORTED_LOCALES } from '@telegram-commerce/i18n';
import { translateCategory } from '../../apps/miniapp/src/i18n/useI18n.js';

const EXACT_PAYNET_QR_URL =
  "https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r2s8nPSzGNGRQjdxV0202115204531153038605802UZ5910AO'PAYNET'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63043D65";

describe('Paynet Xolis Configuration & Standards', () => {
  it('should match the exact Central Bank / Soliq QR-online Paynet URL on PLATFORM_PAYNET_QR_URL', () => {
    expect(PLATFORM_PAYNET_QR_URL).toBe(EXACT_PAYNET_QR_URL);
    expect(DEFAULT_PAYNET_QR_URL).toBe(PLATFORM_PAYNET_QR_URL);
  });

  it('should validate merchant Paynet QR URLs strictly via isValidPaynetQrUrl', () => {
    expect(isValidPaynetQrUrl(EXACT_PAYNET_QR_URL)).toBe(true);
    expect(isValidPaynetQrUrl('https://app.paynet.uz/qr-online/00020101021199999')).toBe(true);

    expect(isValidPaynetQrUrl('')).toBe(false);
    expect(isValidPaynetQrUrl(null)).toBe(false);
    expect(isValidPaynetQrUrl(undefined)).toBe(false);
    expect(isValidPaynetQrUrl('http://app.paynet.uz/qr-online/000201010211')).toBe(false);
    expect(isValidPaynetQrUrl('https://evil.uz/qr-online/000201010211')).toBe(false);
    expect(isValidPaynetQrUrl('https://app.paynet.uz/other/000201010211')).toBe(false);
    expect(isValidPaynetQrUrl('https://app.paynet.uz/qr-online/abc')).toBe(false);
    expect(isValidPaynetQrUrl('https://app.paynet.uz/qr-online/000201 0211')).toBe(false);
  });

  it('should include PAYNET_XOLIS and Phase 3 OrderStatus / SubscriptionStatus values', () => {
    expect(PAYMENT_METHODS.PAYNET_XOLIS).toBe('PAYNET_XOLIS');
    expect(PAYMENT_METHODS.TELEGRAM_STARS).toBe('TELEGRAM_STARS');
    expect(PAYMENT_METHODS.STRIPE).toBe('STRIPE');
    expect(PAYMENT_METHODS.MOCK).toBe('MOCK');

    expect(ORDER_STATUS.PENDING).toBe('PENDING');
    expect(ORDER_STATUS.PAYMENT_REVIEW).toBe('PAYMENT_REVIEW');
    expect(ORDER_STATUS.PAID).toBe('PAID');
    expect(ORDER_STATUS.DELIVERED).toBe('DELIVERED');
    expect(ORDER_STATUS.CANCELLED).toBe('CANCELLED');
    expect(ORDER_STATUS.REFUNDED).toBe('REFUNDED');

    expect(SUBSCRIPTION_STATUS.PENDING_PAYMENT).toBe('PENDING_PAYMENT');
    expect(SUBSCRIPTION_STATUS.PENDING_REVIEW).toBe('PENDING_REVIEW');
    expect(SUBSCRIPTION_STATUS.ACTIVE).toBe('ACTIVE');
    expect(SUBSCRIPTION_STATUS.PAST_DUE).toBe('PAST_DUE');
    expect(SUBSCRIPTION_STATUS.CANCELED).toBe('CANCELED');
    expect(SUBSCRIPTION_STATUS.TRIALING).toBe('TRIALING');
  });

  it('should disable Paynet and keep paynetQrUrl empty in DEFAULT_THEME_CONFIG (never fall back to platform QR)', () => {
    expect(DEFAULT_THEME_CONFIG.currency).toBe('UZS');
    expect(DEFAULT_THEME_CONFIG.currencySymbol).toBe("so'm");
    expect(DEFAULT_THEME_CONFIG.paynetEnabled).toBe(false);
    expect(DEFAULT_THEME_CONFIG.paynetQrUrl).toBe('');
    expect(DEFAULT_THEME_CONFIG.paynetQrUrl).not.toBe(PLATFORM_PAYNET_QR_URL);
    expect(DEFAULT_THEME_CONFIG.deliveryFeeUzs).toBe(25000);
    expect(DEFAULT_THEME_CONFIG.freeDeliveryThresholdUzs).toBe(300000);
    expect(DEFAULT_THEME_CONFIG.legalName).toBe('');
    expect(DEFAULT_THEME_CONFIG.supportContact).toBe('');
    expect(DEFAULT_THEME_CONFIG.privacyPolicyUrl).toBe('/#legal');
    expect(DEFAULT_THEME_CONFIG.deliveryTerms.length).toBeGreaterThan(0);
    expect(DEFAULT_THEME_CONFIG.returnPolicy.length).toBeGreaterThan(0);
  });

  it('should mark BASIC_20 and PRO_30 as selfServe and exclude STANDALONE_LIFETIME from SELF_SERVE_PLANS', () => {
    expect(SELF_SERVE_PLANS).toEqual([PLAN_TIERS.BASIC_20, PLAN_TIERS.PRO_30]);
    expect(SELF_SERVE_PLANS).not.toContain(PLAN_TIERS.STANDALONE_LIFETIME);

    expect(PLAN_PRICING[PLAN_TIERS.BASIC_20].price).toBe(20);
    expect(PLAN_PRICING[PLAN_TIERS.BASIC_20].priceUzs).toBe(255000);
    expect(PLAN_PRICING[PLAN_TIERS.BASIC_20].selfServe).toBe(true);

    expect(PLAN_PRICING[PLAN_TIERS.PRO_30].price).toBe(30);
    expect(PLAN_PRICING[PLAN_TIERS.PRO_30].priceUzs).toBe(385000);
    expect(PLAN_PRICING[PLAN_TIERS.PRO_30].selfServe).toBe(true);

    expect(PLAN_PRICING[PLAN_TIERS.STANDALONE_LIFETIME].price).toBe(350);
    expect(PLAN_PRICING[PLAN_TIERS.STANDALONE_LIFETIME].priceUzs).toBe(4500000);
    expect(PLAN_PRICING[PLAN_TIERS.STANDALONE_LIFETIME].selfServe).toBe(false);
  });

  it('should provide Phase 3 Paynet, review, refund, delivery, and error localization keys in all 3 locales', () => {
    const requiredKeys = [
      'checkout.paynet_btn',
      'checkout.paynet_confirm_btn',
      'checkout.paynet_instructions',
      'checkout.delivery_method',
      'checkout.delivery_courier',
      'checkout.delivery_pickup',
      'checkout.items_subtotal',
      'checkout.delivery_fee',
      'checkout.free_delivery_hint',
      'checkout.phone_required',
      'checkout.address_required',
      'checkout.payment_review_notice',
      'checkout.paynet_unavailable',
      'checkout.store_not_published',
      'checkout.demo_disabled',
      'orders.status_payment_review',
      'orders.status_refunded',
      'orders.notify_payment_review',
      'orders.notify_paid',
      'orders.notify_paid_with_receipt',
      'orders.notify_delivered',
      'orders.notify_cancelled',
      'orders.notify_refunded',
      'billing.status_pending_payment',
      'billing.status_pending_review',
      'errors.unauthorized',
      'errors.payment_id_required',
      'errors.duplicate_payment_id',
    ];

    for (const locale of SUPPORTED_LOCALES) {
      for (const key of requiredKeys) {
        const value = t(locale, key, {
          orderId: 'abc12345',
          threshold: "300 000 so'm",
          receiptUrl: 'https://ofd.soliq.uz/check?t=1',
        });
        expect(value, `Missing or untranslated key ${key} for locale ${locale}`).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }

      expect(t(locale, 'orders.notify_payment_review', { orderId: 'abc12345' })).toContain('#abc12345');
      expect(t(locale, 'orders.notify_paid', { orderId: 'abc12345' })).toContain('#abc12345');
      expect(t(locale, 'orders.notify_delivered', { orderId: 'abc12345' })).toContain('#abc12345');
      expect(t(locale, 'orders.notify_cancelled', { orderId: 'abc12345' })).toContain('#abc12345');
      expect(t(locale, 'orders.notify_refunded', { orderId: 'abc12345' })).toContain('#abc12345');
    }
  });

  it('should translate Russian and English product categories and fall back cleanly for unknown categories', () => {
    expect(t('ru', 'category.одежда')).toBe('Одежда');
    expect(t('uz', 'category.одежда')).toBe('Kiyimlar');
    expect(t('en', 'category.одежда')).toBe('Apparel');

    expect(t('ru', 'category.общее')).toBe('Общее');
    expect(t('uz', 'category.общее')).toBe('Umumiy');
    expect(t('en', 'category.общее')).toBe('General');

    const enTranslate = (key: string, params?: Record<string, string | number>) => t('en', key, params);
    expect(translateCategory(enTranslate, 'All')).toBe('All Products');
    expect(translateCategory(enTranslate, 'Одежда')).toBe('Apparel');
    expect(translateCategory(enTranslate, 'Общее')).toBe('General');
    expect(translateCategory(enTranslate, 'Обувь')).toBe('Footwear');
    expect(translateCategory(enTranslate, 'Аксессуары')).toBe('Accessories');
    expect(translateCategory(enTranslate, 'Электроника')).toBe('Electronics');
    expect(translateCategory(enTranslate, 'Vintage Watches')).toBe('Vintage Watches');
    expect(translateCategory(enTranslate, '')).toBe('');
  });
});

describe('Bulk Product CSV Export & Parsing', () => {
  function parseCsvText(text: string) {
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    parseLine(headerLine);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      rows.push({
        title: cols[1]?.trim() || '',
        price: parseFloat(cols[3] || '0'),
        stock: parseInt(cols[4] || '0', 10),
      });
    }
    return rows;
  }

  it('should parse UTF-8 BOM CSV with semicolon delimiter', () => {
    const csv = '\uFEFF"ID";"Название";"Категория";"Цена";"Остаток"\r\n"";"Худи Tashkent";"Одежда";"420000";"35"';
    const parsed = parseCsvText(csv);
    expect(parsed.length).toBe(1);
    expect(parsed[0].title).toBe('Худи Tashkent');
    expect(parsed[0].price).toBe(420000);
    expect(parsed[0].stock).toBe(35);
  });

  it('should handle quotes and special characters safely', () => {
    const csv = '"ID";"Название";"Категория";"Цена";"Остаток"\r\n"";"Футболка ""Heavyweight""";"Одежда";"190000";"50"';
    const parsed = parseCsvText(csv);
    expect(parsed[0].title).toBe('Футболка "Heavyweight"');
    expect(parsed[0].price).toBe(190000);
  });
});
