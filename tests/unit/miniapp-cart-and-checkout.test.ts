import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { getCartLineKey } from '../../apps/miniapp/src/hooks/useCart.js';
import { I18nProvider } from '../../apps/miniapp/src/i18n/useI18n.js';
import { ProductModal } from '../../apps/miniapp/src/components/ProductModal.js';
import { CheckoutModal } from '../../apps/miniapp/src/components/CheckoutModal.js';
import { PaynetPaymentModal } from '../../apps/miniapp/src/components/PaynetPaymentModal.js';
import { OrderSuccessModal } from '../../apps/miniapp/src/components/OrderSuccessModal.js';

const requireFromMiniapp = createRequire(path.resolve(process.cwd(), 'apps/miniapp/package.json'));
const React = requireFromMiniapp('react');
const { renderToStaticMarkup } = requireFromMiniapp('react-dom/server');

function createStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

describe('Mini App Cart Variants, Checkout Blocking & Honest Payment Copy', () => {
  const origLocalStorage = (globalThis as any).localStorage;

  beforeEach(() => {
    (globalThis as any).localStorage = createStorageMock();
  });

  afterEach(() => {
    (globalThis as any).localStorage = origLocalStorage;
  });

  it('getCartLineKey separates product variants deterministically', () => {
    expect(getCartLineKey('prod-1')).toBe('prod-1::');
    expect(getCartLineKey('prod-1', 'M')).toBe('prod-1::M');
    expect(getCartLineKey('prod-1', ' L ')).toBe('prod-1::L');
    expect(getCartLineKey('prod-1', 'M')).not.toBe(getCartLineKey('prod-1', 'L'));
  });

  it('ProductModal renders variant chips and disables Add button until variant is selected', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        I18nProvider,
        null,
        React.createElement(ProductModal, {
          product: {
            id: 'prod-v1',
            title: 'Tashkent Hoodie',
            description: 'Heavyweight cotton',
            price: 420000,
            stock: 10,
            category: 'Apparel',
            variants: ['S', 'M', 'L'],
            images: [],
            is_active: true,
          },
          currency: 'UZS',
          cartItems: [],
          isOpen: true,
          onClose: () => {},
          onAddToCart: () => {},
          onHaptic: () => {},
        })
      )
    );

    expect(html).toContain('Размер / вариант');
    expect(html).toContain('>S<');
    expect(html).toContain('>M<');
    expect(html).toContain('>L<');
    expect(html).toContain('Выберите вариант');
    expect(html).toContain('disabled=""');
  });

  it('CheckoutModal blocks submit & displays warning when checkoutEnabled=false (demo or Paynet disabled)', () => {
    const commonProps = {
      isOpen: true,
      onClose: () => {},
      items: [
        {
          product: {
            id: 'p1',
            title: 'Hoodie',
            description: '',
            price: 150000,
            stock: 5,
            category: 'Apparel',
            variants: ['L'],
            images: [],
            is_active: true,
          },
          quantity: 1,
          variant: 'L',
        },
      ],
      currency: 'UZS',
      totalAmount: 150000,
      theme: {
        storeName: 'MODA Demo',
        currency: 'UZS',
        paynetEnabled: false,
        paynetQrUrl: '',
        deliveryFeeUzs: 25000,
        freeDeliveryThresholdUzs: 300000,
        legalName: 'ИП Рахимов А.А.',
        innOrPinfl: '123456789',
        supportContact: '@moda_support',
        deliveryTerms: '1–2 дня по Ташкенту',
        returnPolicy: 'Возврат в течение 10 дней',
        privacyPolicyUrl: '/#legal',
      },
      initialTelegramUser: { id: 123, first_name: 'Aziz' },
      onConfirmOrder: async () => {},
      isProcessing: false,
    };

    const demoBlockedHtml = renderToStaticMarkup(
      React.createElement(
        I18nProvider,
        null,
        React.createElement(CheckoutModal, {
          ...commonProps,
          checkoutEnabled: false,
          isDemo: true,
          checkoutDisabledReason: 'DEMO_STORE',
        })
      )
    );
    expect(demoBlockedHtml).toContain('Демо-витрина: приём реальных заказов и оплат отключён');
    expect(demoBlockedHtml).toContain('Оформление недоступно');
    expect(demoBlockedHtml).toContain('disabled=""');
    expect(demoBlockedHtml).toContain('[L]');
    expect(demoBlockedHtml).toContain('ИП Рахимов А.А.');
    expect(demoBlockedHtml).toContain('123456789');
    expect(demoBlockedHtml).toContain('@moda_support');

    const disabledHtml = renderToStaticMarkup(
      React.createElement(
        I18nProvider,
        null,
        React.createElement(CheckoutModal, {
          ...commonProps,
          checkoutEnabled: false,
          isDemo: false,
          checkoutDisabledReason: 'PAYNET_NOT_CONFIGURED',
        })
      )
    );
    expect(disabledHtml).toContain('Онлайн-оплата временно отключена продавцом');
    expect(disabledHtml).toContain('disabled=""');

    const enabledHtml = renderToStaticMarkup(
      React.createElement(
        I18nProvider,
        null,
        React.createElement(CheckoutModal, {
          ...commonProps,
          checkoutEnabled: true,
          isDemo: false,
          theme: {
            ...commonProps.theme,
            paynetEnabled: true,
            paynetQrUrl: 'https://app.paynet.uz/qr-online/000201010211merchant9999',
          },
        })
      )
    );
    // Subtotal 150,000 + Delivery 25,000 = 175,000
    expect(enabledHtml).toContain('175');
    expect(enabledHtml).toContain('Доставка курьером');
    expect(enabledHtml).toContain('Самовывоз');
    expect(enabledHtml).not.toContain('Оформление недоступно');
  });

  it('PaynetPaymentModal and OrderSuccessModal show truthful PAYMENT_REVIEW copy instead of instant PAID claims', () => {
    const payModalHtml = renderToStaticMarkup(
      React.createElement(
        I18nProvider,
        null,
        React.createElement(PaynetPaymentModal, {
          isOpen: true,
          orderId: '12345678-aaaa-bbbb-cccc-1234567890ab',
          totalAmount: 175000,
          currency: 'UZS',
          paynetQrUrl: 'https://app.paynet.uz/qr-online/000201010211merchant9999',
          onConfirmPaid: async () => {},
          onCancelOrder: async () => {},
          onClose: () => {},
          isConfirming: false,
        })
      )
    );
    expect(payModalHtml).toContain('Я оплатил — отправить на проверку');
    expect(payModalHtml).toContain('Отменить неоплаченный заказ');

    const successModalHtml = renderToStaticMarkup(
      React.createElement(
        I18nProvider,
        null,
        React.createElement(OrderSuccessModal, {
          isOpen: true,
          orderId: '12345678-aaaa-bbbb-cccc-1234567890ab',
          totalAmount: 175000,
          currency: 'UZS',
          itemsCount: 1,
          supportContact: '@shop_support',
          onClose: () => {},
          onCloseMiniApp: () => {},
        })
      )
    );
    expect(successModalHtml).toContain('Оплата отправлена на проверку оператору магазина');
    expect(successModalHtml).toContain('На проверке оплаты');
    expect(successModalHtml).toContain('@shop_support');
    expect(successModalHtml).not.toContain('Заказ оплачен!');
  });

  it('Static security checks: no revoked token, no platform QR in storefronts/engine, and hardened docker files', () => {
    const root = process.cwd();
    const dockerfileApi = fs.readFileSync(path.join(root, 'docker/Dockerfile.api'), 'utf8');
    expect(dockerfileApi).not.toContain('--accept-data-loss');
    expect(dockerfileApi).not.toContain('|| true');
    expect(dockerfileApi).toContain('COPY --from=builder /app/scripts/ ./scripts/');

    const composeSaas = fs.readFileSync(path.join(root, 'docker/docker-compose.saas.yml'), 'utf8');
    expect(composeSaas).not.toContain('5432:5432');
    expect(composeSaas).not.toContain('6379:6379');
    expect(composeSaas).toContain(':?POSTGRES_PASSWORD is required');
    expect(composeSaas).toContain(':?ENCRYPTION_KEY is required');
    expect(composeSaas).toContain(':?JWT_SECRET is required');

    const composeStandalone = fs.readFileSync(
      path.join(root, 'docker/docker-compose.standalone.yml'),
      'utf8'
    );
    expect(composeStandalone).toContain('redis:');
    expect(composeStandalone).toContain('REDIS_URL: redis://redis:6379');

    const shopTs = fs.readFileSync(path.join(root, 'apps/api/src/routes/shop.ts'), 'utf8');
    expect(shopTs).not.toContain('PLATFORM_PAYNET_QR_URL');
    expect(shopTs).not.toContain('DEFAULT_PAYNET_QR_URL');

    const orderServiceTs = fs.readFileSync(
      path.join(root, 'apps/api/src/services/orderService.ts'),
      'utf8'
    );
    expect(orderServiceTs).not.toContain('PLATFORM_PAYNET_QR_URL');
    expect(orderServiceTs).not.toContain('DEFAULT_PAYNET_QR_URL');

    const cartTs = fs.readFileSync(
      path.join(root, 'packages/telegram-engine/src/handlers/cart.ts'),
      'utf8'
    );
    expect(cartTs).not.toContain('PLATFORM_PAYNET_QR_URL');
    expect(cartTs).not.toContain('DEFAULT_PAYNET_QR_URL');
  });
});
