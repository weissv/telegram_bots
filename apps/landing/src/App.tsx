import React from 'react';
import { Hero } from './components/Hero.js';
import { Features } from './components/Features.js';
import { PricingTable } from './components/PricingTable.js';
import { Faq } from './components/Faq.js';
import { Bot, ExternalLink, Github } from 'lucide-react';

export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/25">
              <Bot className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-slate-100">
              Telegram Commerce
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="#pricing"
              className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors hidden sm:block"
            >
              Pricing
            </a>
            <a
              href="http://localhost:5174"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-slate-300 hover:text-sky-400 transition-colors"
            >
              Merchant Backoffice
            </a>
            <a
              href="http://localhost:5173?tenant_id=demo-tenant"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all active:scale-95"
            >
              Live Demo
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        <Hero />
        <Features />
        <PricingTable />
        <Faq />
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800/80 bg-slate-950 text-center text-xs text-slate-500 space-y-4">
        <div className="flex items-center justify-center gap-6 text-slate-400">
          <a href="http://localhost:5173?tenant_id=demo-tenant" className="hover:text-sky-400">Mini App Demo</a>
          <a href="http://localhost:5174" className="hover:text-sky-400">Merchant Admin</a>
          <a href="#pricing" className="hover:text-sky-400">Pricing & Tiers</a>
        </div>
        <p>© 2026 Telegram E-Commerce Monorepo. Production-Ready Multi-Tenant SaaS & Standalone Engine.</p>
      </footer>
    </div>
  );
}
