import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  encryptBotToken,
  decryptBotToken,
  validateTelegramInitData,
  generateWebhookSecret,
  createBindToken,
  verifyBindToken,
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

      const tampered = rawInitData.replace('Original', 'Hacker');
      const result = validateTelegramInitData(tampered, testBotToken);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid HMAC signature');
    });

    it('should reject expired initData (> 24 hours old)', () => {
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

  describe('Signed Deep-Link Bind Tokens (createBindToken / verifyBindToken)', () => {
    const bindSecret = 'super-secret-jwt-key-123456';
    const tenantUuid = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';

    it('should generate a deterministic <=55 char bind_<32hex>_<16sig> token and verify back to UUID', () => {
      const token = createBindToken(tenantUuid, bindSecret);
      expect(token).toMatch(/^bind_[0-9a-f]{32}_[0-9a-f]{16}$/);
      expect(Buffer.byteLength(token, 'utf8')).toBeLessThanOrEqual(55);

      const verified = verifyBindToken(token, bindSecret);
      expect(verified.valid).toBe(true);
      expect(verified.tenantId).toBe(tenantUuid);

      // Should also accept raw suffix without bind_ prefix
      const rawVerified = verifyBindToken(token.slice(5), bindSecret);
      expect(rawVerified.valid).toBe(true);
      expect(rawVerified.tenantId).toBe(tenantUuid);
    });

    it('should reject tampered signature, wrong secret, or malformed tokens', () => {
      const token = createBindToken(tenantUuid, bindSecret);
      const lastChar = token.endsWith('0') ? '1' : '0';
      const tampered = `${token.slice(0, -1)}${lastChar}`;

      expect(verifyBindToken(tampered, bindSecret).valid).toBe(false);
      expect(verifyBindToken(token, 'wrong-secret-000000').valid).toBe(false);
      expect(verifyBindToken('bind_notauuid_1234', bindSecret).valid).toBe(false);
      expect(verifyBindToken('', bindSecret).valid).toBe(false);
      expect(() => createBindToken('not-a-uuid', bindSecret)).toThrow();
    });
  });
});
