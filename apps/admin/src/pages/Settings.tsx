import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { Bot, Save, Key, ShieldCheck, Palette, Store } from 'lucide-react';

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
      alert(`Save failed: ${err.message}`);
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
      setTokenStatus(`Successfully connected to @${data.botUsername} with webhook registered!`);
      setNewBotToken('');
    } catch (err: any) {
      setTokenStatus(`Error: ${err.message}`);
    } finally {
      setIsUpdatingToken(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Store & Bot Settings</h1>
        <p className="text-sm text-slate-400">Configure branding, Telegram bot integration, and notifications.</p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold animate-in fade-in">
          Settings saved and storefront cache updated successfully!
        </div>
      )}

      {/* General & Theme Settings */}
      <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Store className="w-5 h-5 text-sky-400" />
          <h3 className="text-base font-bold text-slate-100">Storefront Branding</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Store Name</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="XTR">Telegram Stars (XTR)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300">Merchant Telegram User ID (for Instant Order Alerts)</label>
          <input
            type="text"
            value={ownerTelegramId}
            onChange={(e) => setOwnerTelegramId(e.target.value)}
            placeholder="e.g. 123456789"
            className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
          />
          <p className="text-[11px] text-slate-500 mt-1">Get your Telegram ID from @userinfobot</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Primary Brand Color</label>
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
            <label className="text-xs font-semibold text-slate-300">Logo Image URL</label>
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
          <label className="text-xs font-semibold text-slate-300">Store Banner Image URL</label>
          <input
            type="url"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300">Store Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full p-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500 resize-none"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Botfather Token Config */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Bot className="w-5 h-5 text-sky-400" />
          <h3 className="text-base font-bold text-slate-100">Telegram Bot Token & Webhook</h3>
        </div>

        {botUsername ? (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Active Bot: @{botUsername} (AES-256-GCM Encrypted)</span>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            No bot token configured yet. Paste your @BotFather token below.
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-300">Update @BotFather API Token</label>
          <div className="flex gap-2 mt-1">
            <input
              type="password"
              value={newBotToken}
              onChange={(e) => setNewBotToken(e.target.value)}
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="flex-1 h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
            <button
              type="button"
              onClick={handleUpdateBotToken}
              disabled={isUpdatingToken || !newBotToken}
              className="px-5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sky-400 font-semibold text-xs border border-slate-700"
            >
              {isUpdatingToken ? 'Verifying...' : 'Connect Bot'}
            </button>
          </div>
        </div>

        {tokenStatus && (
          <p className="text-xs font-semibold text-sky-400">{tokenStatus}</p>
        )}
      </div>
    </div>
  );
}
