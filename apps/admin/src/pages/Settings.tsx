import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { MerchantProfile } from '../types/index.js';
import {
  Bot,
  Save,
  CheckCircle,
  QrCode,
  ExternalLink,
  CreditCard,
  AlertCircle,
  Check,
} from 'lucide-react';

const DEFAULT_PAYNET_LINK =
  'https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r2s8nPSzGNGRQjdxV0202115204531153038605802UZ5910AO\'PAYNET\'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63043D65';

const PLATFORM_PAYNET_QR_IMG = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
  DEFAULT_PAYNET_LINK
)}`;

type PlanTierId = 'BASIC_20' | 'PRO_30' | 'STANDALONE_LIFETIME';

const BILLING_PLANS: Array<{
  id: PlanTierId;
  title: string;
  priceDisplay: string;
  description: string;
  badge?: string;
}> = [
  {
    id: 'BASIC_20',
    title: 'Basic',
    priceDisplay: '$20/мес · 255 000 сум',
    description: 'Каталог, корзина и заказы прямо в Telegram-боте.',
  },
  {
    id: 'PRO_30',
    title: 'Pro Mini App',
    priceDisplay: '$30/мес · 385 000 сум',
    description: 'Полноэкранная витрина Mini App, поиск и аналитика продаж.',
    badge: 'Популярный',
  },
  {
    id: 'STANDALONE_LIFETIME',
    title: 'Standalone Lifetime',
    priceDisplay: '$350 · 4 500 000 сум',
    description: 'Развертывание на вашем сервере разово без подписки.',
    badge: 'Навсегда',
  },
];

function normalizePlanTier(plan?: string): PlanTierId {
  const upper = (plan || '').toUpperCase();
  if (upper === 'PRO_30' || upper === 'PRO') return 'PRO_30';
  if (upper === 'STANDALONE_LIFETIME' || upper === 'STANDALONE') return 'STANDALONE_LIFETIME';
  return 'BASIC_20';
}

function formatActivePlanName(plan?: string): string {
  const tier = normalizePlanTier(plan);
  if (tier === 'PRO_30') return 'Pro Mini App $30/мес';
  if (tier === 'STANDALONE_LIFETIME') return 'Standalone Lifetime $350';
  return 'Basic $20/мес';
}

interface SettingsProps {
  profile?: MerchantProfile | null;
  onProfileUpdated?: () => void;
}

export function Settings({ profile, onProfileUpdated }: SettingsProps = {}) {
  const [storeName, setStoreName] = useState('');
  const [currency, setCurrency] = useState('UZS');
  const [ownerTelegramId, setOwnerTelegramId] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1a6fd4');
  const [bannerUrl, setBannerUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');

  // Paynet Xolis (0% for Self-Employed)
  const [paynetEnabled, setPaynetEnabled] = useState(true);
  const [paynetQrUrl, setPaynetQrUrl] = useState(DEFAULT_PAYNET_LINK);

  // Bot Token state
  const [botUsername, setBotUsername] = useState('');
  const [newBotToken, setNewBotToken] = useState('');
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Platform Subscription Billing (Paynet QR-Online)
  const [selectedPlan, setSelectedPlan] = useState<PlanTierId>(() =>
    normalizePlanTier(profile?.tenant?.plan)
  );
  const hasUserPickedPlanRef = useRef(false);
  const [platformQrError, setPlatformQrError] = useState(false);
  const [isConfirmingBilling, setIsConfirmingBilling] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.tenant?.plan && !hasUserPickedPlanRef.current) {
      setSelectedPlan(normalizePlanTier(profile.tenant.plan));
    }
  }, [profile?.tenant?.plan]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await apiRequest<{
          tenant: { name: string; owner_telegram_id: string };
          botConfig: {
            botUsername?: string;
            currency?: string;
            themeConfig?: {
              primaryColor?: string;
              bannerUrl?: string;
              logoUrl?: string;
              description?: string;
              paynetEnabled?: boolean;
              paynetQrUrl?: string;
            };
          };
        }>('/api/v1/admin/settings');

        if (data.tenant) {
          setStoreName(data.tenant.name || '');
          setOwnerTelegramId(data.tenant.owner_telegram_id || '');
        }
        if (data.botConfig) {
          setBotUsername(data.botConfig.botUsername || '');
          setCurrency(data.botConfig.currency || 'UZS');
          const tc = data.botConfig.themeConfig || {};
          setPrimaryColor(tc.primaryColor || '#1a6fd4');
          setBannerUrl(tc.bannerUrl || '');
          setLogoUrl(tc.logoUrl || '');
          setDescription(tc.description || '');
          setPaynetEnabled(tc.paynetEnabled !== undefined ? tc.paynetEnabled : true);
          setPaynetQrUrl(tc.paynetQrUrl || DEFAULT_PAYNET_LINK);
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

    try {
      await apiRequest('/api/v1/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          storeName,
          currency,
          ownerTelegramId,
          themeConfig: {
            storeName,
            primaryColor,
            bannerUrl,
            logoUrl,
            description,
            paynetEnabled,
            paynetQrUrl,
          },
        }),
      });
      setSaveSuccess(true);
      onProfileUpdated?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Ошибка сохранения: ${err.message}`);
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
      const res = await apiRequest<{ botUsername?: string }>('/api/v1/admin/settings/bot-token', {
        method: 'POST',
        body: JSON.stringify({ botToken: newBotToken.trim() }),
      });
      if (res.botUsername) {
        setBotUsername(res.botUsername);
      }
      setTokenStatus('Токен успешно проверен и подключен!');
      setNewBotToken('');
      onProfileUpdated?.();
    } catch (err: any) {
      setTokenStatus(`Ошибка: ${err.message}`);
    } finally {
      setIsUpdatingToken(false);
    }
  };

  const handleConfirmBillingPaynet = async () => {
    setIsConfirmingBilling(true);
    setBillingSuccess(null);
    setBillingError(null);

    try {
      await apiRequest('/api/v1/billing/confirm-paynet', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: profile?.tenant?.id,
          telegramUserId: ownerTelegramId || profile?.tenant?.ownerTelegramId,
          plan: selectedPlan,
        }),
      });

      const chosen = BILLING_PLANS.find((p) => p.id === selectedPlan);
      setBillingSuccess(
        `Оплата тарифа «${chosen?.title || selectedPlan}» подтверждена! Подписка активна, уведомление отправлено администратору.`
      );
      hasUserPickedPlanRef.current = false;
      onProfileUpdated?.();
    } catch (err: any) {
      setBillingError(err?.message || 'Не удалось подтвердить оплату тарифа');
    } finally {
      setIsConfirmingBilling(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1>Настройки магазина</h1>
        <p className="hint">Параметры магазина, валюта, Telegram-бот и внешний вид витрины.</p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span>Настройки успешно сохранены.</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* General Store Details */}
        <section className="rounded-md border border-line bg-paper p-5 space-y-4">
          <div className="border-b border-line pb-3">
            <h2>Основные данные</h2>
            <p className="hint">Название витрины и идентификатор владельца для уведомлений.</p>
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
                <option value="USD">USD ($ - Доллар США)</option>
                <option value="EUR">EUR (€ - Евро)</option>
                <option value="RUB">RUB (₽ - Российский рубль)</option>
                <option value="UZS">UZS (so'm - Узбекский сум)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Telegram ID владельца (для уведомлений о заказах)</label>
            <input
              type="text"
              value={ownerTelegramId}
              onChange={(e) => setOwnerTelegramId(e.target.value)}
              placeholder="123456789"
              className="input font-mono max-w-md"
            />
            <p className="hint">На этот ID бот будет присылать мгновенные уведомления о новых заказах.</p>
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

        {/* Payment Systems: Paynet Xolis for Self-Employed */}
        <section className="rounded-md border border-line bg-paper p-5 space-y-4">
          <div className="border-b border-line pb-3 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2>Оплата Paynet Xolis (0% комиссия)</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  Для самозанятых РУз
                </span>
              </div>
              <p className="hint">
                Приём платежей по государственной системе QR-Online (Soliq / ЦБ РУз). 0% комиссии с продаж, прямое зачисление в приложение Paynet.
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
                Активировать Paynet Xolis в корзине витрины и Telegram-боте
              </span>
            </label>

            <div>
              <label className="label">Ссылка или EMVCo QR-код мерчанта Paynet</label>
              <input
                type="text"
                value={paynetQrUrl}
                onChange={(e) => setPaynetQrUrl(e.target.value)}
                placeholder="https://app.paynet.uz/qr-online/..."
                className="input font-mono text-xs"
              />
              <div className="hint mt-1.5 flex items-center justify-between">
                <span>Скопируйте вашу персональную ссылку из приложения Paynet Бизнес (раздел «QR-online / Холис»).</span>
                {paynetQrUrl && (
                  <a
                    href={paynetQrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5 font-medium ml-2 shrink-0"
                  >
                    Тест ссылки <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Сохранение…' : 'Сохранить изменения'}</span>
            </button>
          </div>
        </section>
      </form>

      {/* Bot Connection Section */}
      <section className="rounded-md border border-line bg-paper p-5 space-y-4">
        <div className="border-b border-line pb-3">
          <h2>Подключение Telegram-бота</h2>
          <p className="hint">
            Токен бота от @BotFather. Позволяет боту автоматически отвечать клиентам и открывать Mini App.
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
                <div className="text-xs text-green-700 font-medium">Бот активен и подключен</div>
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
          <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
            Telegram-бот пока не привязан. Введите токен ниже, чтобы активировать продажи через Telegram.
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
              Выберите тариф и оплатите подписку через Paynet QR-Online без комиссии.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-subtle border border-line text-xs font-medium text-ink self-start sm:self-auto">
            <span className="text-muted">Текущий тариф:</span>
            <span className="font-semibold">{formatActivePlanName(profile?.tenant?.plan)}</span>
          </div>
        </div>

        {/* Plan Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {BILLING_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isCurrent = normalizePlanTier(profile?.tenant?.plan) === plan.id;

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  hasUserPickedPlanRef.current = true;
                  setSelectedPlan(plan.id);
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
                    {isCurrent ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        Активен
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

        {/* Platform Owner Paynet QR + Action Buttons */}
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
                src={PLATFORM_PAYNET_QR_IMG}
                alt="Paynet QR-Online для оплаты тарифа Mirai Commerce"
                onError={() => setPlatformQrError(true)}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Paynet QR-Online · 0% комиссия
              </div>
              <div className="text-sm font-semibold text-ink">
                К оплате:{' '}
                {BILLING_PLANS.find((p) => p.id === selectedPlan)?.title} (
                {BILLING_PLANS.find((p) => p.id === selectedPlan)?.priceDisplay})
              </div>
              <p className="text-xs text-muted">
                Отсканируйте QR-код в приложении Paynet или откройте прямую ссылку оплаты. После перевода нажмите кнопку подтверждения ниже.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <a
                href={DEFAULT_PAYNET_LINK}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary !border-emerald-600/30 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100"
              >
                <span>⚡ Оплатить через Paynet QR-Online</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                disabled={isConfirmingBilling}
                onClick={handleConfirmBillingPaynet}
                className="btn-primary"
              >
                <span>
                  {isConfirmingBilling ? 'Подтверждение…' : '✅ Я оплатил тариф'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {billingSuccess && (
          <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{billingSuccess}</span>
          </div>
        )}

        {billingError && (
          <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{billingError}</span>
          </div>
        )}
      </section>
    </div>
  );
}
