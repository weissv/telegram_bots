import React, { useState } from 'react';
import { Check, Zap, Sparkles, Server } from 'lucide-react';

export function PricingTable() {
  const [billingLoading, setBillingLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: 'BASIC_20' | 'PRO_30' | 'STANDALONE_LIFETIME') => {
    try {
      setBillingLoading(plan);
      const res = await fetch('http://localhost:3000/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: 'web_visitor',
          plan,
        }),
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setBillingLoading(null);
    }
  };

  return (
    <section id="pricing" className="py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="text-center space-y-3">
        <h2 className="text-xs font-bold text-sky-400 uppercase tracking-widest">
          Transparent Pricing
        </h2>
        <p className="text-3xl sm:text-4xl font-extrabold text-slate-100">
          Choose the Perfect Setup for Your Business
        </p>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Start instantly in our cloud SaaS or host independently on your private server.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Basic $20 Plan */}
        <div className="flex flex-col justify-between p-7 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Basic Bot</span>
              <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-slate-100">$20</span>
              <span className="text-xs text-slate-400">/ month</span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive keyboard-driven bot storefront with in-chat ordering.
            </p>

            <div className="pt-4 border-t border-slate-800 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-sky-400" />
                <span>Paginated Inline Keyboard Catalog</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-sky-400" />
                <span>In-Chat Shopping Cart & Quantities</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-sky-400" />
                <span>Instant Merchant Telegram Alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-sky-400" />
                <span>Merchant Web Backoffice</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSubscribe('BASIC_20')}
            disabled={!!billingLoading}
            className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs border border-slate-700 transition-all active:scale-98"
          >
            {billingLoading === 'BASIC_20' ? 'Redirecting...' : 'Get Basic Bot'}
          </button>
        </div>

        {/* Pro $30 Plan (Featured) */}
        <div className="relative flex flex-col justify-between p-7 rounded-3xl bg-slate-900 border-2 border-sky-500 shadow-2xl shadow-sky-500/10 backdrop-blur">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-sky-500 text-white text-[11px] font-extrabold uppercase tracking-wider shadow">
            Most Popular
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-sky-400 uppercase">Pro Mini App</span>
              <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-slate-100">$30</span>
              <span className="text-xs text-slate-400">/ month</span>
            </div>
            <p className="text-xs text-slate-400">
              Full-screen animated Telegram Mini App storefront with custom branding.
            </p>

            <div className="pt-4 border-t border-slate-800 space-y-2.5 text-xs text-slate-200 font-medium">
              <div className="flex items-center gap-2 text-sky-400">
                <Check className="w-4 h-4" />
                <span><b>Full Telegram Mini App (TWA)</b></span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-sky-400" />
                <span>Custom Theme Colors, Logos & Banners</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-sky-400" />
                <span>Category Tabs & Live Search Filter</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-sky-400" />
                <span>Telegram Haptic Feedback & MainButton</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-sky-400" />
                <span>Includes Everything in Basic Bot</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSubscribe('PRO_30')}
            disabled={!!billingLoading}
            className="mt-8 w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all active:scale-98"
          >
            {billingLoading === 'PRO_30' ? 'Redirecting...' : 'Launch Pro Mini App'}
          </button>
        </div>

        {/* Standalone $350 Plan */}
        <div className="flex flex-col justify-between p-7 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase">Standalone VPS</span>
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-slate-100">$350</span>
              <span className="text-xs text-slate-400">/ one-time lifetime</span>
            </div>
            <p className="text-xs text-slate-400">
              Zero-touch automated installation on your own isolated Ubuntu VPS.
            </p>

            <div className="pt-4 border-t border-slate-800 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-400" />
                <span><b>100% Private VPS Isolation</b></span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-400" />
                <span>Automated curl-to-bash Installer</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-400" />
                <span>Traefik v3 Auto Let's Encrypt SSL</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-400" />
                <span>Zero Monthly Fees & Zero Revenue Cuts</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-400" />
                <span>Full Dockerized Stack & Database</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSubscribe('STANDALONE_LIFETIME')}
            disabled={!!billingLoading}
            className="mt-8 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all active:scale-98"
          >
            {billingLoading === 'STANDALONE_LIFETIME' ? 'Redirecting...' : 'Buy Standalone License'}
          </button>
        </div>
      </div>
    </section>
  );
}
