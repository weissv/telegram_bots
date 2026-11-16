import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAYNET_QR_URL,
  PLATFORM_PAYNET_QR_URL,
  DEFAULT_THEME_CONFIG,
  PAYMENT_METHODS,
  PLAN_PRICING,
  PLAN_TIERS,
} from '@telegram-commerce/config';
import { t, SUPPORTED_LOCALES } from '@telegram-commerce/i18n';
import { translateCategory } from '../../apps/miniapp/src/i18n/useI18n.js';

const EXACT_PAYNET_QR_URL =
  "https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r2s8nPSzGNGRQjdxV0202115204531153038605802UZ5910AO'PAYNET'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63043D65";

describe('Paynet Xolis Configuration & Standards', () => {
  it('should match the exact Central Bank / Soliq QR-online Paynet URL on both DEFAULT and PLATFORM constants', () => {
    expect(DEFAULT_PAYNET_QR_URL).toBe(EXACT_PAYNET_QR_URL);
    expect(PLATFORM_PAYNET_QR_URL).toBe(EXACT_PAYNET_QR_URL);
    expect(PLATFORM_PAYNET_QR_URL).toBe(DEFAULT_PAYNET_QR_URL);
  });

  it('should include PAYNET_XOLIS in supported payment methods', () => {
    expect(PAYMENT_METHODS.PAYNET_XOLIS).toBe('PAYNET_XOLIS');
    expect(PAYMENT_METHODS.TELEGRAM_STARS).toBe('TELEGRAM_STARS');
    expect(PAYMENT_METHODS.STRIPE).toBe('STRIPE');
    expect(PAYMENT_METHODS.MOCK).toBe('MOCK');
  });

  it('should configure UZS and Paynet enabled by default in storefront theme configuration', () => {
    expect(DEFAULT_THEME_CONFIG.currency).toBe('UZS');
    expect(DEFAULT_THEME_CONFIG.currencySymbol).toBe("so'm");
    expect(DEFAULT_THEME_CONFIG.paynetEnabled).toBe(true);
    expect(DEFAULT_THEME_CONFIG.paynetQrUrl).toBe(EXACT_PAYNET_QR_URL);
  });

  it('should define exact USD and UZS prices for all subscription plans', () => {
    expect(PLAN_PRICING[PLAN_TIERS.BASIC_20].price).toBe(20);
    expect(PLAN_PRICING[PLAN_TIERS.BASIC_20].priceUzs).toBe(255000);

    expect(PLAN_PRICING[PLAN_TIERS.PRO_30].price).toBe(30);
    expect(PLAN_PRICING[PLAN_TIERS.PRO_30].priceUzs).toBe(385000);

    expect(PLAN_PRICING[PLAN_TIERS.STANDALONE_LIFETIME].price).toBe(350);
    expect(PLAN_PRICING[PLAN_TIERS.STANDALONE_LIFETIME].priceUzs).toBe(4500000);
  });

  it('should provide Paynet checkout and order notification localization keys in all 3 locales', () => {
    const requiredKeys = [
      'checkout.paynet_btn',
      'checkout.paynet_confirm_btn',
      'checkout.paynet_instructions',
      'orders.notify_paid',
      'orders.notify_delivered',
      'orders.notify_cancelled',
    ];

    for (const locale of SUPPORTED_LOCALES) {
      for (const key of requiredKeys) {
        const value = t(locale, key, { orderId: 'abc12345' });
        expect(value, `Missing or untranslated key ${key} for locale ${locale}`).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }

      expect(t(locale, 'orders.notify_paid', { orderId: 'abc12345' })).toContain('#abc12345');
      expect(t(locale, 'orders.notify_delivered', { orderId: 'abc12345' })).toContain('#abc12345');
      expect(t(locale, 'orders.notify_cancelled', { orderId: 'abc12345' })).toContain('#abc12345');
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

    const headers = parseLine(headerLine).map((h) => h.toLowerCase().replace(/["']/g, ''));
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
