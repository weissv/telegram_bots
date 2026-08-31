import React from 'react';
import { Bot, Sparkles, ArrowRight, ShieldCheck, Zap, Globe } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative pt-24 pb-20 overflow-hidden">
      {/* Background glowing gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-sky-500/20 blur-[130px] -z-10 rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-indigo-500/15 blur-[120px] -z-10 rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-semibold text-sky-400 shadow-xl backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Gen Full-Stack Telegram Commerce</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-100 tracking-tight leading-[1.1]">
          Turn Telegram Into Your Most <br />
          <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            Profitable Sales Channel
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed">
          High-throughput multi-tenant SaaS & zero-touch standalone deployment. Complete with instant Mini App storefronts, automatic BotFather provisioning, and merchant web backoffice.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm shadow-xl shadow-sky-500/25 flex items-center justify-center gap-2.5 transition-all active:scale-95"
          >
            <Bot className="w-5 h-5" />
            <span>Launch Store with Master Bot</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <a
            href="http://localhost:5173?tenant_id=demo-tenant"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-sm border border-slate-800 shadow-xl backdrop-blur flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <span>Test-Drive Mini App Demo</span>
          </a>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12 pt-8 text-slate-400 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-400" />
            <span>Fastify Sub-10ms Webhooks</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>AES-256-GCM Encrypted Tokens</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>SaaS & VPS Standalone Mode</span>
          </div>
        </div>
      </div>
    </section>
  );
}
