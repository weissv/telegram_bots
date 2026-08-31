import React, { useState } from 'react';
import { X, Lock, CreditCard, Sparkles, CheckCircle2 } from 'lucide-react';
import { CartItem } from '../types/index.js';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currency: string;
  totalAmount: number;
  initialTelegramUser: any;
  onConfirmOrder: (orderDetails: {
    customerName: string;
    customerPhone: string;
    shippingAddress: string;
    paymentMethod: 'STRIPE' | 'MOCK' | 'TELEGRAM_STARS';
  }) => Promise<void>;
  isProcessing: boolean;
}

export function CheckoutModal({
  isOpen,
  onClose,
  items,
  currency,
  totalAmount,
  initialTelegramUser,
  onConfirmOrder,
  isProcessing,
}: CheckoutModalProps) {
  const [customerName, setCustomerName] = useState(
    initialTelegramUser
      ? `${initialTelegramUser.first_name || ''} ${initialTelegramUser.last_name || ''}`.trim()
      : ''
  );
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'STRIPE' | 'MOCK' | 'TELEGRAM_STARS'>('STRIPE');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirmOrder({
      customerName: customerName || 'Telegram User',
      customerPhone,
      shippingAddress: shippingAddress || 'Digital / Default delivery',
      paymentMethod,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-sky-400" />
            <h3 className="text-base font-bold text-slate-100">Secure Checkout</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Your Full Name</label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              className="mt-1 w-full h-11 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Phone Number (Optional)</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="mt-1 w-full h-11 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Delivery Address / Notes</label>
            <textarea
              rows={2}
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Street address, apartment, city, zip code..."
              className="mt-1 w-full p-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Select Payment Method</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('STRIPE')}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  paymentMethod === 'STRIPE'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Card / Apple Pay</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('MOCK')}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  paymentMethod === 'MOCK'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Instant / Demo</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-sm mb-4">
              <span className="text-slate-400 font-medium">Total Due:</span>
              <span className="text-lg font-bold text-slate-50">
                {totalAmount.toFixed(2)} {currency}
              </span>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full h-12 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
            >
              {isProcessing ? (
                <span>Processing Order...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pay {totalAmount.toFixed(2)} {currency}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
