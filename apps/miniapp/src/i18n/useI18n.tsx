import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  t as translate,
  formatCurrency as formatCurrencyFn,
  detectLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type Locale,
} from '@telegram-commerce/i18n';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatCurrency: (amount: number, currency: string) => string;
  supportedLocales: Locale[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'tc_locale';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // 1. Check localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      return stored as Locale;
    }

    // 2. Check Telegram WebApp language_code
    const tgLang = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (tgLang) {
      return detectLocale(tgLang);
    }

    return DEFAULT_LOCALE;
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );

  const formatCurrency = useCallback(
    (amount: number, currency: string) => formatCurrencyFn(amount, currency, locale),
    [locale]
  );

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
    formatCurrency,
    supportedLocales: SUPPORTED_LOCALES,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
