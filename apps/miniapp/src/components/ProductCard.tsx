import React from 'react';
import { Plus, Check } from 'lucide-react';
import { Product } from '../types/index.js';

interface ProductCardProps {
  product: Product;
  currency: string;
  inCartQty: number;
  onAddToCart: (product: Product) => void;
}

export function ProductCard({
  product,
  currency,
  inCartQty,
  onAddToCart,
}: ProductCardProps) {
  const isOutOfStock = product.stock <= 0;
  const image = product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80';

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg hover:border-slate-700 transition-all">
      <div className="relative aspect-square w-full overflow-hidden bg-slate-800">
        <img
          src={image}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
        />
        {isOutOfStock ? (
          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-rose-500/90 text-white text-[11px] font-semibold backdrop-blur shadow">
            Out of stock
          </span>
        ) : product.stock <= 5 ? (
          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-amber-500/90 text-slate-950 text-[11px] font-bold backdrop-blur shadow">
            Only {product.stock} left
          </span>
        ) : null}
      </div>

      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          <span className="text-[11px] font-medium text-sky-400 uppercase tracking-wider">
            {product.category}
          </span>
          <h3 className="text-sm font-semibold text-slate-100 line-clamp-1 mt-0.5">
            {product.title}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">Price</span>
            <span className="text-base font-bold text-slate-50 tracking-tight">
              {Number(product.price).toFixed(2)}{' '}
              <span className="text-xs font-medium text-sky-400">{currency}</span>
            </span>
          </div>

          <button
            onClick={() => onAddToCart(product)}
            disabled={isOutOfStock || inCartQty >= product.stock}
            className={`flex items-center justify-center gap-1 h-9 px-3.5 rounded-xl font-semibold text-xs transition-all active:scale-95 ${
              inCartQty > 0
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {inCartQty > 0 ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{inCartQty} in cart</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
