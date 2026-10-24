import React from 'react';
import { Search, Globe, X, User } from 'lucide-react';
import { StoreTheme } from '../types/index.js';
import type { Locale } from '@telegram-commerce/i18n';
import { useI18n } from '../i18n/useI18n.js';

interface HeaderProps {
  theme: StoreTheme;
  cartCount: number;
  onOpenCart: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  telegramUser?: any;
}

export function Header({
  theme,
  cartCount,
  onOpenCart,
  searchQuery,
  onSearchChange,
  locale,
  onLocaleChange,
  telegramUser,
}: HeaderProps) {
  const { t } = useI18n();

  const toggleLocale = () => {
    if (locale === 'ru') onLocaleChange('en');
    else if (locale === 'en') onLocaleChange('uz');
    else onLocaleChange('ru');
  };

  return (
    <header className="sticky top-0 z-20 bg-[var(--c-bg)] border-b border-[var(--c-separator)] px-4 pt-3 pb-3 transition-colors">
      {/* Top row: Brand & Language */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {theme.logoUrl ? (
            <img
              src={theme.logoUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-[var(--c-separator)] shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--c-brand)] text-[var(--c-brand-text)] flex items-center justify-center font-bold text-xs shrink-0">
              {(theme.storeName || 'S')[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-[var(--c-text)] truncate leading-tight">
              {theme.storeName || 'Каталог товаров'}
            </h1>
            {telegramUser && (
              <p className="text-[11px] text-[var(--c-hint)] truncate">
                {telegramUser.first_name}
                {telegramUser.username ? ` (@${telegramUser.username})` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <button
            type="button"
            onClick={toggleLocale}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[var(--c-secondary)] text-[var(--c-text)] text-xs font-medium"
            aria-label="Сменить язык"
          >
            <Globe className="w-3 h-3 text-[var(--c-hint)]" />
            <span>{locale.toUpperCase()}</span>
          </button>
        </div>
      </div>

      {/* Native-style Telegram Search */}
      <div className="mt-2.5">
        <div className="search">
          <Search className="w-4 h-4 text-[var(--c-hint)] shrink-0" />
          <input
            type="text"
            placeholder={t('miniapp.search_placeholder') || 'Поиск товаров...'}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="p-1 text-[var(--c-hint)] hover:text-[var(--c-text)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
