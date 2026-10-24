import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { Bot, Save, Key, ShieldCheck, Palette, Store, CheckCircle } from 'lucide-react';

export function Settings() {
  const [storeName, setStoreName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [ownerTelegramId, setOwnerTelegramId] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9');
  const [bannerUrl, setBannerUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');

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
        const data = await apiRequest('/api/v1/admin/settings');
        if (data.tenant) {
          setStoreName(data.tenant.name || '');
          setOwnerTelegramId(data.tenant.owner_telegram_id || '');
        }
        if (data.botConfig) {
          setBotUsername(data.botConfig.botUsername || '');
          setCurrency(data.botConfig.currency || 'USD');
          const tc = data.botConfig.themeConfig || {};
          setPrimaryColor(tc.primaryColor || '#0ea5e9');
          setBannerUrl(tc.bannerUrl || '');
          setLogoUrl(tc.logoUrl || '');
          setDescription(tc.description || '');
        }
      } catch (err) {
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

  const handleUpdateBotToken = async () => {
    if (!newBotToken) return;
    setIsUpdatingToken(true);
    setTokenStatus(null);

    try {
      const data = await apiRequest('/api/v1/admin/settings/bot-token', {
        method: 'POST',
        body: JSON.stringify({ botToken: newBotToken }),
      });
      setBotUsername(data.botUsername);
      setTokenStatus(`✅ Бот успешно подключен: @${data.botUsername}! Вебхук зарегистрирован.`);
      setNewBotToken('');
    } catch (err: any) {
      setTokenStatus(`❌ Ошибка: ${err.message}`);
    } finally {
      setIsUpdatingToken(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Настройки витрины и бота</h1>
        <p className="text-sm text-slate-400">Брендинг магазина, интеграция Telegram-бота и уведомления.</p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold animate-in fade-in flex items-center gap-2">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>Настройки успешно сохранены, витрина обновлена!</span>
        </div>
      )}

      {/* General & Theme Settings */}
      <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Store className="w-5 h-5 text-sky-400" />
          <h3 className="text-base font-bold text-slate-100">Брендинг витрины</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Название магазина</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Основная валюта</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="RUB">RUB (₽) — Российский рубль</option>
              <option value="USD">USD ($) — Доллар США</option>
              <option value="EUR">EUR (€) — Евро</option>
              <option value="GBP">GBP (£) — Британский фунт</option>
              <option value="UZS">UZS (so'm) — Узбекский сум</option>
              <option value="XTR">Telegram Stars (⭐) — Звёзды Telegram</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300">
            Telegram ID владельца (для мгновенных уведомлений о заказах)
          </label>
          <input
            type="text"
            value={ownerTelegramId}
            onChange={(e) => setOwnerTelegramId(e.target.value)}
            placeholder="например, 8240936731"
            className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Узнать свой цифровой Telegram ID можно в боте @userinfobot
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Фирменный цвет витрины</label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Ссылка на логотип (URL)</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300">Ссылка на баннер витрины (URL)</label>
          <input
            type="url"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300">Описание магазина</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткий слоган или описание для заголовка витрины..."
            className="mt-1 w-full p-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500 resize-none"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Сохранение...' : 'Сохранить настройки'}</span>
          </button>
        </div>
      </form>

      {/* Bot Connection Settings */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Bot className="w-5 h-5 text-sky-400" />
          <h3 className="text-base font-bold text-slate-100">Подключение Telegram-бота</h3>
        </div>

        {botUsername ? (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-750">
            <div>
              <span className="text-xs text-slate-400">Активный бот:</span>
              <p className="text-sm font-bold text-sky-400">@{botUsername}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
              Подключен
            </span>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Бот пока не привязан. Введите токен бота от @BotFather ниже.
          </p>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-300">
            Обновить токен бота (от @BotFather)
          </label>
          <div className="flex gap-2 mt-1">
            <input
              type="password"
              value={newBotToken}
              onChange={(e) => setNewBotToken(e.target.value)}
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
              className="flex-1 h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
            <button
              onClick={handleUpdateBotToken}
              disabled={isUpdatingToken || !newBotToken}
              className="px-4 h-10 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all shrink-0"
            >
              {isUpdatingToken ? 'Подключение...' : 'Подключить'}
            </button>
          </div>
          {tokenStatus && (
            <p className="text-xs text-slate-300 mt-2 font-medium">{tokenStatus}</p>
          )}
        </div>
      </div>
    </div>
  );
}
