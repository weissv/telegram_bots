import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { MerchantProfile, SubscriptionRecord } from '../types/index.js';
import { SubscriptionStatusBadge } from '../components/Status.js';
import { formatDate } from '../lib/format.js';
import {
  Bot,
  Save,
  CheckCircle,
  QrCode,
  ExternalLink,
  CreditCard,
  AlertCircle,
  Check,
  Bell,
  ShieldCheck,
  Copy,
  Rocket,
  XCircle,
} from 'lucide-react';

// STRICTLY for Platform SaaS Subscription billing ONLY — NEVER used for merchant storefront!
const PLATFORM_BILLING_PAYNET_QR_URL =
  "https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r2s8nPSzGNGRQjdxV0202115204531153038605802UZ5910AO'PAYNET'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63043D65";

type SelfServePlanId = 'BASIC_20' | 'PRO_30';

const BILLING_PLANS: Array<{
  id: SelfServePlanId;
  title: string;
  priceDisplay: string;
  amountUzs: number;
  description: string;
  badge?: string;
}> = [
  {
    id: 'BASIC_20',
    title: 'Basic',
    priceDisplay: '$20/мес · 255 000 сум',
    amountUzs: 255000,
    description: 'Каталог, корзина и заказы прямо в Telegram-боте.',
  },
  {
    id: 'PRO_30',
    title: 'Pro Mini App',
    priceDisplay: '$30/мес · 385 000 сум',
    amountUzs: 385000,
    description: 'Полноэкранная витрина Mini App, поиск и аналитика продаж.',
    badge: 'Популярный',
  },
];

function normalizeSelfServePlan(plan?: string): SelfServePlanId {
  const upper = (plan || '').toUpperCase();
  if (upper === 'PRO_30' || upper === 'PRO') return 'PRO_30';
  return 'BASIC_20';
}

function formatActivePlanName(plan?: string): string {
  const upper = (plan || '').toUpperCase();
  if (upper === 'PRO_30' || upper === 'PRO') return 'Pro Mini App · $30/мес';
  if (upper === 'STANDALONE_LIFETIME' || upper === 'STANDALONE') return 'Standalone VPS';
  return 'Basic · $20/мес';
}

interface SettingsProps {
  profile?: MerchantProfile | null;
  onProfileUpdated?: () => void;
  onGoToProducts?: () => void;
}

export function Settings({ profile, onProfileUpdated, onGoToProducts }: SettingsProps = {}) {
  const [storeName, setStoreName] = useState('');
  const [currency, setCurrency] = useState('UZS');
  const [ownerTelegramId, setOwnerTelegramId] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1a6fd4');
  const [bannerUrl, setBannerUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');

  // Storefront Publication & Merchant Paynet QR (EMPTY by default — NEVER platform fallback!)
  const [isActive, setIsActive] = useState(false);
  const [paynetEnabled, setPaynetEnabled] = useState(false);
  const [paynetQrUrl, setPaynetQrUrl] = useState('');

  // Legal, Delivery & Support Compliance Fields
  const [legalName, setLegalName] = useState('');
  const [innOrPinfl, setInnOrPinfl] = useState('');
  const [supportContact, setSupportContact] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('/#legal');
  const [deliveryFeeUzs, setDeliveryFeeUzs] = useState('25000');
  const [freeDeliveryThresholdUzs, setFreeDeliveryThresholdUzs] = useState('300000');
  const [deliveryTerms, setDeliveryTerms] = useState('');

  // Bot Token & Test Notification State
  const [botUsername, setBotUsername] = useState('');
  const [newBotToken, setNewBotToken] = useState('');
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<string | null>(null);
  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);
  const [testNotifStatus, setTestNotifStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Platform Subscription Billing (2-step invoice + Paynet review)
  const [selectedPlan, setSelectedPlan] = useState<SelfServePlanId>(() =>
    normalizeSelfServePlan(profile?.tenant?.plan)
  );
  const hasUserPickedPlanRef = useRef(false);
  const [activeInvoice, setActiveInvoice] = useState<{
    subscriptionId: string;
    invoiceNumber: string;
    plan: SelfServePlanId;
    amountUzs: number;
    paynetQrUrl: string;
  } | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [copiedField, setCopiedField] = useState<'invoice' | 'qr' | null>(null);
  const [platformQrError, setPlatformQrError] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isConfirmingBilling, setIsConfirmingBilling] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.tenant?.plan && !hasUserPickedPlanRef.current) {
      setSelectedPlan(normalizeSelfServePlan(profile.tenant.plan));
    }
  }, [profile?.tenant?.plan]);

  useEffect(() => {
    const latestSub: SubscriptionRecord | undefined =
      profile?.subscription ||
      profile?.latestSubscription ||
      profile?.tenant?.subscriptions?.[0];
    if (
      latestSub &&
      latestSub.status === 'PENDING_PAYMENT' &&
      latestSub.invoice_number &&
      !activeInvoice
    ) {
      const planId = normalizeSelfServePlan(latestSub.plan);
      setActiveInvoice({
        subscriptionId: latestSub.id,
        invoiceNumber: latestSub.invoice_number,
        plan: planId,
        amountUzs:
          latestSub.amount_uzs ||
          BILLING_PLANS.find((p) => p.id === planId)?.amountUzs ||
          255000,
        paynetQrUrl: PLATFORM_BILLING_PAYNET_QR_URL,
      });
    }
  }, [profile, activeInvoice]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await apiRequest<{
          tenant: { name: string; owner_telegram_id: string };
          botConfig: {
            botUsername?: string;
            currency?: string;
            isActive?: boolean;
            is_active?: boolean;
            themeConfig?: Record<string, any>;
          };
        }>('/api/v1/admin/settings');

        if (data.tenant) {
          setStoreName(data.tenant.name || '');
          setOwnerTelegramId(data.tenant.owner_telegram_id || '');
        }
        if (data.botConfig) {
          setBotUsername(data.botConfig.botUsername || '');
          setCurrency(data.botConfig.currency || 'UZS');
          const activeFlag =
            data.botConfig.isActive !== undefined
              ? data.botConfig.isActive
              : Boolean(data.botConfig.is_active);
          setIsActive(Boolean(activeFlag));

          const tc = data.botConfig.themeConfig || {};
          setPrimaryColor(tc.primaryColor || '#1a6fd4');
          setBannerUrl(tc.bannerUrl || '');
          setLogoUrl(tc.logoUrl || '');
          setDescription(tc.description || '');
          setPaynetEnabled(Boolean(tc.paynetEnabled));
          // Strictly use merchant's own saved QR URL (or empty string — NEVER platform QR!)
          const rawMerchantQr = typeof tc.paynetQrUrl === 'string' ? tc.paynetQrUrl : '';
          setPaynetQrUrl(
            rawMerchantQr === PLATFORM_BILLING_PAYNET_QR_URL ? '' : rawMerchantQr
          );

          setLegalName(tc.legalName || '');
          setInnOrPinfl(tc.innOrPinfl || '');
          setSupportContact(tc.supportContact || '');
          setReturnPolicy(
            tc.returnPolicy ||
              'Возврат и обмен товара надлежащего качества в течение 10 дней согласно Закону РУз о защите прав потребителей.'
          );
          setPrivacyPolicyUrl(tc.privacyPolicyUrl || '/#legal');
          setDeliveryFeeUzs(
            tc.deliveryFeeUzs !== undefined ? String(tc.deliveryFeeUzs) : '25000'
          );
          setFreeDeliveryThresholdUzs(
            tc.freeDeliveryThresholdUzs !== undefined
              ? String(tc.freeDeliveryThresholdUzs)
              : '300000'
          );
          setDeliveryTerms(
            tc.deliveryTerms || 'Доставка по Ташкенту 1–2 дня, по Узбекистану 2–5 дней.'
          );
        }
      } catch (err: any) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await apiRequest('/api/v1/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          storeName: storeName.trim(),
          currency,
          ownerTelegramId: ownerTelegramId.trim(),
          isActive,
          themeConfig: {
            storeName: storeName.trim(),
            primaryColor,
            bannerUrl: bannerUrl.trim(),
            logoUrl: logoUrl.trim(),
            description: description.trim(),
            paynetEnabled,
            paynetQrUrl: paynetQrUrl.trim(),
            legalName: legalName.trim(),
            innOrPinfl: innOrPinfl.trim(),
            supportContact: supportContact.trim(),
            returnPolicy: returnPolicy.trim(),
            privacyPolicyUrl: privacyPolicyUrl.trim() || '/#legal',
            deliveryFeeUzs: Math.max(0, Number(deliveryFeeUzs) || 0),
            freeDeliveryThresholdUzs: Math.max(0, Number(freeDeliveryThresholdUzs) || 0),
            deliveryTerms: deliveryTerms.trim(),
          },
        }),
      });
      setSaveSuccess(true);
      onProfileUpdated?.();
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setSaveError(err?.message || 'Ошибка сохранения настроек');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateBotToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotToken.trim()) return;

    setIsUpdatingToken(true);
    setTokenStatus(null);

    try {
      const res = await apiRequest<{ botUsername?: string }>(
        '/api/v1/admin/settings/bot-token',
        {
          method: 'POST',
          body: JSON.stringify({ botToken: newBotToken.trim() }),
        }
      );
      if (res.botUsername) {
        setBotUsername(res.botUsername);
      }
      setTokenStatus('Токен успешно проверен, webhook зарегистрирован!');
      setNewBotToken('');
      onProfileUpdated?.();
    } catch (err: any) {
      setTokenStatus(`Ошибка: ${err.message}`);
    } finally {
      setIsUpdatingToken(false);
    }
  };

  const handleSendTestNotification = async () => {
    setIsSendingTestNotif(true);
    setTestNotifStatus(null);
    try {
      const res = await apiRequest<{ message?: string }>(
        '/api/v1/admin/settings/test-notification',
        { method: 'POST', body: JSON.stringify({}) }
      );
      setTestNotifStatus({
        type: 'success',
        text: res.message || 'Тестовое уведомление отправлено в ваш Telegram!',
      });
    } catch (err: any) {
      setTestNotifStatus({
        type: 'error',
        text: err?.message || 'Не удалось отправить тестовое уведомление.',
      });
    } finally {
      setIsSendingTestNotif(false);
    }
  };

  const handleCreateBillingInvoice = async () => {
    setIsCreatingInvoice(true);
    setBillingError(null);
    setBillingSuccess(null);

    try {
      const res = await apiRequest<{
        subscription?: {
          id: string;
          invoice_number?: string;
          amount_uzs?: number;
          plan?: string;
        };
        invoiceNumber?: string;
        subscriptionId?: string;
        priceUzs?: number;
        paynetQrUrl?: string;
      }>('/api/v1/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan: selectedPlan,
          tenantId: profile?.tenant?.id,
        }),
      });

      const subId = res.subscription?.id || res.subscriptionId || '';
      const invNum = res.subscription?.invoice_number || res.invoiceNumber || '';
      const amountUzs =
        res.subscription?.amount_uzs ||
        res.priceUzs ||
        BILLING_PLANS.find((p) => p.id === selectedPlan)?.amountUzs ||
        255000;

      setActiveInvoice({
        subscriptionId: subId,
        invoiceNumber: invNum,
        plan: selectedPlan,
        amountUzs,
        paynetQrUrl: res.paynetQrUrl || PLATFORM_BILLING_PAYNET_QR_URL,
      });
      setPaymentReference('');
      onProfileUpdated?.();
    } catch (err: any) {
      setBillingError(err?.message || 'Не удалось выставить счёт на оплату');
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleConfirmBillingPaynet = async () => {
    if (!activeInvoice) return;

    setIsConfirmingBilling(true);
    setBillingSuccess(null);
    setBillingError(null);

    try {
      await apiRequest('/api/v1/billing/confirm-paynet', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: profile?.tenant?.id,
          telegramUserId: ownerTelegramId || profile?.tenant?.ownerTelegramId,
          plan: activeInvoice.plan,
          subscriptionId: activeInvoice.subscriptionId || undefined,
          invoiceNumber: activeInvoice.invoiceNumber || undefined,
          paymentReference: paymentReference.trim() || undefined,
        }),
      });

      setBillingSuccess(
        `Заявка по счёту ${activeInvoice.invoiceNumber} отправлена на проверку администратору платформы. После подтверждения подписка будет продлена на +30 дней.`
      );
      setActiveInvoice(null);
      hasUserPickedPlanRef.current = false;
      onProfileUpdated?.();
    } catch (err: any) {
      setBillingError(err?.message || 'Не удалось отправить подтверждение оплаты тарифа');
    } finally {
      setIsConfirmingBilling(false);
    }
  };

  const handleCopy = async (field: 'invoice' | 'qr', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((c) => (c === field ? null : c)), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const readiness = profile?.readiness || {
    botConnected: Boolean(botUsername),
    paynetConfigured: Boolean(
      paynetEnabled && paynetQrUrl.trim().startsWith('https://app.paynet.uz/qr-online/')
    ),
    legalConfigured: Boolean(legalName.trim() && supportContact.trim()),
    hasActiveProduct: true,
    canPublish: Boolean(botUsername),
  };

  const currentSubscription =
    profile?.subscription ||
    profile?.latestSubscription ||
    profile?.tenant?.subscriptions?.[0];

  const subscriptionStatus =
    profile?.tenant?.subscriptionStatus ||
    currentSubscription?.status ||
    'PENDING_PAYMENT';

  const latestSubPeriodEnd = currentSubscription?.current_period_end;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1>Настройки магазина</h1>
        <p className="hint">
          Юридические реквизиты, доставка, Paynet QR продавца, Telegram-бот и публикация витрины.
        </p>
      </div>

      {/* Readiness Checklist & Storefront Publish Card */}
      <section className="rounded-md border border-line bg-paper p-5 space-y-4">
        <div className="border-b border-line pb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-ink shrink-0" />
            <div>
              <h2>Готовность к запуску / Публикация витрины</h2>
              <p className="hint">
                Чтобы принимать заказы, выполните обязательные шаги и включите публикацию витрины.
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded text-xs font-semibold border ${
              isActive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {isActive ? 'Витрина опубликована' : 'Черновик (скрыта)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {[
            {
              ok: readiness.botConnected,
              label: 'Telegram-бот подключён (@BotFather)',
            },
            {
              ok: readiness.paynetConfigured,
              label: 'Указан и включён Paynet QR-Online магазина',
            },
            {
              ok: readiness.legalConfigured,
              label: 'Заполнены юр. наименование и контакт поддержки',
            },
            {
              ok: readiness.hasActiveProduct,
              label: 'Добавлен минимум 1 активный товар в каталог',
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`p-2.5 rounded-md border flex items-center gap-2 ${
                item.ok
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                  : 'bg-subtle/50 border-line text-muted'
              }`}
            >
              {item.ok ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {!readiness.hasActiveProduct && onGoToProducts && (
          <div className="text-xs">
            <button type="button" onClick={onGoToProducts} className="link font-medium">
              Перейти к добавлению товаров →
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-line text-ink focus:ring-0"
            />
            <span className="text-sm font-medium text-ink">
              Опубликовать витрину и разрешить приём заказов (isActive)
            </span>
          </label>
          <span className="text-xs text-muted">
            Не забудьте нажать «Сохранить настройки» ниже.
          </span>
        </div>
      </section>

      {saveSuccess && (
        <div className="p-3.5 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span>Настройки магазина успешно сохранены.</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* General Store Details */}
        <section className="rounded-md border border-line bg-paper p-5 space-y-4">
          <div className="border-b border-line pb-3">
            <h2>Основные данные</h2>
            <p className="hint">Название витрины и Telegram ID владельца для уведомлений о заказах.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Название магазина</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Основная валюта</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input cursor-pointer"
              >
                <option value="UZS">UZS (so'm - Узбекский сум)</option>
                <option value="USD">USD ($ - Доллар США)</option>
                <option value="RUB">RUB (₽ - Российский рубль)</option>
                <option value="EUR">EUR (€ - Евро)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="label">Telegram ID владельца (для уведомлений о заказах)</label>
            <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
              <input
                type="text"
                value={ownerTelegramId}
                onChange={(e) => setOwnerTelegramId(e.target.value)}
                placeholder="123456789"
                className="input font-mono flex-1"
              />
              <button
                type="button"
                disabled={isSendingTestNotif}
                onClick={handleSendTestNotification}
                className="btn-secondary whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>
                  {isSendingTestNotif
                    ? 'Отправка…'
                    : 'Отправить тестовое уведомление в Telegram'}
                </span>
              </button>
            </div>
            <p className="hint">
              Сюда бот присылает уведомления о новых заказах. Сначала нажмите /start в вашем магазине-боте.
            </p>
            {testNotifStatus && (
              <div
                className={`p-2.5 rounded-md text-xs border ${
                  testNotifStatus.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {testNotifStatus.text}
              </div>
            )}
          </div>
        </section>

        {/* Legal, Support & Delivery Compliance */}
        <section className="rounded-md border border-line bg-paper p-5 space-y-4">
          <div className="border-b border-line pb-3 flex items-start justify-between gap-3">
            <div>
              <h2>Юридические реквизиты, доставка и поддержка</h2>
              <p className="hint">
                Отображаются покупателю в Mini App и боте до подтверждения заказа.
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-muted shrink-0" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Юридическое наименование (ИП / Самозанятый / ООО) *</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Например: ЯТТ Рахимов А.Б. / ООО Moda Store"
                className="input"
              />
            </div>

            <div>
              <label className="label">ИНН / ПИНФЛ</label>
              <input
                type="text"
                value={innOrPinfl}
                onChange={(e) => setInnOrPinfl(e.target.value)}
                placeholder="309123456 или 31234567890012"
                className="input font-mono"
              />
            </div>

            <div>
              <label className="label">Контакт поддержки покупателей *</label>
              <input
                type="text"
                value={supportContact}
                onChange={(e) => setSupportContact(e.target.value)}
                placeholder="@store_support или +998 90 123-45-67"
                className="input"
              />
            </div>

            <div>
              <label className="label">Ссылка на политику конфиденциальности</label>
              <input
                type="text"
                value={privacyPolicyUrl}
                onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                placeholder="/#legal или https://..."
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Стоимость курьерской доставки (сум)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={deliveryFeeUzs}
                onChange={(e) => setDeliveryFeeUzs(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Порог бесплатной доставки (сум, 0 = отключено)</label>
              <input
                type="number"
                min="0"
                step="10000"
                value={freeDeliveryThresholdUzs}
                onChange={(e) => setFreeDeliveryThresholdUzs(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Условия и сроки доставки</label>
            <input
              type="text"
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
              placeholder="Доставка по Ташкенту 1–2 дня, по Узбекистану 2–5 дней."
              className="input"
            />
          </div>

          <div>
            <label className="label">Политика возврата и обмена</label>
            <textarea
              rows={2}
              value={returnPolicy}
              onChange={(e) => setReturnPolicy(e.target.value)}
              placeholder="Условия возврата товара ненадлежащего и надлежащего качества..."
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
        </section>

        {/* Branding & Theme */}
        <section className="rounded-md border border-line bg-paper p-5 space-y-4">
          <div className="border-b border-line pb-3">
            <h2>Внешний вид Mini App</h2>
            <p className="hint">Брендирование и логотип, отображаемые внутри Telegram витрины.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">URL логотипа магазина</label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="input"
              />
            </div>

            <div>
              <label className="label">URL баннера шапки</label>
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://..."
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Краткое описание магазина</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Официальный магазин одежды и обуви с доставкой."
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
        </section>

        {/* Payment Systems: Merchant's Own Paynet QR */}
        <section className="rounded-md border border-line bg-paper p-5 space-y-4">
          <div className="border-b border-line pb-3 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2>Оплата Paynet QR-Online вашего магазина</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  0% по условиям Paynet (самозанятые / ИП)
                </span>
              </div>
              <p className="hint">
                Вставьте персональную ссылку Paynet QR-Online из вашего личного кабинета Paynet Бизнес. Для ООО условия комиссии определяются договором с Paynet.
              </p>
            </div>
            <QrCode className="w-5 h-5 text-muted shrink-0" />
          </div>

          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={paynetEnabled}
                onChange={(e) => setPaynetEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-line text-ink focus:ring-0"
              />
              <span className="text-sm font-medium">
                Включить оплату через Paynet QR-Online в витрине и боте
              </span>
            </label>

            <div>
              <label className="label">Персональная ссылка Paynet QR-Online мерчанта</label>
              <input
                type="text"
                value={paynetQrUrl}
                onChange={(e) => setPaynetQrUrl(e.target.value)}
                placeholder="https://app.paynet.uz/qr-online/..."
                className="input font-mono text-xs"
              />
              <div className="hint mt-1.5 flex items-center justify-between gap-2">
                <span>
                  Укажите именно ваш QR-URL из Paynet Бизнес. Без него онлайн-оплата в магазине будет отключена.
                </span>
                {paynetQrUrl && (
                  <a
                    href={paynetQrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="link inline-flex items-center gap-0.5 font-medium ml-2 shrink-0"
                  >
                    Проверить <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" disabled={isSaving} className="btn-primary">
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Сохранение…' : 'Сохранить настройки'}</span>
            </button>
          </div>
        </section>
      </form>

      {/* Bot Connection Section */}
      <section className="rounded-md border border-line bg-paper p-5 space-y-4">
        <div className="border-b border-line pb-3">
          <h2>Подключение Telegram-бота</h2>
          <p className="hint">
            Токен бота от @BotFather. Позволяет боту отвечать покупателям и открывать Mini App.
          </p>
        </div>

        {botUsername ? (
          <div className="p-3.5 rounded-md bg-subtle/50 border border-line flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-ink text-paper flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">@{botUsername}</div>
                <div className="text-xs text-green-700 font-medium">
                  Бот подключён и webhook настроен
                </div>
              </div>
            </div>
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary !h-8 text-xs"
            >
              Открыть в Telegram
            </a>
          </div>
        ) : (
          <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-md border border-amber-200">
            Telegram-бот пока не привязан. Введите токен от @BotFather ниже, чтобы активировать продажи через Telegram.
          </div>
        )}

        <form onSubmit={handleUpdateBotToken} className="space-y-3 pt-2">
          <div>
            <label className="label">
              {botUsername ? 'Обновить токен бота' : 'Токен бота от @BotFather'}
            </label>
            <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
              <input
                type="password"
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                value={newBotToken}
                onChange={(e) => setNewBotToken(e.target.value)}
                className="input font-mono flex-1"
              />
              <button
                type="submit"
                disabled={isUpdatingToken || !newBotToken.trim()}
                className="btn-secondary whitespace-nowrap"
              >
                {isUpdatingToken ? 'Проверка…' : 'Подключить токен'}
              </button>
            </div>
            {tokenStatus && (
              <p
                className={`mt-2 text-xs font-medium ${
                  tokenStatus.startsWith('Ошибка') ? 'text-red-700' : 'text-green-700'
                }`}
              >
                {tokenStatus}
              </p>
            )}
          </div>
        </form>
      </section>

      {/* Platform Subscription & Paynet Billing Section */}
      <section className="rounded-md border border-line bg-paper p-5 space-y-5">
        <div className="border-b border-line pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-ink shrink-0" />
              <h2>Тариф и оплата подписки (Mirai Commerce)</h2>
            </div>
            <p className="hint">
              Выставьте счёт на тариф и оплатите через Paynet QR-Online платформы.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-medium text-ink px-2.5 py-1 rounded bg-subtle border border-line">
              {formatActivePlanName(profile?.tenant?.plan)}
            </span>
            <SubscriptionStatusBadge status={subscriptionStatus} />
          </div>
        </div>

        {latestSubPeriodEnd && subscriptionStatus === 'ACTIVE' && (
          <div className="text-xs text-muted">
            Подписка оплачена до: <strong className="text-ink">{formatDate(latestSubPeriodEnd)}</strong>
          </div>
        )}

        {subscriptionStatus === 'PENDING_REVIEW' && (
          <div className="p-3 rounded-md bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span>
              Последняя заявка об оплате тарифа находится на проверке у администратора платформы. После подтверждения период подписки увеличится на +30 дней.
            </span>
          </div>
        )}

        {/* Plan Selector Cards (Basic & Pro only) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BILLING_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isCurrent = normalizeSelfServePlan(profile?.tenant?.plan) === plan.id;

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  hasUserPickedPlanRef.current = true;
                  setSelectedPlan(plan.id);
                  setActiveInvoice(null);
                  setBillingError(null);
                  setBillingSuccess(null);
                }}
                className={`text-left p-4 rounded-md border transition-colors flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-ink bg-subtle/60 ring-1 ring-ink'
                    : 'border-line bg-paper hover:bg-subtle/30'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{plan.title}</span>
                    {isCurrent && subscriptionStatus === 'ACTIVE' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        Текущий
                      </span>
                    ) : plan.badge ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-subtle text-muted border border-line">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm font-bold text-ink tabular">{plan.priceDisplay}</div>
                  <p className="text-xs text-muted leading-relaxed">{plan.description}</p>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-ink bg-ink text-paper' : 'border-line'
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5" />}
                  </span>
                  <span className={isSelected ? 'text-ink' : 'text-muted'}>
                    {isSelected ? 'Выбрано к оплате' : 'Выбрать тариф'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Standalone VPS Turnkey Note */}
        <div className="p-3 rounded-md bg-subtle/50 border border-line text-xs text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            Нужно автономное развёртывание <strong>Standalone VPS</strong> на вашем сервере? Оформляется индивидуально под ключ через менеджера.
          </span>
          <a
            href="https://t.me/miraiedu_bot"
            target="_blank"
            rel="noreferrer"
            className="link font-medium inline-flex items-center gap-1 shrink-0"
          >
            <span>Запросить в @miraiedu_bot</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Step 1 or Step 2 Invoice Payment */}
        {!activeInvoice ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div className="text-xs text-muted">
              Шаг 1: Выставите счёт на выбранный тариф, затем оплатите по QR и отправьте на проверку.
            </div>
            <button
              type="button"
              disabled={isCreatingInvoice}
              onClick={handleCreateBillingInvoice}
              className="btn-primary whitespace-nowrap"
            >
              {isCreatingInvoice ? 'Создание счёта…' : 'Выставить счёт на оплату'}
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-line bg-subtle/30 p-4 flex flex-col sm:flex-row items-center gap-5">
            <div className="w-44 h-44 bg-white rounded-md border border-line p-2 flex items-center justify-center shrink-0">
              {platformQrError ? (
                <div className="text-center space-y-1.5 px-2">
                  <QrCode className="w-8 h-8 text-emerald-700 mx-auto" />
                  <p className="text-[11px] font-medium text-ink">QR-код недоступен</p>
                  <p className="text-[10px] text-muted">Используйте кнопку Paynet справа</p>
                </div>
              ) : (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
                    activeInvoice.paynetQrUrl
                  )}`}
                  alt="Paynet QR-Online для оплаты тарифа Mirai Commerce"
                  onError={() => setPlatformQrError(true)}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="flex-1 space-y-3 w-full">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Paynet QR-Online платформы
                  </span>
                  <span className="px-2 py-0.5 rounded bg-paper border border-line font-mono text-xs font-semibold text-ink">
                    {activeInvoice.invoiceNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('invoice', activeInvoice.invoiceNumber)}
                    className="text-[11px] link inline-flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedField === 'invoice' ? 'Скопировано' : 'Копировать счёт'}</span>
                  </button>
                </div>
                <div className="text-sm font-semibold text-ink">
                  К оплате: {BILLING_PLANS.find((p) => p.id === activeInvoice.plan)?.title} ·{' '}
                  {activeInvoice.amountUzs.toLocaleString('ru-RU')} сум
                </div>
                <p className="text-xs text-muted">
                  Отсканируйте QR или перейдите по ссылке Paynet. После оплаты укажите номер квитанции (если есть) и отправьте заявку на проверку.
                </p>
              </div>

              <div>
                <label className="label text-xs">
                  Номер транзакции / квитанции Paynet (необязательно)
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Например: чек №123456"
                  className="input font-mono text-xs max-w-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <a
                  href={activeInvoice.paynetQrUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary !border-emerald-600/30 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100"
                >
                  <span>⚡ Оплатить через Paynet QR-Online</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => handleCopy('qr', activeInvoice.paynetQrUrl)}
                  className="btn-secondary"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedField === 'qr' ? 'Ссылка скопирована' : 'Копировать ссылку'}</span>
                </button>

                <button
                  type="button"
                  disabled={isConfirmingBilling}
                  onClick={handleConfirmBillingPaynet}
                  className="btn-primary"
                >
                  <span>
                    {isConfirmingBilling ? 'Отправка…' : '✅ Я оплатил тариф'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {billingSuccess && (
          <div className="p-3.5 rounded-md bg-sky-50 border border-sky-200 text-sky-900 text-sm flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span>{billingSuccess}</span>
          </div>
        )}

        {billingError && (
          <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{billingError}</span>
          </div>
        )}
      </section>
    </div>
  );
}
