import { useState, useEffect } from 'react';
import { Product, CartItem } from '../types/index.js';

export function useCart(tenantId: string) {
  const storageKey = `tma_cart_${tenantId}`;

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
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

  const addItem = (product: Product, quantity = 1) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.product.id === product.id);
      if (existingIndex > -1) {
        const next = [...prev];
        const newQty = next[existingIndex].quantity + quantity;
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: Math.min(newQty, product.stock),
        };
        return next;
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stock) }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.product.id !== productId);
      }
      return prev.map((item) => {
        if (item.product.id === productId) {
          return { ...item, quantity: Math.min(quantity, item.product.stock) };
        }
        return item;
      });
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => setItems([]);

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
