import { test, expect } from '@playwright/test';

test.describe('Telegram Mini App E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock Telegram WebApp environment
    await page.addInitScript(() => {
      (window as any).Telegram = {
        WebApp: {
          initData: 'query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A12345678%2C%22first_name%22%3A%22Alex%22%7D&auth_date=1725148800&hash=mock_valid_hash',
          initDataUnsafe: {
            user: { id: 12345678, first_name: 'Alex' },
          },
          ready: () => {},
          expand: () => {},
          close: () => {},
          HapticFeedback: {
            impactOccurred: () => {},
            notificationOccurred: () => {},
            selectionChanged: () => {},
          },
        },
      };
    });
  });

  test('should render storefront, add product to cart, and open checkout modal', async ({ page }) => {
    // Navigate to local Mini App
    await page.goto('/?tenant_id=demo-tenant');

    // Wait for header
    await expect(page.locator('header')).toBeVisible();

    // Check product cards
    const productCards = page.locator('main .grid > div');
    await expect(productCards.first()).toBeVisible();

    // Click Add on first product
    const firstAddBtn = page.locator('button:has-text("Add")').first();
    await firstAddBtn.click();

    // Verify cart badge updates
    const cartBadge = page.locator('header button span');
    await expect(cartBadge).toHaveText('1');

    // Open cart drawer
    await page.locator('header button[aria-label="View Shopping Cart"]').click();
    await expect(page.locator('text=Shopping Cart')).toBeVisible();

    // Click proceed to checkout
    const proceedBtn = page.locator('button:has-text("Proceed to Checkout")');
    await proceedBtn.click();

    // Verify checkout modal appears
    await expect(page.locator('text=Secure Checkout')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
