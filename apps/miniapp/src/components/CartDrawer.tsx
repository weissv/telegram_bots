import React from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 transition-opacity">
      <div
        className="w-full max-h-[88vh] bg-[var(--c-bg)] border-t border-[var(--c-separator)] rounded-t-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle & Header */}
        <div className="border-b border-[var(--c-separator)]">
          <div className="w-full pt-2.5 pb-1.5 flex justify-center">
            <div className="w-10 h-1 rounded-full bg-[var(--c-hint)] opacity-40" />
          </div>
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--c-text)]">
                {t('cart.drawer_title')}
              </h2>
              {items.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--c-secondary)] text-[var(--c-hint)] text-xs font-medium">
                  {items.length} {t('cart.items_suffix')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onHaptic('medium');
                    onClearCart();
                  }}
                  className="text-xs text-[var(--c-destructive)] font-medium p-1"
                >
                  {t('cart.clear_btn')}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-[var(--c-hint)] hover:text-[var(--c-text)]"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <ShoppingBag className="w-12 h-12 text-[var(--c-hint)] mx-auto opacity-50" />
              <p className="text-base font-medium text-[var(--c-text)]">
                {t('cart.empty_title')}
              </p>
              <p className="text-sm text-[var(--c-hint)]">
                {t('cart.empty_subtitle')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--c-separator)]">
              {items.map((item) => {
                const img =
                  item.product.images?.[0] ||
                  'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=120&q=80';
                const itemTotal = Number(item.product.price) * item.quantity;

                return (
                  <div key={item.product.id} className="py-3 flex items-center gap-3">
                    <img
                      src={img}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover bg-[var(--c-secondary)] border border-[var(--c-separator)] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-[var(--c-text)] truncate">
                        {item.product.title}
                      </h3>
                      <div className="text-xs text-[var(--c-hint)] tabular mt-0.5">
                        {formatCurrency(Number(item.product.price), currency)}
                      </div>
                      <div className="text-xs font-semibold text-[var(--c-text)] tabular mt-1">
                        {t('cart.item_total')} {formatCurrency(itemTotal, currency)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="stepper !h-8 !w-24">
                        <button
                          type="button"
                          onClick={() => {
                            onHaptic('light');
                            onUpdateQty(item.product.id, item.quantity - 1);
                          }}
                          aria-label="-"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          disabled={item.quantity >= item.product.stock}
                          onClick={() => {
                            onHaptic('light');
                            onUpdateQty(item.product.id, item.quantity + 1);
                          }}
                          aria-label="+"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onHaptic('light');
                          onRemoveItem(item.product.id);
                        }}
                        className="p-1.5 text-[var(--c-hint)] hover:text-[var(--c-destructive)] transition-colors"
                        aria-label="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Total and Checkout */}
        {items.length > 0 && (
          <div
            className="p-4 border-t border-[var(--c-separator)] bg-[var(--c-bg)] space-y-3"
            style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--c-hint)]">{t('cart.to_pay')}</span>
              <span className="text-lg font-bold text-[var(--c-text)] tabular">
                {formatCurrency(totalAmount, currency)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                onHaptic('medium');
                onProceedCheckout();
              }}
              className="btn-filled"
            >
              {t('cart.proceed_btn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
