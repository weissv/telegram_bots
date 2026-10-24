import React from 'react';
import { ShoppingBag, Search, Globe, X, User } from 'lucide-react';
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
    onLocaleChange(locale === 'ru' ? 'uz' : 'ru');
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      {/* Top row: Brand & Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {theme.logoUrl ? (
            <img
              src={theme.logoUrl}
              alt="Logo"
              className="w-9 h-9 rounded-xl object-cover border border-slate-700 shadow shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center font-extrabold text-white text-sm shadow shrink-0">
              {(theme.storeName || 'S')[0]}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold text-slate-100 truncate tracking-tight">
              {theme.storeName || 'Telegram Store'}
            </h1>
            {telegramUser && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                <User className="w-3 h-3 text-sky-400 shrink-0" />
                {telegramUser.first_name}
                {telegramUser.username ? ` (@${telegramUser.username})` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/60 text-xs font-semibold transition-all active:scale-95"
            aria-label="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>{locale === 'ru' ? 'RU' : 'UZ'}</span>
          </button>

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            className="relative p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700/60 shadow transition-all active:scale-95"
            aria-label="View Shopping Cart"
          >
            <ShoppingBag className="w-5 h-5 text-sky-400" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-sky-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mt-3 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={t('miniapp.search_placeholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-10 pl-9 pr-8 rounded-xl bg-slate-800/80 border border-slate-700/60 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
}
