import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTelegram } from './hooks/useTelegram.js';
import { useCart } from './hooks/useCart.js';
import { I18nProvider, useI18n } from './i18n/useI18n.js';
import { Header } from './components/Header.js';
import { ProductCard } from './components/ProductCard.js';
import { ProductModal } from './components/ProductModal.js';
import { CartDrawer } from './components/CartDrawer.js';
import { CheckoutModal } from './components/CheckoutModal.js';
import { OrderSuccessModal } from './components/OrderSuccessModal.js';
import { Product, ShopBootstrap, StoreTheme } from './types/index.js';
import { Sparkles, Store, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';

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
    }, 2400);
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

        // Dynamic theme variable injection
        if (data.theme) {
          const root = document.documentElement;
          if (data.theme.primaryColor) root.style.setProperty('--color-primary', data.theme.primaryColor);
          if (data.theme.accentColor) root.style.setProperty('--color-accent', data.theme.accentColor);
          if (data.theme.backgroundColor) root.style.setProperty('--color-bg', data.theme.backgroundColor);
          if (data.theme.textColor) root.style.setProperty('--color-text', data.theme.textColor);
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
    storeName: 'Mirai Shop',
    currency: 'USD',
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

    if (orderSuccess) {
      mainButton.hide();
      return;
    }

    if (isCheckoutOpen) {
      mainButton.hide();
      return;
    }

    if (isCartOpen) {
      if (items.length > 0) {
        const btnText = `Оформить заказ • ${formatCurrency(totalAmount, theme.currency || 'USD')}`;
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
      const btnText = `Корзина (${totalCount}) • ${formatCurrency(totalAmount, theme.currency || 'USD')}`;
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
    showToast(`🛒 "${product.title}" добавлен в корзину`);
  };

  const handleProceedCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleConfirmOrder = async (details: {
    customerName: string;
    customerPhone: string;
    shippingAddress: string;
    paymentMethod: 'STRIPE' | 'MOCK' | 'TELEGRAM_STARS';
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

      if (data.payment?.paymentUrl && details.paymentMethod === 'STRIPE') {
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-400">{t('miniapp.loading')}</p>
      </div>
    );
  }

  if (error && !bootstrap) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400" />
        <h2 className="text-lg font-bold text-slate-100">{t('miniapp.error_title')}</h2>
        <p className="text-sm text-slate-400 max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-slate-800/95 border border-slate-700 text-xs font-semibold text-sky-300 shadow-xl backdrop-blur animate-in fade-in slide-in-from-top-2 duration-200">
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
          <div className="relative h-36 w-full rounded-2xl overflow-hidden border border-slate-800 shadow-md">
            <img
              src={theme.bannerUrl}
              alt="Store Banner"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex items-end p-4">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 backdrop-blur-sm px-2.5 py-1 rounded-lg bg-slate-950/40">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                {theme.description || t('miniapp.featured')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Category Pills */}
      {bootstrap?.categories && bootstrap.categories.length > 0 && (
        <div className="px-4 mt-4 overflow-x-auto no-scrollbar flex items-center gap-2">
          {bootstrap.categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                haptic.selection();
                setSelectedCategory(cat);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-105'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <main className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-200">
            {selectedCategory === 'All' ? t('miniapp.all_products') : selectedCategory}
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {t('miniapp.items_count', { count: filteredProducts.length })}
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-slate-900/40 border border-slate-800/60 p-6 space-y-2">
            <Store className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">{t('miniapp.no_products')}</p>
            <p className="text-xs text-slate-500">{t('miniapp.no_products_hint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {filteredProducts.map((product) => {
              const inCart = items.find((i) => i.product.id === product.id)?.quantity || 0;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={theme.currency || 'USD'}
                  inCartQty={inCart}
                  onAddToCart={(p) => handleAddToCart(p, 1)}
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

      {/* Desktop / Non-Telegram Floating Bottom Cart Bar */}
      {!isInsideTelegram && items.length > 0 && !isCartOpen && !isCheckoutOpen && !selectedProduct && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto animate-in slide-in-from-bottom duration-300">
          <button
            onClick={() => {
              haptic.impact('medium');
              setIsCartOpen(true);
            }}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white font-bold text-sm px-5 flex items-center justify-between shadow-2xl shadow-sky-500/30 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span>Корзина ({totalCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold">
                {formatCurrency(totalAmount, theme.currency || 'USD')}
              </span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Product Quick View Bottom Sheet */}
      <ProductModal
        product={selectedProduct}
        currency={theme.currency || 'USD'}
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
        currency={theme.currency || 'USD'}
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
        currency={theme.currency || 'USD'}
        totalAmount={totalAmount}
        initialTelegramUser={user}
        onConfirmOrder={handleConfirmOrder}
        isProcessing={isProcessingCheckout}
      />

      {/* Order Celebration Modal */}
      <OrderSuccessModal
        isOpen={Boolean(orderSuccess)}
        orderId={orderSuccess?.orderId || null}
        totalAmount={orderSuccess?.totalAmount || 0}
        currency={theme.currency || 'USD'}
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
