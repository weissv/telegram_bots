import React, { useEffect, useState } from 'react';
import { getAuthToken, clearAuthToken, apiRequest } from './api/client.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { Products } from './pages/Products.js';
import { Orders } from './pages/Orders.js';
import { Settings } from './pages/Settings.js';
import { LayoutDashboard, Package, ShoppingBag, Settings as SettingsIcon, LogOut, ExternalLink, Bot } from 'lucide-react';
import { MerchantProfile } from './types/index.js';

type ActiveTab = 'dashboard' | 'products' | 'orders' | 'settings';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getAuthToken());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [profile, setProfile] = useState<MerchantProfile | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      apiRequest('/api/v1/admin/auth/me')
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

  const storefrontUrl = `http://localhost:5173?tenant_id=${profile?.tenant?.id || 'demo-tenant'}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-sm text-slate-100 truncate">
                  {profile?.tenant?.name || 'Store Backoffice'}
                </h2>
                <span className="text-[11px] text-sky-400 font-semibold uppercase tracking-wider">
                  {profile?.tenant?.plan?.replace('_', ' ') || 'Plan Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'products'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Products</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'orders'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Orders</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'settings'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Bot & Settings</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-750 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              Storefront Preview
            </span>
          </a>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'products' && <Products />}
        {activeTab === 'orders' && <Orders />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
