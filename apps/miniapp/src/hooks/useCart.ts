import { useState, useEffect, useCallback } from 'react';
import { Product, CartItem } from '../types/index.js';

export function getCartLineKey(productId: string, variant?: string): string {
  return `${productId}::${variant ? variant.trim() : ''}`;
}

export function useCart(tenantId: string) {
  const storageKey = `tma_cart_${tenantId}`;

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (i: any) => i && i.product && typeof i.product.id === 'string' && Number(i.quantity) > 0
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // ignore storage error
    }
  }, [items, storageKey]);

  const addItem = useCallback((product: Product, quantity = 1, variant?: string) => {
    const cleanVariant = variant?.trim() || undefined;
    setItems((prev) => {
      const targetKey = getCartLineKey(product.id, cleanVariant);
      const otherVariantsQty = prev
        .filter((i) => i.product.id === product.id && getCartLineKey(i.product.id, i.variant) !== targetKey)
        .reduce((sum, i) => sum + i.quantity, 0);
      const maxForLine = Math.max(0, product.stock - otherVariantsQty);
      if (maxForLine <= 0) return prev;

      const existingIndex = prev.findIndex(
        (i) => getCartLineKey(i.product.id, i.variant) === targetKey
      );
      if (existingIndex > -1) {
        const next = [...prev];
        const newQty = next[existingIndex].quantity + quantity;
        next[existingIndex] = {
          ...next[existingIndex],
          product,
          quantity: Math.min(newQty, maxForLine),
        };
        return next;
      }
      return [
        ...prev,
        {
          product,
          quantity: Math.min(quantity, maxForLine),
          ...(cleanVariant ? { variant: cleanVariant } : {}),
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, variant?: string) => {
    const targetKey = getCartLineKey(productId, variant);
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => getCartLineKey(i.product.id, i.variant) !== targetKey);
      }
      const otherVariantsQty = prev
        .filter((i) => i.product.id === productId && getCartLineKey(i.product.id, i.variant) !== targetKey)
        .reduce((sum, i) => sum + i.quantity, 0);

      return prev.map((item) => {
        if (getCartLineKey(item.product.id, item.variant) === targetKey) {
          const maxForLine = Math.max(1, item.product.stock - otherVariantsQty);
          return { ...item, quantity: Math.min(quantity, maxForLine) };
        }
        return item;
      });
    });
  }, []);

  const removeItem = useCallback((productId: string, variant?: string) => {
    const targetKey = getCartLineKey(productId, variant);
    setItems((prev) => prev.filter((i) => getCartLineKey(i.product.id, i.variant) !== targetKey));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);

  return {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    totalCount,
    totalAmount,
  };
}
