import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  encryptBotToken,
  decryptBotToken,
  validateTelegramInitData,
  generateWebhookSecret,
} from '@telegram-commerce/config';

describe('Cryptographic Security & Telegram HMAC Validator', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const testBotToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';

  describe('AES-256-GCM Bot Token Encryption', () => {
    it('should correctly encrypt and decrypt a bot token', () => {
      const encrypted = encryptBotToken(testBotToken, testKey);
      expect(encrypted).toContain(':');

      const parts = encrypted.split(':');
      expect(parts.length).toBe(3); // iv, authTag, ciphertext

      const decrypted = decryptBotToken(encrypted, testKey);
      expect(decrypted).toBe(testBotToken);
    });

    it('should throw error when decrypting with incorrect key or tampered data', () => {
      const wrongKey = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      const encrypted = encryptBotToken(testBotToken, testKey);

      expect(() => decryptBotToken(encrypted, wrongKey)).toThrow();

      // Tampered payload
      const parts = encrypted.split(':');
      const tampered = `${parts[0]}:${parts[1]}:bad${parts[2].slice(3)}`;
      expect(() => decryptBotToken(tampered, testKey)).toThrow();
    });

    it('should generate a 64-char hex webhook secret', () => {
      const secret = generateWebhookSecret();
      expect(secret).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Telegram WebApp initData HMAC-SHA256 Verification', () => {
    // Helper to generate valid Telegram initData signature
    function generateMockInitData(
      botToken: string,
      params: Record<string, string>,
      authDateOffsetSeconds = 0
    ): string {
      const authDate = Math.floor(Date.now() / 1000) + authDateOffsetSeconds;
      const allParams: Record<string, string> = {
        ...params,
        auth_date: String(authDate),
      };

      const sortedEntries = Object.entries(allParams).sort(([a], [b]) => a.localeCompare(b));
      const dataCheckString = sortedEntries.map(([k, v]) => `${k}=${v}`).join('\n');

      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      const searchParams = new URLSearchParams();
      sortedEntries.forEach(([k, v]) => searchParams.append(k, v));
      searchParams.append('hash', hash);

      return searchParams.toString();
    }

    it('should validate a freshly generated Telegram initData string', () => {
      const userObj = { id: 12345678, first_name: 'John', username: 'johndoe' };
      const rawInitData = generateMockInitData(testBotToken, {
        query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
        user: JSON.stringify(userObj),
      });

      const result = validateTelegramInitData(rawInitData, testBotToken);
      expect(result.isValid).toBe(true);
      expect(result.user?.id).toBe(12345678);
      expect(result.user?.username).toBe('johndoe');
    });

    it('should reject tampered initData payload', () => {
      const rawInitData = generateMockInitData(testBotToken, {
        query_id: 'test_query_id',
        user: JSON.stringify({ id: 12345678, first_name: 'Original' }),
      });

      // Tamper user name in query string without updating hash
      const tampered = rawInitData.replace('Original', 'Hacker');
      const result = validateTelegramInitData(tampered, testBotToken);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid HMAC signature');
    });

    it('should reject expired initData (> 24 hours old)', () => {
      // 25 hours in the past
      const expiredOffset = -(25 * 3600);
      const rawInitData = generateMockInitData(
        testBotToken,
        {
          user: JSON.stringify({ id: 12345678, first_name: 'John' }),
        },
        expiredOffset
      );

      const result = validateTelegramInitData(rawInitData, testBotToken);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject initData when verified against incorrect bot token', () => {
      const rawInitData = generateMockInitData(testBotToken, {
        user: JSON.stringify({ id: 12345678, first_name: 'John' }),
      });

      const wrongBotToken = '999999999:WrongTokenXYZ';
      const result = validateTelegramInitData(rawInitData, wrongBotToken);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid HMAC signature');
    });
  });
});
