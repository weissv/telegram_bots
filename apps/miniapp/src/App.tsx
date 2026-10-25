import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTelegram } from './hooks/useTelegram.js';
import { useCart } from './hooks/useCart.js';
import { I18nProvider, useI18n } from './i18n/useI18n.js';
import { Header } from './components/Header.js';
import { ProductCard } from './components/ProductCard.js';
import { ProductModal } from './components/ProductModal.js';
import { CartDrawer } from './components/CartDrawer.js';
import { CheckoutModal } from './components/CheckoutModal.js';
import { PaynetPaymentModal } from './components/PaynetPaymentModal.js';
import { OrderSuccessModal } from './components/OrderSuccessModal.js';
import { Product, ShopBootstrap, StoreTheme } from './types/index.js';
import { Store, AlertCircle, ShoppingBag } from 'lucide-react';

const API_BASE =
  import.meta.env.VITE_API_URL ??
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3000'
    : '');

function AppContent() {
  const { user, initData, haptic, mainButton, backButton, close, isInsideTelegram } = useTelegram();
  const { locale, setLocale, t, formatCurrency } = useI18n();

  // Extract tenantId from URL query param
  const urlParams = new URLSearchParams(window.location.search);
  const tenantId = urlParams.get('tenant_id') || '00000000-0000-0000-0000-000000000001';

  const { items, addItem, updateQuantity, removeItem, clearCart, totalCount, totalAmount } =
    useCart(tenantId);

  const [bootstrap, setBootstrap] = useState<ShopBootstrap | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Sheets
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);
  const [paynetPayment, setPaynetPayment] = useState<{
    orderId: string;
    totalAmount: number;
    paynetQrUrl: string;
    itemsCount: number;
  } | null>(null);
  const [isConfirmingPaynet, setIsConfirmingPaynet] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{
    orderId: string;
    totalAmount: number;
    itemsCount: number;
  } | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2000);
  }, []);

  // Fetch shop bootstrap metadata
  useEffect(() => {
    async function loadShop() {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_BASE}/api/v1/shop/bootstrap?tenant_id=${tenantId}`);
        if (!res.ok) {
          throw new Error('Failed to load shop configuration');
        }
        const data: ShopBootstrap = await res.json();
        setBootstrap(data);
        setProducts(data.featuredProducts || []);

        if (data.theme?.primaryColor) {
          document.documentElement.style.setProperty('--c-brand', data.theme.primaryColor);
        }
      } catch (err: any) {
        console.error('Bootstrap error:', err);
        setError(err.message || 'Store unavailable');
      } finally {
        setIsLoading(false);
      }
    }

    loadShop();
  }, [tenantId]);

  const theme: StoreTheme = bootstrap?.theme || {
    storeName: 'MODA Tashkent',
    currency: 'UZS',
  };

  // Telegram BackButton management
  useEffect(() => {
    const handleBack = () => {
      haptic.impact('light');
      if (orderSuccess) {
        setOrderSuccess(null);
      } else if (isCheckoutOpen) {
        setIsCheckoutOpen(false);
        setIsCartOpen(true);
      } else if (isCartOpen) {
        setIsCartOpen(false);
      } else if (selectedProduct) {
        setSelectedProduct(null);
      }
    };

    if (selectedProduct || isCartOpen || isCheckoutOpen || orderSuccess) {
      backButton.show();
      backButton.onClick(handleBack);
    } else {
      backButton.hide();
    }

    return () => {
      backButton.offClick(handleBack);
    };
  }, [selectedProduct, isCartOpen, isCheckoutOpen, orderSuccess, backButton, haptic]);

  // Telegram MainButton management
  useEffect(() => {
    if (!isInsideTelegram) return;

    if (orderSuccess || isCheckoutOpen) {
      mainButton.hide();
      return;
    }

    if (isCartOpen) {
      if (items.length > 0) {
        const btnText = t('cart.main_btn_checkout', {
          amount: formatCurrency(totalAmount, theme.currency || 'UZS'),
        });
        mainButton.setText(btnText);
        mainButton.show();

        const onProceed = () => {
          haptic.impact('medium');
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        };

        mainButton.onClick(onProceed);
        return () => mainButton.offClick(onProceed);
      } else {
        mainButton.hide();
      }
      return;
    }

    if (items.length > 0) {
      const btnText = t('cart.main_btn_cart', {
        count: totalCount,
        amount: formatCurrency(totalAmount, theme.currency || 'UZS'),
      });
      mainButton.setText(btnText);
      mainButton.show();

      const onOpen = () => {
        haptic.impact('medium');
        setIsCartOpen(true);
      };

      mainButton.onClick(onOpen);
      return () => mainButton.offClick(onOpen);
    } else {
      mainButton.hide();
    }
  }, [
    items.length,
    totalCount,
    totalAmount,
    isCartOpen,
    isCheckoutOpen,
    orderSuccess,
    isInsideTelegram,
    mainButton,
    theme.currency,
    formatCurrency,
    t,
    haptic,
  ]);

  // Handle category and search filtering
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchSearch =
        !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleAddToCart = (product: Product, quantity = 1) => {
    haptic.impact('medium');
    addItem(product, quantity);
    showToast(t('product.added_toast'));
  };

  const handleProceedCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleConfirmOrder = async (details: {
    customerName: string;
    customerPhone: string;
    shippingAddress: string;
    paymentMethod: 'PAYNET_XOLIS' | 'STRIPE' | 'MOCK' | 'TELEGRAM_STARS';
  }) => {
    try {
      setIsProcessingCheckout(true);
      haptic.notification('success');

      const checkoutPayload = {
        customerTelegramId: user?.id ? String(user.id) : 'web_user',
        customerName: details.customerName,
        customerPhone: details.customerPhone,
        shippingAddress: details.shippingAddress,
        paymentMethod: details.paymentMethod,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      };

      const res = await fetch(`${API_BASE}/api/v1/shop/checkout?tenant_id=${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
        },
        body: JSON.stringify(checkoutPayload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Checkout failed');
      }

      const data = await res.json();
      const boughtCount = totalCount;
      const boughtAmount = totalAmount;

      clearCart();
      setIsCheckoutOpen(false);

      if (details.paymentMethod === 'PAYNET_XOLIS') {
        const paynetLink =
          data.paynetQrUrl ||
          data.payment?.paymentUrl ||
          theme.paynetQrUrl ||
          'https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r2s8nPSzGNGRQjdxV0202115204531153038605802UZ5910AO\'PAYNET\'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63043D65';

        setPaynetPayment({
          orderId: data.orderId || 'NEW',
          totalAmount: boughtAmount,
          paynetQrUrl: paynetLink,
          itemsCount: boughtCount,
        });
      } else if (data.payment?.paymentUrl && details.paymentMethod === 'STRIPE') {
        window.location.href = data.payment.paymentUrl;
      } else {
        setOrderSuccess({
          orderId: data.orderId || 'NEW',
          totalAmount: boughtAmount,
          itemsCount: boughtCount,
        });
      }
    } catch (err: any) {
      haptic.notification('error');
      alert(`Ошибка заказа: ${err.message}`);
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const handleConfirmPaynetPaid = async () => {
    if (!paynetPayment) return;

    try {
      setIsConfirmingPaynet(true);
      haptic.notification('success');

      await fetch(`${API_BASE}/api/v1/shop/orders/${paynetPayment.orderId}/confirm-paynet?tenant_id=${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
        },
      });

      const saved = { ...paynetPayment };
      setPaynetPayment(null);
      setOrderSuccess({
        orderId: saved.orderId,
        totalAmount: saved.totalAmount,
        itemsCount: saved.itemsCount,
      });
    } catch (err: any) {
      haptic.notification('error');
      alert(`Ошибка подтверждения: ${err.message}`);
    } finally {
      setIsConfirmingPaynet(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--c-bg)] text-[var(--c-text)] p-6 space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--c-brand)] border-t-transparent animate-spin" />
        <p className="text-xs text-[var(--c-hint)]">{t('miniapp.loading')}</p>
      </div>
    );
  }

  if (error && !bootstrap) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--c-bg)] text-[var(--c-text)] p-6 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-[var(--c-destructive)]" />
        <h2 className="text-base font-semibold">{t('miniapp.error_title')}</h2>
        <p className="text-xs text-[var(--c-hint)] max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="w-full bg-[var(--c-bg)] text-[var(--c-text)] select-none"
      style={{
        paddingBottom:
          items.length > 0 && !isInsideTelegram
            ? 'calc(76px + var(--safe-bottom))'
            : 'calc(24px + var(--safe-bottom))',
      }}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-[var(--c-text)] text-[var(--c-bg)] text-xs font-medium shadow-lg animate-in fade-in duration-200">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <Header
        theme={theme}
        cartCount={totalCount}
        onOpenCart={() => setIsCartOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        locale={locale}
        onLocaleChange={setLocale}
        telegramUser={user}
      />

      {/* Store Banner */}
      {theme.bannerUrl && (
        <div className="px-4 mt-3">
          <div className="relative h-32 w-full rounded-xl overflow-hidden border border-[var(--c-separator)] bg-[var(--c-secondary)]">
            <img
              src={theme.bannerUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            {theme.description && (
              <div className="absolute inset-0 bg-black/40 flex items-end p-3">
                <span className="text-xs font-medium text-white line-clamp-2">
                  {theme.description}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Chips Bar */}
      {bootstrap?.categories && bootstrap.categories.length > 0 && (
        <div className="px-4 mt-3 overflow-x-auto no-scrollbar flex items-center gap-1.5 pb-1">
          {bootstrap.categories.map((cat) => {
            const catLabel =
              cat === 'All'
                ? t('category.all')
                : t(`category.${cat.toLowerCase()}`) || cat;

            return (
              <button
                key={cat}
                type="button"
                aria-pressed={selectedCategory === cat}
                onClick={() => {
                  haptic.selection();
                  setSelectedCategory(cat);
                }}
                className="chip"
              >
                {catLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* Products Catalog Grid */}
      <main className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-[var(--c-text)]">
            {selectedCategory === 'All'
              ? t('category.all')
              : t(`category.${selectedCategory.toLowerCase()}`) || selectedCategory}
          </h2>
          <span className="text-xs text-[var(--c-hint)]">
            {t('miniapp.items_count', { count: filteredProducts.length })}
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 rounded-xl bg-[var(--c-secondary)] p-6 space-y-2">
            <Store className="w-8 h-8 text-[var(--c-hint)] mx-auto opacity-50" />
            <p className="text-sm font-medium">{t('miniapp.no_products')}</p>
            <p className="text-xs text-[var(--c-hint)]">{t('miniapp.no_products_hint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => {
              const inCart = items.find((i) => i.product.id === product.id)?.quantity || 0;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={theme.currency || 'UZS'}
                  inCartQty={inCart}
                  onAddToCart={(p) => handleAddToCart(p, 1)}
                  onUpdateQty={updateQuantity}
                  onClickProduct={(p) => {
                    haptic.impact('light');
                    setSelectedProduct(p);
                  }}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Desktop / Browser Preview Fallback Bottom Bar */}
      {!isInsideTelegram && items.length > 0 && !isCartOpen && !isCheckoutOpen && !selectedProduct && (
        <div className="fallback-bar">
          <button
            type="button"
            onClick={() => {
              haptic.impact('medium');
              setIsCartOpen(true);
            }}
            className="btn-filled flex items-center justify-between px-4"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>{t('cart.drawer_title')} ({totalCount})</span>
            </div>
            <span className="tabular font-semibold">
              {formatCurrency(totalAmount, theme.currency || 'UZS')}
            </span>
          </button>
        </div>
      )}

      {/* Product Quick View Sheet */}
      <ProductModal
        product={selectedProduct}
        currency={theme.currency || 'UZS'}
        inCartQty={
          selectedProduct
            ? items.find((i) => i.product.id === selectedProduct.id)?.quantity || 0
            : 0
        }
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
        onHaptic={(type) => haptic.impact(type)}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={items}
        currency={theme.currency || 'UZS'}
        totalAmount={totalAmount}
        onUpdateQty={updateQuantity}
        onRemoveItem={removeItem}
        onClearCart={clearCart}
        onProceedCheckout={handleProceedCheckout}
        onHaptic={(type) => haptic.impact(type)}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={items}
        currency={theme.currency || 'UZS'}
        totalAmount={totalAmount}
        initialTelegramUser={user}
        paynetEnabled={theme.paynetEnabled !== false}
        onConfirmOrder={handleConfirmOrder}
        isProcessing={isProcessingCheckout}
      />

      {/* Paynet Xolis Modal */}
      {paynetPayment && (
        <PaynetPaymentModal
          isOpen={Boolean(paynetPayment)}
          orderId={paynetPayment.orderId}
          totalAmount={paynetPayment.totalAmount}
          currency={theme.currency || 'UZS'}
          paynetQrUrl={paynetPayment.paynetQrUrl}
          onConfirmPaid={handleConfirmPaynetPaid}
          onClose={() => setPaynetPayment(null)}
          isConfirming={isConfirmingPaynet}
        />
      )}

      {/* Order Success Modal */}
      <OrderSuccessModal
        isOpen={Boolean(orderSuccess)}
        orderId={orderSuccess?.orderId || null}
        totalAmount={orderSuccess?.totalAmount || 0}
        currency={theme.currency || 'UZS'}
        itemsCount={orderSuccess?.itemsCount || 0}
        onClose={() => setOrderSuccess(null)}
        onCloseMiniApp={close}
      />
    </div>
  );
}

export function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
