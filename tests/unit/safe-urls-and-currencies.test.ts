import { describe, it, expect } from 'vitest';
import { isSafeTelegramUrl, isHttpsUrl } from '@telegram-commerce/config';
import { formatCurrency } from '@telegram-commerce/i18n';

describe('Telegram URL Safety & Currency Formatting', () => {
  describe('isSafeTelegramUrl', () => {
    it('should allow valid public HTTPS and HTTP URLs', () => {
      expect(isSafeTelegramUrl('https://example.com')).toBe(true);
      expect(isSafeTelegramUrl('https://my-store.uz/miniapp')).toBe(true);
      expect(isSafeTelegramUrl('http://185.217.131.26/shop')).toBe(true);
      expect(isSafeTelegramUrl('https://t.me/miraiedu_bot')).toBe(true);
    });

    it('should reject localhost and 127.0.0.1 URLs (preventing Telegram API 400 Bad Request)', () => {
      expect(isSafeTelegramUrl('http://localhost:3000')).toBe(false);
      expect(isSafeTelegramUrl('http://localhost:5173?tenant_id=demo')).toBe(false);
      expect(isSafeTelegramUrl('http://127.0.0.1:8080')).toBe(false);
      expect(isSafeTelegramUrl('https://localhost:443')).toBe(false);
    });

    it('should reject invalid, malformed, or empty URLs', () => {
      expect(isSafeTelegramUrl('')).toBe(false);
      expect(isSafeTelegramUrl(undefined)).toBe(false);
      expect(isSafeTelegramUrl('ftp://example.com')).toBe(false);
      expect(isSafeTelegramUrl('not_a_url')).toBe(false);
    });
  });

  describe('isHttpsUrl', () => {
    it('should only return true for https URLs', () => {
      expect(isHttpsUrl('https://example.com')).toBe(true);
      expect(isHttpsUrl('https://telegram.org')).toBe(true);
      expect(isHttpsUrl('http://example.com')).toBe(false);
      expect(isHttpsUrl('')).toBe(false);
      expect(isHttpsUrl(undefined)).toBe(false);
    });
  });

  describe('Multi-currency formatting', () => {
    it('should correctly format USD with prefix', () => {
      expect(formatCurrency(49.99, 'USD')).toBe('$49.99');
      expect(formatCurrency(1200, 'USD')).toBe('$1,200.00');
    });

    it('should correctly format EUR with suffix', () => {
      expect(formatCurrency(89.5, 'EUR')).toBe('89,50 €');
    });

    it('should correctly format GBP with prefix', () => {
      expect(formatCurrency(75, 'GBP')).toBe('£75.00');
    });

    it('should correctly format UZS without decimals and with suffix', () => {
      expect(formatCurrency(150000, 'UZS')).toBe("150 000 so'm");
    });

    it('should correctly format RUB with suffix', () => {
      expect(formatCurrency(4500, 'RUB')).toBe('4 500,00 ₽');
    });
  });
});
