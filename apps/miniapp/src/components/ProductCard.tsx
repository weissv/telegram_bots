import React from 'react';
import { Plus, Check, Eye } from 'lucide-react';
import { Product } from '../types/index.js';
import { useI18n } from '../i18n/useI18n.js';

interface ProductCardProps {
  product: Product;
  currency: string;
  inCartQty: number;
  onAddToCart: (product: Product) => void;
  onClickProduct: (product: Product) => void;
}

export function ProductCard({
  product,
  currency,
  inCartQty,
  onAddToCart,
  onClickProduct,
}: ProductCardProps) {
  const { formatCurrency } = useI18n();
  const isOutOfStock = product.stock <= 0;
  const image =
    product.images?.[0] ||
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80';

  return (
    <div
      onClick={() => onClickProduct(product)}
      className="flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg hover:border-slate-700 active:scale-[0.99] transition-all cursor-pointer group"
    >
      {/* Product Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-800">
        <img
          src={image}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {isOutOfStock ? (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-rose-500/95 text-white text-[10px] font-bold backdrop-blur shadow">
            Нет в наличии
          </span>
        ) : product.stock <= 5 ? (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500/95 text-slate-950 text-[10px] font-bold backdrop-blur shadow">
            Осталось {product.stock}
          </span>
        ) : null}

        {/* Quick View Icon Overlay */}
        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <span className="p-2 rounded-full bg-slate-900/80 text-white backdrop-blur">
            <Eye className="w-4 h-4" />
          </span>
        </div>
      </div>

      {/* Product Details */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-2">
        <div>
          {product.category && (
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
              {product.category}
            </span>
          )}
          <h3 className="text-xs sm:text-sm font-semibold text-slate-100 line-clamp-1 mt-0.5 leading-snug">
            {product.title}
          </h3>
          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Price & Add Button */}
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">Цена</span>
            <span className="text-sm sm:text-base font-extrabold text-slate-50 tracking-tight">
              {formatCurrency(Number(product.price), currency)}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            disabled={isOutOfStock || inCartQty >= product.stock}
            className={`flex items-center justify-center gap-1 h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl font-bold text-xs transition-all active:scale-90 ${
              inCartQty > 0
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Добавить в корзину"
          >
            {inCartQty > 0 ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{inCartQty}</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>+</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
