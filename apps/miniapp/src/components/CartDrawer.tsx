import React from 'react';
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag, Sparkles } from 'lucide-react';
import { CartItem } from '../types/index.js';
import { useI18n } from '../i18n/useI18n.js';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currency: string;
  totalAmount: number;
  onUpdateQty: (productId: string, qty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onProceedCheckout: () => void;
  onHaptic: (type: 'light' | 'medium') => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  currency,
  totalAmount,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onProceedCheckout,
  onHaptic,
}: CartDrawerProps) {
  const { t, formatCurrency } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-h-[85vh] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle */}
        <div className="w-full pt-3 pb-1 flex justify-center">
          <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100">Корзина</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-xs font-semibold">
              {items.length} поз.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={() => {
                  onHaptic('medium');
                  onClearCart();
                }}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                title="Очистить корзину"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {items.length === 0 ? (
            <div className="text-center py-14 space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-slate-200">Ваша корзина пуста</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Выберите понравившиеся товары в каталоге, чтобы оформить заказ.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
              >
                Перейти в каталог
              </button>
            </div>
          ) : (
            items.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-800/60 border border-slate-750"
              >
                <img
                  src={
                    product.images?.[0] ||
                    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80'
                  }
                  alt={product.title}
                  className="w-16 h-16 rounded-xl object-cover bg-slate-700 shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-100 truncate">
                    {product.title}
                  </h4>
                  <p className="text-xs font-bold text-sky-400 mt-0.5">
                    {formatCurrency(Number(product.price), currency)}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => {
                        onHaptic('light');
                        onUpdateQty(product.id, quantity - 1);
                      }}
                      className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-200 active:scale-90 transition-transform"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-slate-100 min-w-4 text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => {
                        onHaptic('light');
                        onUpdateQty(product.id, quantity + 1);
                      }}
                      disabled={quantity >= product.stock}
                      className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 flex items-center justify-center text-slate-200 active:scale-90 transition-transform"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between h-16">
                  <button
                    onClick={() => {
                      onHaptic('medium');
                      onRemoveItem(product.id);
                    }}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-100">
                    {formatCurrency(Number(product.price) * quantity, currency)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/95 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Сумма заказа:</span>
              <span className="text-xl font-extrabold text-slate-100">
                {formatCurrency(totalAmount, currency)}
              </span>
            </div>

            <button
              onClick={() => {
                onHaptic('medium');
                onProceedCheckout();
              }}
              className="w-full h-12 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
            >
              <span>Перейти к оформлению</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
