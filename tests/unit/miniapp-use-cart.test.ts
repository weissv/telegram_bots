import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hookState = vi.hoisted(() => {
  let stateValue: any;
  let initialized = false;
  return {
    reset() {
      stateValue = undefined;
      initialized = false;
    },
    useState(initial: any) {
      if (!initialized) {
        stateValue = typeof initial === 'function' ? initial() : initial;
        initialized = true;
      }
      const setState = (updater: any) => {
        stateValue = typeof updater === 'function' ? updater(stateValue) : updater;
      };
      return [stateValue, setState];
    },
    useEffect(fn: () => void) {
      fn();
    },
    useCallback(fn: any) {
      return fn;
    },
  };
});

vi.mock('../../apps/miniapp/node_modules/react/index.js', () => ({
  useState: hookState.useState,
  useEffect: hookState.useEffect,
  useCallback: hookState.useCallback,
}));

import { useCart } from '../../apps/miniapp/src/hooks/useCart.js';

describe('Mini App useCart Variant Line Items & Shared Stock Cap', () => {
  const origLocalStorage = (globalThis as any).localStorage;
  const store = new Map<string, string>();

  beforeEach(() => {
    hookState.reset();
    store.clear();
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    };
  });

  afterEach(() => {
    (globalThis as any).localStorage = origLocalStorage;
  });

  it('tracks separate cart lines per variant while enforcing shared product.stock ceiling', () => {
    const product = {
      id: 'prod-hoodie-1',
      title: 'Tashkent Hoodie',
      description: 'Cotton',
      price: 420000,
      stock: 3,
      category: 'Apparel',
      variants: ['S', 'M', 'L'],
      images: [],
      is_active: true,
    };

    let cart = useCart('tenant-1');
    expect(cart.items).toHaveLength(0);

    // Add 2 of variant S
    cart.addItem(product, 2, 'S');
    cart = useCart('tenant-1');
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].variant).toBe('S');
    expect(cart.items[0].quantity).toBe(2);

    // Add 2 of variant M -> clamped to 1 because shared stock is 3 (2 + 1 = 3)
    cart.addItem(product, 2, 'M');
    cart = useCart('tenant-1');
    expect(cart.items).toHaveLength(2);
    expect(cart.items[1].variant).toBe('M');
    expect(cart.items[1].quantity).toBe(1);
    expect(cart.totalCount).toBe(3);
    expect(cart.totalAmount).toBe(3 * 420000);

    // Attempting to add variant L when 3/3 already in cart is ignored
    cart.addItem(product, 1, 'L');
    cart = useCart('tenant-1');
    expect(cart.items).toHaveLength(2);

    // Updating variant S quantity to 5 clamps to 2 (since M holds 1 of 3)
    cart.updateQuantity('prod-hoodie-1', 5, 'S');
    cart = useCart('tenant-1');
    expect(cart.items.find((i) => i.variant === 'S')?.quantity).toBe(2);

    // Removing variant S frees stock and keeps variant M intact
    cart.removeItem('prod-hoodie-1', 'S');
    cart = useCart('tenant-1');
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].variant).toBe('M');
  });
});
