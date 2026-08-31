import React from 'react';
import { Smartphone, Database, Lock, Cpu, BellRing, RefreshCw } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: <Smartphone className="w-6 h-6 text-sky-400" />,
      title: 'Full-Screen Telegram Mini App',
      description:
        'Interactive React 18 storefront seamlessly embedded inside Telegram with category tabs, animated cart slide-over, and haptic feedback.',
    },
    {
      icon: <Database className="w-6 h-6 text-emerald-400" />,
      title: 'Strict Row-Level Tenant Isolation',
      description:
        'Automated Prisma Client Extension that enforces tenant bounds on all queries, updates, and aggregations across hundreds of shops.',
    },
    {
      icon: <Lock className="w-6 h-6 text-indigo-400" />,
      title: 'Cryptographic Security & HMAC',
      description:
        'Zero-trust validation of Telegram initData using HMAC-SHA256 and AES-256-GCM encryption for all merchant bot tokens.',
    },
    {
      icon: <Cpu className="w-6 h-6 text-amber-400" />,
      title: 'Atomic Concurrency Stock Guard',
      description:
        'Database row-level transactions and atomic decrements guarantee zero double-selling during sudden traffic surges.',
    },
    {
      icon: <BellRing className="w-6 h-6 text-rose-400" />,
      title: 'Instant Merchant Telegram Alerts',
      description:
        'Receive rich HTML order notifications directly on your personal Telegram account the moment a customer pays.',
    },
    {
      icon: <RefreshCw className="w-6 h-6 text-teal-400" />,
      title: 'BullMQ Recurring Billing Engine',
      description:
        'Daily automated subscription health checks, graceful warning period management, and automatic tenant deactivation.',
    },
  ];

  return (
    <section className="py-20 border-t border-slate-800/80 bg-slate-950/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-xs font-bold text-sky-400 uppercase tracking-widest">
            Engineered for Scale
          </h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-slate-100">
            Enterprise Architecture Out of the Box
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 shadow-xl backdrop-blur transition-all duration-200"
            >
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 w-fit mb-4">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
