import React, { useEffect, useState } from 'react';
import { getAuthToken, clearAuthToken, apiRequest } from './api/client.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { Products } from './pages/Products.js';
import { Orders } from './pages/Orders.js';
import { Settings } from './pages/Settings.js';
import { LayoutDashboard, Package, ShoppingBag, Settings as SettingsIcon, LogOut, ExternalLink, Store } from 'lucide-react';
import { MerchantProfile } from './types/index.js';

type ActiveTab = 'dashboard' | 'products' | 'orders' | 'settings';

function formatPlanName(plan?: string): string {
  if (!plan) return 'Тариф Базовый';
  const p = plan.toUpperCase();
  if (p === 'PRO_30' || p === 'PRO') return 'Тариф Pro · $30/мес';
  if (p === 'STANDALONE_LIFETIME' || p === 'STANDALONE') return 'Standalone Lifetime';
  if (p === 'BASIC_20' || p === 'BASIC') return 'Тариф Базовый · $20/мес';
  return `Тариф ${plan}`;
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getAuthToken());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [profile, setProfile] = useState<MerchantProfile | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      apiRequest<MerchantProfile>('/api/v1/admin/auth/me')
        .then((data) => setProfile(data))
        .catch(() => {
          clearAuthToken();
          setIsAuthenticated(false);
        });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const handleSignOut = () => {
    clearAuthToken();
    setIsAuthenticated(false);
  };

  const currency = profile?.tenant?.botConfig?.currency || 'USD';
  const tenantId = profile?.tenant?.id || 'demo-tenant';
  const storefrontUrl =
    typeof window !== 'undefined' && window.location.port === '5174'
      ? `http://localhost:5173?tenant_id=${tenantId}`
      : `${typeof window !== 'undefined' ? window.location.origin : ''}/miniapp/?tenant_id=${tenantId}`;

  return (
    <div className="min-h-screen bg-subtle/30 text-ink flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-paper border-b md:border-b-0 md:border-r border-line flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-line">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-ink text-paper flex items-center justify-center shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-sm truncate">
                  {profile?.tenant?.name || 'Магазин'}
                </h2>
                <p className="text-xs text-muted truncate">
                  {formatPlanName(profile?.tenant?.plan)}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-ink text-paper'
                  : 'text-muted hover:bg-subtle hover:text-ink'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Обзор</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'products'
                  ? 'bg-ink text-paper'
                  : 'text-muted hover:bg-subtle hover:text-ink'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>Товары</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'bg-ink text-paper'
                  : 'text-muted hover:bg-subtle hover:text-ink'
              }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>Заказы</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-ink text-paper'
                  : 'text-muted hover:bg-subtle hover:text-ink'
              }`}
            >
              <SettingsIcon className="w-4 h-4 shrink-0" />
              <span>Настройки и бот</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-line space-y-1.5">
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-line bg-subtle/50 hover:bg-subtle text-ink text-xs font-medium transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-muted" />
              <span>Открыть витрину</span>
            </span>
            <span className="text-muted text-[11px]">TMA</span>
          </a>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-muted hover:bg-red-50 hover:text-red-700 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard currency={currency} />}
          {activeTab === 'products' && <Products currency={currency} />}
          {activeTab === 'orders' && <Orders currency={currency} />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}
