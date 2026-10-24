import React, { useState } from 'react';
import { X, Lock, CreditCard, Sparkles, CheckCircle2, Star, ShieldCheck, Truck } from 'lucide-react';
import { CartItem } from '../types/index.js';
import { useI18n } from '../i18n/useI18n.js';

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
  const { t, formatCurrency } = useI18n();

  const [customerName, setCustomerName] = useState(() => {
    if (initialTelegramUser) {
      const full = `${initialTelegramUser.first_name || ''} ${initialTelegramUser.last_name || ''}`.trim();
      return full || initialTelegramUser.username || '';
    }
    return '';
  });

  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'STRIPE' | 'MOCK' | 'TELEGRAM_STARS'>('MOCK');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirmOrder({
      customerName: customerName.trim() || 'Покупатель Telegram',
      customerPhone: customerPhone.trim(),
      shippingAddress: shippingAddress.trim() || 'Telegram доставка',
      paymentMethod,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Оформление заказа</h3>
              <p className="text-[11px] text-slate-400">Безопасный расчет через Telegram</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telegram User Connected Card */}
        {initialTelegramUser && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs">
            <span className="text-slate-300">
              Покупатель: <strong className="text-sky-300">{initialTelegramUser.first_name}</strong>
              {initialTelegramUser.username ? ` (@${initialTelegramUser.username})` : ''}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold">
              ID: {initialTelegramUser.id}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Customer Name */}
          <div>
            <label className="text-xs font-semibold text-slate-300">
              Имя получателя <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Введите имя..."
              className="mt-1 w-full h-11 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-semibold text-slate-300">
              Номер телефона (для курьера / связи)
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+998 90 123 45 67 / +7 999 123 45 67"
              className="mt-1 w-full h-11 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
          </div>

          {/* Shipping Address */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-sky-400" />
              <span>Адрес доставки или пожелания к заказу</span>
            </label>
            <textarea
              rows={2}
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Город, улица, дом, квартира или цифровой заказ..."
              className="mt-1 w-full p-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all resize-none"
            />
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300">
              Способ оплаты
            </label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('MOCK')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  paymentMethod === 'MOCK'
                    ? 'border-sky-500 bg-sky-500/15 text-sky-400 shadow-md shadow-sky-500/10'
                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-4 h-4 mb-1" />
                <span className="text-[11px] font-bold">Быстрая</span>
                <span className="text-[9px] opacity-75">Тест / Мгновенно</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('TELEGRAM_STARS')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  paymentMethod === 'TELEGRAM_STARS'
                    ? 'border-amber-400 bg-amber-500/15 text-amber-300 shadow-md shadow-amber-500/10'
                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Star className="w-4 h-4 mb-1 text-amber-400 fill-amber-400" />
                <span className="text-[11px] font-bold">Stars</span>
                <span className="text-[9px] opacity-75">Звёзды TG</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('STRIPE')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  paymentMethod === 'STRIPE'
                    ? 'border-sky-500 bg-sky-500/15 text-sky-400 shadow-md shadow-sky-500/10'
                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4 mb-1" />
                <span className="text-[11px] font-bold">Карта</span>
                <span className="text-[9px] opacity-75">Visa / MC</span>
              </button>
            </div>
          </div>

          {/* Guarantee Note */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/40 border border-slate-750/50 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Оплата защищена 256-битным шифрованием. Чек придёт сразу в чат.</span>
          </div>

          {/* Submit Block */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">К оплате ({items.length} поз.):</span>
              <span className="text-xl font-extrabold text-slate-100">
                {formatCurrency(totalAmount, currency)}
              </span>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full h-12 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Создание заказа...</span>
                </div>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Оплатить {formatCurrency(totalAmount, currency)}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
