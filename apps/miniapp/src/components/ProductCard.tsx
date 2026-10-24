import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { Product } from '../types/index.js';
import { useI18n } from '../i18n/useI18n.js';

interface ProductCardProps {
  product: Product;
  currency: string;
  inCartQty: number;
  onAddToCart: (product: Product) => void;
  onClickProduct: (product: Product) => void;
  onUpdateQty?: (productId: string, quantity: number) => void;
}

export function ProductCard({
  product,
  currency,
  inCartQty,
  onAddToCart,
  onClickProduct,
  onUpdateQty,
}: ProductCardProps) {
  const { t, formatCurrency } = useI18n();
  const isOutOfStock = product.stock <= 0;
  const image =
    product.images?.[0] ||
    'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=400&q=80';

  const categoryTranslated = product.category
    ? t(`category.${product.category.toLowerCase()}`) || product.category
    : '';

  return (
    <div
      onClick={() => onClickProduct(product)}
      className="flex flex-col rounded-xl overflow-hidden bg-[var(--c-section)] border border-[var(--c-separator)] cursor-pointer select-none transition-transform active:scale-[0.985]"
    >
      {/* Product Image */}
      <div className="relative aspect-square w-full bg-[var(--c-secondary)] overflow-hidden">
        <img
          src={image}
          alt={product.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {isOutOfStock ? (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-medium">
            {t('product.out_of_stock')}
          </span>
        ) : product.stock <= 5 ? (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-amber-500 text-black text-[11px] font-semibold">
            {t('product.low_stock', { count: product.stock })}
          </span>
        ) : null}
      </div>

      {/* Product Details */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          {categoryTranslated && (
            <span className="text-[11px] font-medium text-[var(--c-hint)] block uppercase tracking-wide">
              {categoryTranslated}
            </span>
          )}
          <h3 className="text-sm font-medium text-[var(--c-text)] line-clamp-2 mt-0.5 leading-snug">
            {product.title}
          </h3>
        </div>

        {/* Price & Action */}
        <div className="space-y-2 pt-1">
          <div className="text-base font-semibold text-[var(--c-text)] tabular">
            {formatCurrency(Number(product.price), currency)}
          </div>

          {inCartQty > 0 ? (
            <div
              className="stepper"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onUpdateQty && onUpdateQty(product.id, inCartQty - 1)}
                aria-label="-"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span>{inCartQty}</span>
              <button
                type="button"
                disabled={inCartQty >= product.stock}
                onClick={() => onUpdateQty && onUpdateQty(product.id, inCartQty + 1)}
                aria-label="+"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product);
              }}
              className="btn-tinted"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span>{isOutOfStock ? t('product.sold_out') : t('miniapp.add_to_cart')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
