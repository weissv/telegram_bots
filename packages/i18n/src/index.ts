import { ru } from './locales/ru.js';
import { uz } from './locales/uz.js';

// ─── Types ───

export type Locale = 'ru' | 'uz';

export type TranslationKey = keyof typeof ru;

export type TranslationDictionary = Record<string, string>;

// ─── Constants ───

export const SUPPORTED_LOCALES: Locale[] = ['ru', 'uz'];
export const DEFAULT_LOCALE: Locale = 'ru';

const dictionaries: Record<Locale, TranslationDictionary> = { ru, uz };

// ─── Core Translation Function ───

/**
 * Translates a key into the specified locale with optional parameter interpolation.
 *
 * @example
 * t('ru', 'start.welcome', { storeName: 'My Shop' })
 * // => '🛍️ <b>Добро пожаловать в My Shop!</b>'
 */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const dict = dictionaries[locale] || dictionaries[DEFAULT_LOCALE];
  let text = dict[key] || dictionaries[DEFAULT_LOCALE][key] || key;

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }
  }

  return text;
}

// ─── Locale Detection ───

/**
 * Maps a Telegram `language_code` (e.g. 'ru', 'uz', 'en') to a supported locale.
 * Defaults to 'ru' for unsupported codes.
 */
export function detectLocale(languageCode?: string): Locale {
  if (!languageCode) return DEFAULT_LOCALE;
  const lower = languageCode.toLowerCase();
  if (lower === 'uz' || lower.startsWith('uz')) return 'uz';
  return 'ru'; // Default to Russian for ru, en, and all others
}

// ─── Currency Formatting ───

const currencyConfig: Record<string, { symbol: string; position: 'prefix' | 'suffix'; decimals: number; groupSep: string; decSep: string }> = {
  USD: { symbol: '$', position: 'prefix', decimals: 2, groupSep: ',', decSep: '.' },
  RUB: { symbol: '₽', position: 'suffix', decimals: 2, groupSep: ' ', decSep: ',' },
  UZS: { symbol: "so'm", position: 'suffix', decimals: 0, groupSep: ' ', decSep: ',' },
};

/**
 * Formats a numeric amount into a locale-aware currency string.
 *
 * @example
 * formatCurrency(12500, 'UZS', 'uz') // => "12 500 so'm"
 * formatCurrency(49.99, 'USD', 'ru') // => '$49.99'
 * formatCurrency(1500, 'RUB', 'ru')  // => '1 500 ₽'
 */
export function formatCurrency(amount: number, currency: string, _locale?: Locale): string {
  const config = currencyConfig[currency.toUpperCase()] || currencyConfig.USD;

  const fixed = amount.toFixed(config.decimals);
  const [intPart, decPart] = fixed.split('.');

  // Group digits with separator
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.groupSep);

  const formattedNumber = decPart ? `${grouped}${config.decSep}${decPart}` : grouped;

  if (config.position === 'prefix') {
    return `${config.symbol}${formattedNumber}`;
  }
  return `${formattedNumber} ${config.symbol}`;
}

// ─── Re-exports ───
export { ru } from './locales/ru.js';
export { uz } from './locales/uz.js';
