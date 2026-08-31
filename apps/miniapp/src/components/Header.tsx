import React from 'react';
import { ShoppingBag, Search } from 'lucide-react';
import { StoreTheme } from '../types/index.js';

interface HeaderProps {
  theme: StoreTheme;
  cartCount: number;
  onOpenCart: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({
  theme,
  cartCount,
  onOpenCart,
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {theme.logoUrl ? (
            <img
              src={theme.logoUrl}
              alt="Logo"
              className="w-8 h-8 rounded-full object-cover border border-slate-700 shadow"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center font-bold text-white text-sm shadow">
              {(theme.storeName || 'S')[0]}
            </div>
          )}
          <h1 className="text-base font-bold text-slate-100 truncate tracking-tight">
            {theme.storeName || 'Telegram Store'}
          </h1>
        </div>

        <button
          onClick={onOpenCart}
          className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700/60 shadow transition-all active:scale-95"
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

      <div className="mt-3 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search products, styles, collections..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
        />
      </div>
    </header>
  );
}
