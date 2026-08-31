import { describe, it, expect } from 'vitest';

describe('Inventory Race-Condition Guard & Concurrency Stress Test', () => {
  class MockAtomicDatabase {
    private products = new Map<string, { id: string; stock: number; title: string }>();

    addProduct(id: string, title: string, initialStock: number) {
      this.products.set(id, { id, title, stock: initialStock });
    }

    getProduct(id: string) {
      return this.products.get(id);
    }

    /**
     * Simulates atomic conditional SQL update:
     * UPDATE "Product" SET stock = stock - 1 WHERE id = :id AND stock >= 1
     */
    async atomicCheckout(productId: string, quantity = 1): Promise<{ success: boolean; error?: string }> {
      // Simulate real asynchronous micro-latency
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 15));

      const product = this.products.get(productId);
      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      // Atomic compare-and-swap check
      if (product.stock >= quantity) {
        product.stock -= quantity;
        return { success: true };
      }

      return {
        success: false,
        error: `Insufficient stock for "${product.title}". Only ${product.stock} left.`,
      };
    }
  }

  it('should prevent double-selling under 20 concurrent checkout requests for 5 stock items', async () => {
    const db = new MockAtomicDatabase();
    const productId = 'prod_limited_drop_001';
    const initialStock = 5;
    const concurrentRequests = 20;

    db.addProduct(productId, 'Limited Edition Cyber Jacket', initialStock);

    // Fire 20 simultaneous checkout requests with Promise.all
    const checkoutPromises = Array.from({ length: concurrentRequests }, (_, i) =>
      db.atomicCheckout(productId, 1)
    );

    const results = await Promise.all(checkoutPromises);

    const successfulCheckouts = results.filter((r) => r.success);
    const failedCheckouts = results.filter((r) => !r.success);

    // Exactly 5 checkouts must succeed and 15 must fail
    expect(successfulCheckouts.length).toBe(initialStock);
    expect(failedCheckouts.length).toBe(concurrentRequests - initialStock);

    // All failures must report out of stock
    failedCheckouts.forEach((f) => {
      expect(f.error).toContain('Insufficient stock');
    });

    // Final stock must be strictly 0 (never negative)
    const finalProduct = db.getProduct(productId);
    expect(finalProduct?.stock).toBe(0);
  });
});
