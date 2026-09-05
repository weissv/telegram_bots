import React, { useEffect, useState, useMemo } from 'react';
import { useTelegram } from './hooks/useTelegram.js';
import { useCart } from './hooks/useCart.js';
import { I18nProvider, useI18n } from './i18n/useI18n.js';
import { Header } from './components/Header.js';
import { ProductCard } from './components/ProductCard.js';
import { CartDrawer } from './components/CartDrawer.js';
import { CheckoutModal } from './components/CheckoutModal.js';
import { Product, ShopBootstrap, StoreTheme } from './types/index.js';
import { Sparkles, Store, AlertCircle } from 'lucide-react';

const API_BASE =
  import.meta.env.VITE_API_URL ??
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3000'
    : '');

function AppContent() {
  const { user, initData, haptic } = useTelegram();
  const { locale, setLocale, t, formatCurrency } = useI18n();

  // Extract tenantId from URL query param
  const urlParams = new URLSearchParams(window.location.search);
  const tenantId = urlParams.get('tenant_id') || 'demo-tenant';

  const { items, addItem, updateQuantity, removeItem, clearCart, totalCount, totalAmount } =
    useCart(tenantId);

  const [bootstrap, setBootstrap] = useState<ShopBootstrap | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);

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

  const handleAddToCart = (product: Product) => {
    haptic.impact('medium');
    addItem(product, 1);
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
      clearCart();
      setIsCheckoutOpen(false);

      if (data.payment?.paymentUrl) {
        window.location.href = data.payment.paymentUrl;
      }
    } catch (err: any) {
      alert(`${t('checkout.failed', { error: err.message })}`);
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const theme: StoreTheme = bootstrap?.theme || {
    storeName: 'Telegram Storefront',
    currency: 'USD',
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6 space-y-4">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400">{t('miniapp.loading')}</p>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <Header
        theme={theme}
        cartCount={totalCount}
        onOpenCart={() => setIsCartOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        locale={locale}
        onLocaleChange={setLocale}
      />

      {/* Banner */}
      {theme.bannerUrl && (
        <div className="px-4 mt-3">
          <div className="relative h-36 w-full rounded-2xl overflow-hidden border border-slate-800 shadow-md">
            <img
              src={theme.bannerUrl}
              alt="Store Banner"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-4">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                {t('miniapp.featured')}
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
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
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
          <span className="text-xs text-slate-500">
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
                  onAddToCart={handleAddToCart}
                />
              );
            })}
          </div>
        )}
      </main>

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
