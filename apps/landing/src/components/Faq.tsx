import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export function Faq() {
  const faqs = [
    {
      q: 'How does Telegram Mini App checkout work?',
      a: 'When a customer opens the Mini App, Telegram validates their identity via cryptographic initData HMAC-SHA256 signature. The customer browses your catalog, adds items to their cart, and initiates payment via Stripe, Apple Pay, Google Pay, or Telegram Stars directly within Telegram.',
    },
    {
      q: 'How does automated BotFather token provisioning work?',
      a: 'You simply create a bot with @BotFather, obtain your API token, and send it to our Master Bot or enter it in your Merchant Backoffice. The system verifies the token, encrypts it with AES-256-GCM, generates a webhook secret, and registers the webhook endpoint on Telegram servers in under 2 seconds.',
    },
    {
      q: 'What is the difference between SaaS mode and Standalone VPS mode?',
      a: 'In SaaS mode, multiple merchant bots run concurrently on a unified Fastify engine with Prisma row-level tenant isolation and automated BullMQ subscription workers. In Standalone mode, the system is deployed to your private Ubuntu VPS using our curl-to-bash script with isolated PostgreSQL, Traefik Let\'s Encrypt SSL, and no recurring fees.',
    },
    {
      q: 'How do I receive alerts when an order is placed?',
      a: 'Whenever a customer completes checkout, the system broadcasts a rich HTML notification directly to your personal Telegram User ID with the order ID, itemized products, total amount, customer details, and shipping address.',
    },
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="py-20 border-t border-slate-800/80 bg-slate-950/40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-sky-400">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-100">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left font-semibold text-sm text-slate-200 hover:text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-180 text-sky-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
