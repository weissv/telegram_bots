import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTelegram } from './hooks/useTelegram.js';
import { useCart } from './hooks/useCart.js';
import { I18nProvider, useI18n, translateCategory } from './i18n/useI18n.js';
import { Header } from './components/Header.js';
import { ProductCard } from './components/ProductCard.js';
import { ProductModal } from './components/ProductModal.js';
import { CartDrawer } from './components/CartDrawer.js';
import { CheckoutModal } from './components/CheckoutModal.js';
import { PaynetPaymentModal } from './components/PaynetPaymentModal.js';
import { OrderSuccessModal } from './components/OrderSuccessModal.js';
import {
  ActiveOrderState,
  DeliveryMethod,
  Product,
  ShopBootstrap,
  StoreTheme,
} from './types/index.js';
import {
  Store,
  AlertCircle,
  ShoppingBag,
  AlertTriangle,
  Clock,
  RefreshCw,
  CreditCard,
  XCircle,
} from 'lucide-react';

const API_BASE =
  import.meta.env.VITE_API_URL ??
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3000'
    : '');

const ACTIVE_TERMINAL_STATUSES = new Set(['PAID', 'DELIVERED', 'CANCELLED', 'REFUNDED']);

const APP_COPY = {
  ru: {
    demoBanner: 'Демо-витрина: приём реальных заказов и оплат отключён',
    checkoutDisabledBanner: 'Онлайн-оплата временно отключена продавцом',
    disabledReasons: {
      DEMO_STORE: 'Демо-витрина: приём реальных заказов и оплат отключён',
      SUBSCRIPTION_INACTIVE: 'Приём заказов временно приостановлен (подписка магазина неактивна)',
      STORE_NOT_PUBLISHED: 'Витрина магазина пока находится в режиме подготовки и не опубликована',
      PAYNET_NOT_CONFIGURED: 'Онлайн-оплата временно отключена продавцом',
    } as Record<string, string>,
    activePendingTitle: 'У вас есть неоплаченный заказ #{id}',
    activeReviewTitle: 'Заказ #{id} — оплата на проверке у оператора',
    payNowBtn: 'Оплатить',
    cancelBtn: 'Отменить',
    detailsBtn: 'Детали',
    refreshBtn: 'Проверить статус',
    cancelledToast: 'Заказ отменён, товары возвращены в каталог',
    searching: 'Поиск…',
    sellerFooterTitle: 'Информация о продавце',
    privacyLink: 'Политика конфиденциальности',
    missingPaynetQrError: 'Платёжная ссылка продавца не настроена',
  },
  uz: {
    demoBanner: "Demo-vitrina: haqiqiy buyurtmalar va to'lovlar qabul qilinmaydi",
    checkoutDisabledBanner: "Onlayn to'lov sotuvchi tomonidan vaqtincha o'chirilgan",
    disabledReasons: {
      DEMO_STORE: "Demo-vitrina: haqiqiy buyurtmalar va to'lovlar qabul qilinmaydi",
      SUBSCRIPTION_INACTIVE: "Buyurtma qabul qilish vaqtincha to'xtatilgan (do'kon obunasi faol emas)",
      STORE_NOT_PUBLISHED: "Do'kon vitrinasi hali nashr qilinmagan",
      PAYNET_NOT_CONFIGURED: "Onlayn to'lov sotuvchi tomonidan vaqtincha o'chirilgan",
    } as Record<string, string>,
    activePendingTitle: "To'lanmagan buyurtmangiz bor #{id}",
    activeReviewTitle: "Buyurtma #{id} — to'lov tekshirilmoqda",
    payNowBtn: "To'lash",
    cancelBtn: 'Bekor qilish',
    detailsBtn: 'Batafsil',
    refreshBtn: 'Holatni tekshirish',
    cancelledToast: 'Buyurtma bekor qilindi',
    searching: 'Qidirilmoqda…',
    sellerFooterTitle: "Sotuvchi haqida ma'lumot",
    privacyLink: 'Maxfiylik siyosati',
    missingPaynetQrError: "Sotuvchining to'lov havolasi sozlanmagan",
  },
  en: {
    demoBanner: 'Demo storefront: real orders and payments are disabled',
    checkoutDisabledBanner: 'Online checkout is temporarily disabled by the seller',
    disabledReasons: {
      DEMO_STORE: 'Demo storefront: real orders and payments are disabled',
      SUBSCRIPTION_INACTIVE: 'Store checkout is temporarily paused (subscription inactive)',
      STORE_NOT_PUBLISHED: 'Storefront has not been published by the merchant yet',
      PAYNET_NOT_CONFIGURED: 'Online checkout is temporarily disabled by the seller',
    } as Record<string, string>,
    activePendingTitle: 'You have an unpaid order #{id}',
    activeReviewTitle: 'Order #{id} — payment under review',
    payNowBtn: 'Pay now',
    cancelBtn: 'Cancel',
    detailsBtn: 'Details',
    refreshBtn: 'Check status',
    cancelledToast: 'Order cancelled',
    searching: 'Searching…',
    sellerFooterTitle: 'Seller information',
    privacyLink: 'Privacy policy',
    missingPaynetQrError: 'Merchant Paynet link is not configured',
  },
} as const;

function isValidMerchantPaynetUrl(url?: string): boolean {
  return Boolean(url && url.trim().startsWith('https://app.paynet.uz/qr-online/'));
}

function getActiveOrderStorageKey(tenantId: string): string {
  return `tma_active_order_${tenantId}`;
}

function readStoredActiveOrder(tenantId: string): ActiveOrderState | null {
  try {
    const raw = localStorage.getItem(getActiveOrderStorageKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.orderId !== 'string') return null;
    return parsed as ActiveOrderState;
  } catch {
    return null;
  }
}

function saveStoredActiveOrder(tenantId: string, order: ActiveOrderState | null) {
  try {
    const key = getActiveOrderStorageKey(tenantId);
    if (!order) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(order));
    }
  } catch {
    // ignore storage errors
  }
}

function AppContent() {
  const { user, initData, haptic, mainButton, backButton, close, isInsideTelegram } = useTelegram();
  const { locale, setLocale, t, formatCurrency } = useI18n();

  const urlParams = new URLSearchParams(window.location.search);
  const tenantId = urlParams.get('tenant_id') || '00000000-0000-0000-0000-000000000001';

  const { items, addItem, updateQuantity, removeItem, clearCart, totalCount, totalAmount } =
    useCart(tenantId);

  const [bootstrap, setBootstrap] = useState<ShopBootstrap | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active persisted order state
  const [activeOrder, setActiveOrder] = useState<ActiveOrderState | null>(null);
  const [isCheckingActiveOrder, setIsCheckingActiveOrder] = useState<boolean>(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState<boolean>(false);

  // Modals & Sheets
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);
  const [paynetPayment, setPaynetPayment] = useState<{
    orderId: string;
    accessToken: string;
    totalAmount: number;
    paynetQrUrl: string;
    itemsCount: number;
  } | null>(null);
  const [isConfirmingPaynet, setIsConfirmingPaynet] = useState(false);
  const [paynetError, setPaynetError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{
    orderId: string;
    totalAmount: number;
    itemsCount?: number;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hasInteractedFilterRef = useRef(false);

  const copy = APP_COPY[locale] || APP_COPY.ru;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2500);
  }, []);

  const loadBootstrap = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(
        `${API_BASE}/api/v1/shop/bootstrap?tenant_id=${encodeURIComponent(tenantId)}`
      );
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
  }, [tenantId]);

  const verifyStoredOrder = useCallback(async () => {
    const stored = readStoredActiveOrder(tenantId);
    if (!stored) {
      setActiveOrder(null);
      return;
    }

    try {
      setIsCheckingActiveOrder(true);
      const tokenQuery = stored.accessToken
        ? `&token=${encodeURIComponent(stored.accessToken)}`
        : '';
      const res = await fetch(
        `${API_BASE}/api/v1/shop/orders/${encodeURIComponent(stored.orderId)}?tenant_id=${encodeURIComponent(tenantId)}${tokenQuery}`,
        {
          headers: {
            ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
            ...(stored.accessToken ? { 'X-Order-Token': stored.accessToken } : {}),
          },
        }
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          saveStoredActiveOrder(tenantId, null);
          setActiveOrder(null);
        } else {
          setActiveOrder(stored);
        }
        return;
      }

      const data = await res.json();
      const order = data.order;
      if (!order || ACTIVE_TERMINAL_STATUSES.has(order.status)) {
        saveStoredActiveOrder(tenantId, null);
        setActiveOrder(null);
        return;
      }

      const refreshed: ActiveOrderState = {
        ...stored,
        status: order.status,
        amount: order.total_amount !== undefined ? Number(order.total_amount) : stored.amount,
      };
      saveStoredActiveOrder(tenantId, refreshed);
      setActiveOrder(refreshed);
    } catch {
      // Keep stored state silently if offline
      setActiveOrder(stored);
    } finally {
      setIsCheckingActiveOrder(false);
    }
  }, [tenantId, initData]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (bootstrap) {
      verifyStoredOrder();
    }
  }, [bootstrap, verifyStoredOrder]);

  // Server-side debounced search & category filtering
  useEffect(() => {
    if (!bootstrap) return;

    const trimmedQuery = searchQuery.trim();
    const isDefaultView = trimmedQuery === '' && selectedCategory === 'All';

    if (!hasInteractedFilterRef.current && isDefaultView) {
      return;
    }
    hasInteractedFilterRef.current = true;

    const controller = new AbortController();
    const delayMs = trimmedQuery ? 280 : 0;

    const timer = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        const params = new URLSearchParams({
          tenant_id: tenantId,
          limit: '200',
        });
        if (trimmedQuery) params.set('q', trimmedQuery);
        if (selectedCategory && selectedCategory !== 'All') {
          params.set('category', selectedCategory);
        }

        const res = await fetch(`${API_BASE}/api/v1/shop/products?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (Array.isArray(data.products)) {
          setProducts(data.products);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        // Graceful fallback to local filtering on featuredProducts
        const base = bootstrap.featuredProducts || [];
        setProducts(
          base.filter((p) => {
            const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
            const qLower = trimmedQuery.toLowerCase();
            const matchSearch =
              !qLower ||
              p.title.toLowerCase().includes(qLower) ||
              (p.description || '').toLowerCase().includes(qLower) ||
              (p.category || '').toLowerCase().includes(qLower);
            return matchCat && matchSearch;
          })
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, selectedCategory, tenantId, bootstrap]);

  const theme: StoreTheme = bootstrap?.theme || {
    storeName: 'Магазин',
    currency: 'UZS',
  };

  const isDemo = Boolean(bootstrap?.isDemo);
  const checkoutEnabled =
    bootstrap?.checkoutEnabled !== undefined
      ? Boolean(bootstrap.checkoutEnabled) &&
        Boolean(theme.paynetEnabled) &&
        isValidMerchantPaynetUrl(theme.paynetQrUrl) &&
        !isDemo &&
        bootstrap?.tenant?.isActive !== false
      : Boolean(
          theme.paynetEnabled &&
            isValidMerchantPaynetUrl(theme.paynetQrUrl) &&
            !isDemo &&
            bootstrap?.tenant?.isActive !== false
        );

  const mappedDisabledReason = bootstrap?.checkoutDisabledReason
    ? copy.disabledReasons[bootstrap.checkoutDisabledReason] || bootstrap.checkoutDisabledReason
    : null;

  const disabledBannerText = !checkoutEnabled
    ? isDemo
      ? copy.demoBanner
      : mappedDisabledReason || copy.checkoutDisabledBanner
    : null;

  // Telegram BackButton management
  useEffect(() => {
    const handleBack = () => {
      haptic.impact('light');
      if (orderSuccess) {
        setOrderSuccess(null);
      } else if (paynetPayment) {
        setPaynetPayment(null);
        setPaynetError(null);
      } else if (isCheckoutOpen) {
        setIsCheckoutOpen(false);
        setIsCartOpen(true);
      } else if (isCartOpen) {
        setIsCartOpen(false);
      } else if (selectedProduct) {
        setSelectedProduct(null);
      }
    };

    if (selectedProduct || isCartOpen || isCheckoutOpen || paynetPayment || orderSuccess) {
      backButton.show();
      backButton.onClick(handleBack);
    } else {
      backButton.hide();
    }

    return () => {
      backButton.offClick(handleBack);
    };
  }, [selectedProduct, isCartOpen, isCheckoutOpen, paynetPayment, orderSuccess, backButton, haptic]);

  // Telegram MainButton management
  useEffect(() => {
    if (!isInsideTelegram) return;

    if (orderSuccess || isCheckoutOpen || paynetPayment) {
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
    paynetPayment,
    orderSuccess,
    isInsideTelegram,
    mainButton,
    theme.currency,
    formatCurrency,
    t,
    haptic,
  ]);

  const handleAddToCart = (product: Product, quantity = 1, variant?: string) => {
    haptic.impact('medium');
    addItem(product, quantity, variant);
    showToast(t('product.added_toast'));
  };

  const handleProceedCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleConfirmOrder = async (details: {
    customerName: string;
    customerPhone: string;
    deliveryMethod: DeliveryMethod;
    shippingAddress: string;
    paymentMethod: 'PAYNET_XOLIS';
    deliveryFee: number;
    grandTotal: number;
  }) => {
    if (!checkoutEnabled) return;

    try {
      setIsProcessingCheckout(true);
      haptic.notification('success');

      const checkoutPayload = {
        customerTelegramId: user?.id ? String(user.id) : 'web_user',
        customerName: details.customerName,
        customerPhone: details.customerPhone,
        deliveryMethod: details.deliveryMethod,
        shippingAddress: details.shippingAddress,
        paymentMethod: details.paymentMethod,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          ...(i.variant ? { variant: i.variant } : {}),
        })),
      };

      const res = await fetch(
        `${API_BASE}/api/v1/shop/checkout?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
          },
          body: JSON.stringify(checkoutPayload),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Checkout failed');
      }

      const data = await res.json();
      const paynetLink: string =
        data.paynetQrUrl || data.payment?.paymentUrl || theme.paynetQrUrl || '';

      if (!isValidMerchantPaynetUrl(paynetLink)) {
        throw new Error(copy.missingPaynetQrError);
      }

      const boughtCount = totalCount;
      const orderId: string = data.orderId || '';
      const accessToken: string = data.accessToken || data.access_token || '';
      const serverAmount =
        data.totalAmount !== undefined ? Number(data.totalAmount) : details.grandTotal;

      clearCart();
      setIsCheckoutOpen(false);

      const persisted: ActiveOrderState = {
        orderId,
        accessToken,
        amount: serverAmount,
        paynetUrl: paynetLink,
        status: 'PENDING',
        itemsCount: boughtCount,
      };
      saveStoredActiveOrder(tenantId, persisted);
      setActiveOrder(persisted);

      setPaynetError(null);
      setPaynetPayment({
        orderId,
        accessToken,
        totalAmount: serverAmount,
        paynetQrUrl: paynetLink,
        itemsCount: boughtCount,
      });
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
      setPaynetError(null);

      const res = await fetch(
        `${API_BASE}/api/v1/shop/orders/${encodeURIComponent(paynetPayment.orderId)}/confirm-paynet?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
            ...(paynetPayment.accessToken ? { 'X-Order-Token': paynetPayment.accessToken } : {}),
          },
          body: JSON.stringify({
            accessToken: paynetPayment.accessToken || undefined,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка подтверждения (${res.status})`);
      }

      haptic.notification('success');
      const saved = { ...paynetPayment };

      const updatedActive: ActiveOrderState = {
        orderId: saved.orderId,
        accessToken: saved.accessToken,
        amount: saved.totalAmount,
        paynetUrl: saved.paynetQrUrl,
        status: 'PAYMENT_REVIEW',
        itemsCount: saved.itemsCount,
      };
      saveStoredActiveOrder(tenantId, updatedActive);
      setActiveOrder(updatedActive);

      setPaynetPayment(null);
      setOrderSuccess({
        orderId: saved.orderId,
        totalAmount: saved.totalAmount,
        itemsCount: saved.itemsCount,
      });
    } catch (err: any) {
      haptic.notification('error');
      setPaynetError(err?.message || 'Не удалось подтвердить оплату. Попробуйте ещё раз.');
    } finally {
      setIsConfirmingPaynet(false);
    }
  };

  const handleCancelPendingOrder = async (targetOrder?: ActiveOrderState | null) => {
    const target = targetOrder || activeOrder;
    if (!target || target.status !== 'PENDING') return;

    try {
      setIsCancellingOrder(true);
      const res = await fetch(
        `${API_BASE}/api/v1/shop/orders/${encodeURIComponent(target.orderId)}/cancel?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
            ...(target.accessToken ? { 'X-Order-Token': target.accessToken } : {}),
          },
          body: JSON.stringify({
            accessToken: target.accessToken || undefined,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка отмены (${res.status})`);
      }

      saveStoredActiveOrder(tenantId, null);
      setActiveOrder(null);
      setPaynetPayment(null);
      setPaynetError(null);
      haptic.notification('success');
      showToast(copy.cancelledToast);
      loadBootstrap();
    } catch (err: any) {
      haptic.notification('error');
      setPaynetError(err?.message || 'Не удалось отменить заказ');
    } finally {
      setIsCancellingOrder(false);
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

      {/* Storefront Disabled / Demo Banner */}
      {!checkoutEnabled && disabledBannerText && (
        <div className="px-4 mt-3">
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-semibold">{disabledBannerText}</div>
              {theme.supportContact && (
                <div className="opacity-90">{theme.supportContact}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Active Order Banner */}
      {activeOrder && (
        <div className="px-4 mt-3">
          <div className="p-3 rounded-xl bg-[var(--c-secondary)] border border-[var(--c-brand)]/40 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <Clock className="w-4 h-4 text-[var(--c-brand-ink)] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--c-text)] truncate">
                    {(activeOrder.status === 'PAYMENT_REVIEW'
                      ? copy.activeReviewTitle
                      : copy.activePendingTitle
                    ).replace('{id}', activeOrder.orderId.slice(0, 8).toUpperCase())}
                  </div>
                  <div className="text-xs text-[var(--c-hint)] tabular">
                    {formatCurrency(activeOrder.amount, theme.currency || 'UZS')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isCheckingActiveOrder}
                onClick={verifyStoredOrder}
                className="p-1 text-[var(--c-hint)] hover:text-[var(--c-text)]"
                title={copy.refreshBtn}
                aria-label={copy.refreshBtn}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isCheckingActiveOrder ? 'animate-spin' : ''}`}
                />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeOrder.status === 'PENDING' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPaynetError(null);
                      setPaynetPayment({
                        orderId: activeOrder.orderId,
                        accessToken: activeOrder.accessToken,
                        totalAmount: activeOrder.amount,
                        paynetQrUrl: activeOrder.paynetUrl,
                        itemsCount: activeOrder.itemsCount || 1,
                      });
                    }}
                    className="flex-1 h-8 px-3 rounded-lg bg-[var(--c-brand)] text-[var(--c-brand-text)] text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{copy.payNowBtn}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isCancellingOrder}
                    onClick={() => handleCancelPendingOrder(activeOrder)}
                    className="h-8 px-3 rounded-lg border border-[var(--c-separator)] text-[var(--c-destructive)] text-xs font-medium inline-flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{copy.cancelBtn}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setOrderSuccess({
                      orderId: activeOrder.orderId,
                      totalAmount: activeOrder.amount,
                      itemsCount: activeOrder.itemsCount,
                    })
                  }
                  className="flex-1 h-8 px-3 rounded-lg bg-[var(--c-bg)] border border-[var(--c-separator)] text-[var(--c-text)] text-xs font-medium"
                >
                  {copy.detailsBtn}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Store Banner */}
      {theme.bannerUrl && (
        <div className="px-4 mt-3">
          <div className="relative h-32 w-full rounded-xl overflow-hidden border border-[var(--c-separator)] bg-[var(--c-secondary)]">
            <img src={theme.bannerUrl} alt="" className="w-full h-full object-cover" />
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
            const catLabel = translateCategory(t, cat);

            return (
              <button
                key={cat}
                type="button"
                aria-pressed={selectedCategory === cat}
                onClick={() => {
                  haptic.selection();
                  hasInteractedFilterRef.current = true;
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
            {translateCategory(t, selectedCategory)}
          </h2>
          <span className="text-xs text-[var(--c-hint)]">
            {isSearching
              ? copy.searching
              : t('miniapp.items_count', { count: products.length })}
          </span>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16 rounded-xl bg-[var(--c-secondary)] p-6 space-y-2">
            <Store className="w-8 h-8 text-[var(--c-hint)] mx-auto opacity-50" />
            <p className="text-sm font-medium">{t('miniapp.no_products')}</p>
            <p className="text-xs text-[var(--c-hint)]">{t('miniapp.no_products_hint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => {
              const inCart = items
                .filter((i) => i.product.id === product.id)
                .reduce((sum, i) => sum + i.quantity, 0);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={theme.currency || 'UZS'}
                  inCartQty={inCart}
                  onAddToCart={(p) => handleAddToCart(p, 1)}
                  onUpdateQty={(pid, qty, variant) => updateQuantity(pid, qty, variant)}
                  onClickProduct={(p) => {
                    haptic.impact('light');
                    setSelectedProduct(p);
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Storefront Seller Compliance Footer */}
        {(theme.legalName || theme.supportContact || theme.returnPolicy || theme.privacyPolicyUrl) && (
          <footer className="mt-8 p-3.5 rounded-xl bg-[var(--c-secondary)] border border-[var(--c-separator)] text-[11px] text-[var(--c-hint)] space-y-1">
            <div className="font-semibold text-[var(--c-text)] text-xs">
              {copy.sellerFooterTitle}
            </div>
            {theme.legalName && (
              <div>
                {theme.legalName}
                {theme.innOrPinfl ? ` · ИНН/ПИНФЛ ${theme.innOrPinfl}` : ''}
              </div>
            )}
            {theme.supportContact && <div>{theme.supportContact}</div>}
            {theme.deliveryTerms && <div>{theme.deliveryTerms}</div>}
            {theme.returnPolicy && <div>{theme.returnPolicy}</div>}
            {theme.privacyPolicyUrl && (
              <div>
                <a
                  href={theme.privacyPolicyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--c-link)] underline"
                >
                  {copy.privacyLink}
                </a>
              </div>
            )}
          </footer>
        )}
      </main>

      {/* Desktop / Browser Preview Fallback Bottom Bar */}
      {!isInsideTelegram &&
        items.length > 0 &&
        !isCartOpen &&
        !isCheckoutOpen &&
        !paynetPayment &&
        !orderSuccess &&
        !selectedProduct && (
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
                <span>
                  {t('cart.drawer_title')} ({totalCount})
                </span>
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
        cartItems={items}
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
        checkoutEnabled={checkoutEnabled}
        disabledBannerText={disabledBannerText}
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
        theme={theme}
        initialTelegramUser={user}
        checkoutEnabled={checkoutEnabled}
        isDemo={isDemo}
        checkoutDisabledReason={mappedDisabledReason}
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
          onCancelOrder={async () => {
            await handleCancelPendingOrder({
              orderId: paynetPayment.orderId,
              accessToken: paynetPayment.accessToken,
              amount: paynetPayment.totalAmount,
              paynetUrl: paynetPayment.paynetQrUrl,
              status: 'PENDING',
              itemsCount: paynetPayment.itemsCount,
            });
          }}
          onClose={() => {
            setPaynetPayment(null);
            setPaynetError(null);
          }}
          isConfirming={isConfirmingPaynet}
          isCancelling={isCancellingOrder}
          errorMessage={paynetError}
        />
      )}

      {/* Order Review Confirmation Modal */}
      <OrderSuccessModal
        isOpen={Boolean(orderSuccess)}
        orderId={orderSuccess?.orderId || null}
        totalAmount={orderSuccess?.totalAmount || 0}
        currency={theme.currency || 'UZS'}
        itemsCount={orderSuccess?.itemsCount}
        supportContact={theme.supportContact}
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
