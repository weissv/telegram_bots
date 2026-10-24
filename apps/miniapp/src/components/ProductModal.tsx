import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, ShoppingBag, ShieldCheck, Sparkles } from 'lucide-react';
import { Product } from '../types/index.js';
import { useI18n } from '../i18n/useI18n.js';

interface ProductModalProps {
  product: Product | null;
  currency: string;
  inCartQty: number;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onHaptic: (type: 'light' | 'medium') => void;
}

export function ProductModal({
  product,
  currency,
  inCartQty,
  isOpen,
  onClose,
  onAddToCart,
  onHaptic,
}: ProductModalProps) {
  const { t, formatCurrency } = useI18n();
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setQty(1);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const isOutOfStock = product.stock <= 0;
  const image =
    product.images?.[0] ||
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80';
  const unitPrice = Number(product.price);
  const totalPrice = unitPrice * qty;

  const handleIncrement = () => {
    if (qty < product.stock) {
      onHaptic('light');
      setQty((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (qty > 1) {
      onHaptic('light');
      setQty((prev) => prev - 1);
    }
  };

  const handleAdd = () => {
    onHaptic('medium');
    onAddToCart(product, qty);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-h-[90vh] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle & Close button */}
        <div className="relative w-full pt-3 pb-2 flex items-center justify-center">
          <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
          <button
            onClick={onClose}
            className="absolute right-4 top-3 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
          {/* Main Product Image */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-800 border border-slate-750 shadow-inner">
            <img
              src={image}
              alt={product.title}
              className="w-full h-full object-cover"
            />
            {isOutOfStock ? (
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-rose-500/95 text-white text-xs font-bold backdrop-blur shadow">
                Нет в наличии
              </span>
            ) : product.stock <= 5 ? (
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-amber-500/95 text-slate-950 text-xs font-bold backdrop-blur shadow">
                Осталось всего {product.stock} шт.
              </span>
            ) : null}

            {product.category && (
              <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-slate-950/75 border border-slate-700/80 text-sky-400 text-xs font-semibold backdrop-blur">
                {product.category}
              </span>
            )}
          </div>

          {/* Title & Price */}
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-100 leading-snug">
              {product.title}
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-sky-400">
                {formatCurrency(unitPrice, currency)}
              </span>
              <span className="text-xs text-slate-400">за единицу</span>
            </div>
          </div>

          {/* Guarantee Badges */}
          <div className="grid grid-cols-2 gap-2.5 py-2">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/50 border border-slate-750/60">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Гарантия качества</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/50 border border-slate-750/60">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Мгновенный чек в чат</span>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Описание товара
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/70 border border-slate-750">
              <span className="text-sm font-semibold text-slate-200">Количество:</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDecrement}
                  disabled={qty <= 1}
                  className="w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-30 flex items-center justify-center text-slate-100 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-base font-bold text-slate-100 min-w-6 text-center">
                  {qty}
                </span>
                <button
                  onClick={handleIncrement}
                  disabled={qty >= product.stock}
                  className="w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-30 flex items-center justify-center text-slate-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 space-y-2">
          <button
            onClick={handleAdd}
            disabled={isOutOfStock}
            className="w-full h-12 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>
              {isOutOfStock
                ? 'Нет в наличии'
                : `Добавить в корзину • ${formatCurrency(totalPrice, currency)}`}
            </span>
          </button>
          {inCartQty > 0 && (
            <p className="text-center text-xs text-emerald-400 font-medium">
              ✓ Уже в корзине: {inCartQty} шт.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
