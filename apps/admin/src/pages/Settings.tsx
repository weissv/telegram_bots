import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { Bot, Save, Key, ShieldCheck, Palette, Store, CheckCircle, QrCode, ExternalLink } from 'lucide-react';

const DEFAULT_PAYNET_LINK =
  'https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r2s8nPSzGNGRQjdxV0202115204531153038605802UZ5910AO\'PAYNET\'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63043D65';

export function Settings() {
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
    } catch (err: any) {
      setTokenStatus(`Ошибка: ${err.message}`);
    } finally {
      setIsUpdatingToken(false);
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
    </div>
  );
}
