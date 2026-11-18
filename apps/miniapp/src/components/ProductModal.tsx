import React, { useState, useEffect } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { CartItem, Product } from '../types/index.js';
import { useI18n, translateCategory } from '../i18n/useI18n.js';

interface ProductModalProps {
  product: Product | null;
  currency: string;
  cartItems: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, variant?: string) => void;
  onHaptic: (type: 'light' | 'medium') => void;
}

const VARIANT_COPY = {
  ru: {
    label: 'Размер / вариант',
    requiredHint: 'Выберите вариант перед добавлением в корзину',
    chooseBtn: 'Выберите вариант',
    inCartVariant: 'Уже в корзине ({variant}): {count} шт.',
    stockLeft: 'Доступно для добавления: {count} шт.',
  },
  uz: {
    label: "O'lcham / variant",
    requiredHint: "Savatga qo'shishdan oldin variantni tanlang",
    chooseBtn: 'Variantni tanlang',
    inCartVariant: 'Savatda ({variant}): {count} dona',
    stockLeft: "Qo'shish mumkin: {count} dona",
  },
  en: {
    label: 'Size / option',
    requiredHint: 'Select an option before adding to cart',
    chooseBtn: 'Select an option',
    inCartVariant: 'In cart ({variant}): {count}',
    stockLeft: 'Available to add: {count}',
  },
} as const;

export function ProductModal({
  product,
  currency,
  cartItems,
  isOpen,
  onClose,
  onAddToCart,
  onHaptic,
}: ProductModalProps) {
  const { t, locale, formatCurrency } = useI18n();
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  const variants = product && Array.isArray(product.variants)
    ? product.variants.map((v) => String(v).trim()).filter(Boolean)
    : [];
  const hasVariants = variants.length > 0;

  useEffect(() => {
    if (isOpen && product) {
      setQty(1);
      if (variants.length === 1) {
        setSelectedVariant(variants[0]);
      } else {
        setSelectedVariant(null);
      }
    }
  }, [isOpen, product?.id]);

  if (!isOpen || !product) return null;

  const vCopy = VARIANT_COPY[locale] || VARIANT_COPY.ru;
  const totalInCartForProduct = cartItems
    .filter((i) => i.product.id === product.id)
    .reduce((sum, i) => sum + i.quantity, 0);
  const currentVariantInCart = selectedVariant
    ? cartItems.find((i) => i.product.id === product.id && i.variant === selectedVariant)?.quantity || 0
    : 0;
  const remainingAddable = Math.max(0, product.stock - totalInCartForProduct);

  const isOutOfStock = product.stock <= 0;
  const isMaxedInCart = !isOutOfStock && remainingAddable <= 0;
  const variantRequiredUnset = hasVariants && !selectedVariant;

  const image =
    product.images?.[0] ||
    'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80';
  const unitPrice = Number(product.price);
  const totalPrice = unitPrice * qty;

  const categoryTranslated = translateCategory(t, product.category);

  const handleIncrement = () => {
    if (qty < Math.max(1, remainingAddable)) {
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
    if (isOutOfStock || isMaxedInCart || variantRequiredUnset) return;
    onHaptic('medium');
    onAddToCart(product, qty, selectedVariant || undefined);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 transition-opacity"
      onClick={onClose}
    >
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
            aria-label="Close"
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
                {t('product.out_of_stock')}
              </span>
            ) : product.stock <= 5 ? (
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-amber-500 text-black text-xs font-semibold">
                {t('product.low_stock', { count: product.stock })}
              </span>
            ) : null}
          </div>

          {/* Title & Price */}
          <div className="space-y-1">
            {categoryTranslated && (
              <span className="text-xs font-medium text-[var(--c-hint)] uppercase tracking-wide">
                {categoryTranslated}
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

          {/* Variant / Size Selector */}
          {hasVariants && !isOutOfStock && (
            <div className="space-y-2 pt-2 border-t border-[var(--c-separator)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--c-text)]">
                  {vCopy.label} <span className="text-red-500">*</span>
                </span>
                {selectedVariant && currentVariantInCart > 0 && (
                  <span className="text-xs text-[var(--c-brand-ink)] font-medium">
                    {vCopy.inCartVariant
                      .replace('{variant}', selectedVariant)
                      .replace('{count}', String(currentVariantInCart))}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {variants.map((variant) => {
                  const isSelected = selectedVariant === variant;
                  return (
                    <button
                      key={variant}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        onHaptic('light');
                        setSelectedVariant(variant);
                      }}
                      className={`min-w-[44px] h-9 px-3.5 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-[var(--c-brand)] text-[var(--c-brand-text)] border-[var(--c-brand)] shadow-sm'
                          : 'bg-[var(--c-secondary)] text-[var(--c-text)] border-[var(--c-separator)]'
                      }`}
                    >
                      {variant}
                    </button>
                  );
                })}
              </div>

              {variantRequiredUnset && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {vCopy.requiredHint}
                </p>
              )}
            </div>
          )}

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <div className="space-y-1.5 pt-2 border-t border-[var(--c-separator)]">
              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-medium text-[var(--c-text)]">
                  {t('product.quantity')}
                </span>
                <div className="stepper !h-10 !w-32">
                  <button
                    type="button"
                    disabled={qty <= 1}
                    onClick={handleDecrement}
                    aria-label="-"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-base">{qty}</span>
                  <button
                    type="button"
                    disabled={qty >= Math.max(1, remainingAddable)}
                    onClick={handleIncrement}
                    aria-label="+"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {totalInCartForProduct > 0 && (
                <p className="text-xs text-[var(--c-hint)] text-right">
                  {vCopy.stockLeft.replace('{count}', String(remainingAddable))}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Button Footer */}
        <div
          className="p-4 border-t border-[var(--c-separator)] bg-[var(--c-bg)]"
          style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}
        >
          <button
            type="button"
            disabled={isOutOfStock || isMaxedInCart || variantRequiredUnset}
            onClick={handleAdd}
            className="btn-filled"
          >
            {isOutOfStock ? (
              t('product.sold_out')
            ) : variantRequiredUnset ? (
              <span>{vCopy.chooseBtn}</span>
            ) : (
              <span>{t('product.add_btn', { price: formatCurrency(totalPrice, currency) })}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
