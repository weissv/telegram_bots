import crypto from 'node:crypto';
import { TELEGRAM_AUTH_MAX_AGE_SECONDS } from './constants.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a bot token using AES-256-GCM.
 * Output format: iv:authTag:encryptedHex
 */
export function encryptBotToken(token: string, keyHex?: string): string {
  const key = Buffer.from(keyHex || process.env.ENCRYPTION_KEY || '', 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte (64 character) hex string');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted bot token.
 */
export function decryptBotToken(encryptedData: string, keyHex?: string): string {
  const key = Buffer.from(keyHex || process.env.ENCRYPTION_KEY || '', 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte (64 character) hex string');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token payload format');
  }

  const [ivHex, authTagHex, encryptedText] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid IV or AuthTag length in encrypted payload');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a cryptographically secure webhook secret token.
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramInitDataValidationResult {
  isValid: boolean;
  user?: TelegramUser;
  authDate?: Date;
  error?: string;
}

/**
 * Validates Telegram Mini App initData string according to Telegram specification:
 * 1. Parse query string
 * 2. Extract hash
 * 3. Sort remaining key-value pairs alphabetically and format as key=value\n
 * 4. Compute secret_key = HMAC_SHA256("WebAppData", botToken)
 * 5. Compute calculated_hash = HMAC_SHA256(data_check_string, secret_key)
 * 6. Compare hashes in constant time and verify auth_date freshness.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = TELEGRAM_AUTH_MAX_AGE_SECONDS
): TelegramInitDataValidationResult {
  try {
    if (!initData || !botToken) {
      return { isValid: false, error: 'Missing initData or botToken' };
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');

    if (!hash) {
      return { isValid: false, error: 'Missing hash in initData' };
    }

    urlParams.delete('hash');

    const params: Array<[string, string]> = [];
    urlParams.forEach((val, key) => {
      params.push([key, val]);
    });

    params.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = params.map(([key, val]) => `${key}=${val}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const hashBuffer = Buffer.from(hash, 'hex');
    const calculatedHashBuffer = Buffer.from(calculatedHash, 'hex');

    if (hashBuffer.length !== calculatedHashBuffer.length || !crypto.timingSafeEqual(hashBuffer, calculatedHashBuffer)) {
      return { isValid: false, error: 'Invalid HMAC signature' };
    }

    const authDateStr = urlParams.get('auth_date');
    if (!authDateStr) {
      return { isValid: false, error: 'Missing auth_date' };
    }

    const authDateTimestamp = Number.parseInt(authDateStr, 10);
    if (Number.isNaN(authDateTimestamp)) {
      return { isValid: false, error: 'Invalid auth_date format' };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds - authDateTimestamp > maxAgeSeconds) {
      return { isValid: false, error: 'initData signature has expired (>24h)' };
    }

    let user: TelegramUser | undefined;
    const userStr = urlParams.get('user');
    if (userStr) {
      try {
        user = JSON.parse(userStr) as TelegramUser;
      } catch {
        // user parsing error
      }
    }

    return {
      isValid: true,
      user,
      authDate: new Date(authDateTimestamp * 1000),
    };
  } catch (err: any) {
    return { isValid: false, error: err?.message || 'Verification exception' };
  }
}
