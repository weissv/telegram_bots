import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';
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
  const { formatCurrency } = useI18n();
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
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 transition-opacity">
      <div
        className="w-full max-h-[92vh] bg-[var(--c-bg)] border-t border-[var(--c-separator)] rounded-t-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle & Close button */}
        <div className="relative w-full pt-3 pb-2 flex items-center justify-center border-b border-[var(--c-separator)]">
          <div className="w-10 h-1 rounded-full bg-[var(--c-hint)] opacity-40" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-2.5 p-1.5 rounded-full text-[var(--c-hint)] hover:text-[var(--c-text)]"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Main Product Image */}
          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[var(--c-secondary)]">
            <img
              src={image}
              alt={product.title}
              className="w-full h-full object-cover"
            />
            {isOutOfStock ? (
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-semibold">
                Нет в наличии
              </span>
            ) : product.stock <= 5 ? (
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-amber-500 text-black text-xs font-semibold">
                Осталось {product.stock} шт.
              </span>
            ) : null}
          </div>

          {/* Title & Price */}
          <div className="space-y-1">
            {product.category && (
              <span className="text-xs font-medium text-[var(--c-hint)] uppercase tracking-wide">
                {product.category}
              </span>
            )}
            <h2 className="text-lg font-semibold text-[var(--c-text)] leading-snug">
              {product.title}
            </h2>
            <div className="text-xl font-bold text-[var(--c-text)] tabular pt-1">
              {formatCurrency(unitPrice, currency)}
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="p-3.5 rounded-xl bg-[var(--c-secondary)] text-sm text-[var(--c-text)] leading-relaxed">
              {product.description}
            </div>
          )}

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <div className="flex items-center justify-between py-2 border-t border-[var(--c-separator)]">
              <span className="text-sm font-medium text-[var(--c-text)]">Количество:</span>
              <div className="stepper !h-10 !w-32">
                <button
                  type="button"
                  disabled={qty <= 1}
                  onClick={handleDecrement}
                  aria-label="Уменьшить"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-base">{qty}</span>
                <button
                  type="button"
                  disabled={qty >= product.stock}
                  onClick={handleIncrement}
                  aria-label="Увеличить"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Button Footer */}
        <div className="p-4 border-t border-[var(--c-separator)] bg-[var(--c-bg)]" style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}>
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleAdd}
            className="btn-filled"
          >
            {isOutOfStock ? (
              'Товар распродан'
            ) : (
              <span>Добавить в корзину · {formatCurrency(totalPrice, currency)}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
