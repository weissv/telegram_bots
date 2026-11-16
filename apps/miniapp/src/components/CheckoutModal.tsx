import React, { useState } from 'react';
import { X, QrCode, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { CartItem } from '../types/index.js';
import { useI18n } from '../i18n/useI18n.js';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currency: string;
  totalAmount: number;
  initialTelegramUser: any;
  paynetEnabled?: boolean;
  onConfirmOrder: (orderDetails: {
    customerName: string;
    customerPhone: string;
    shippingAddress: string;
    paymentMethod: 'PAYNET_XOLIS' | 'STRIPE' | 'MOCK' | 'TELEGRAM_STARS';
  }) => Promise<void>;
  isProcessing: boolean;
}

const PAYNET_TRUST_COPY = {
  ru: {
    channels: 'Uzcard · Humo · Visa · Приложение Paynet',
    note: 'После оформления откроется QR-код и прямая ссылка Paynet QR-Online (0% комиссия). Товар резервируется автоматически.',
  },
  uz: {
    channels: 'Uzcard · Humo · Visa · Paynet ilovasi',
    note: "Rasmiylashtirishdan so'ng Paynet QR-Online kodi va to'g'ridan-to'g'ri havola ochiladi (0% komissiya). Mahsulot avtomatik band qilinadi.",
  },
  en: {
    channels: 'Uzcard · Humo · Visa · Paynet App',
    note: 'You will receive a Paynet QR-Online code and direct payment link (0% commission). Items are reserved automatically.',
  },
} as const;

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
  const { t, locale, formatCurrency } = useI18n();

  const [customerName, setCustomerName] = useState(() => {
    if (initialTelegramUser) {
      const full = `${initialTelegramUser.first_name || ''} ${initialTelegramUser.last_name || ''}`.trim();
      return full || initialTelegramUser.username || '';
    }
    return '';
  });

  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod] = useState<'PAYNET_XOLIS'>('PAYNET_XOLIS');

  if (!isOpen) return null;

  const trustCopy = PAYNET_TRUST_COPY[locale] || PAYNET_TRUST_COPY.ru;

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
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 transition-opacity">
      <div
        className="w-full max-h-[92vh] bg-[var(--c-bg)] border-t border-[var(--c-separator)] rounded-t-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle & Header */}
        <div className="border-b border-[var(--c-separator)]">
          <div className="w-full pt-2.5 pb-1.5 flex justify-center">
            <div className="w-10 h-1 rounded-full bg-[var(--c-hint)] opacity-40" />
          </div>
          <div className="flex items-center justify-between px-4 pb-3">
            <h2 className="text-base font-semibold text-[var(--c-text)]">
              {t('checkout.heading')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="p-1 rounded-full text-[var(--c-hint)] hover:text-[var(--c-text)]"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Order Summary Strip */}
          <div className="p-3.5 rounded-xl bg-[var(--c-secondary)] flex items-center justify-between text-sm">
            <div>
              <span className="font-medium text-[var(--c-text)]">
                {t('cart.drawer_title')} ({items.length}):
              </span>
              <span className="text-xs text-[var(--c-hint)] block mt-0.5">
                {items.map((i) => `${i.product.title} (×${i.quantity})`).join(', ')}
              </span>
            </div>
            <div className="text-base font-bold text-[var(--c-text)] tabular shrink-0 ml-3">
              {formatCurrency(totalAmount, currency)}
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[var(--c-hint)] uppercase tracking-wide">
              {t('checkout.customer_data')}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[var(--c-hint)] block">
                {t('checkout.full_name')}
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Aziz Rahimov"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--c-secondary)] text-sm text-[var(--c-text)] placeholder:text-[var(--c-hint)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[var(--c-hint)] block">
                {t('checkout.phone')}
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t('checkout.phone_placeholder')}
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--c-secondary)] text-sm text-[var(--c-text)] placeholder:text-[var(--c-hint)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[var(--c-hint)] block">
                {t('checkout.address')}
              </label>
              <input
                type="text"
                required
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder={t('checkout.address_placeholder')}
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--c-secondary)] text-sm text-[var(--c-text)] placeholder:text-[var(--c-hint)]"
              />
            </div>
          </div>

          {/* Payment Method: Paynet Xolis Only */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-[var(--c-hint)] uppercase tracking-wide">
              {t('checkout.payment_method')}
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-500/60 bg-emerald-500/10 space-y-2.5">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-[var(--c-text)] flex items-center gap-1.5 flex-wrap">
                      <span>{t('checkout.pay_paynet_title')}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 rounded">
                        0%
                      </span>
                    </div>
                    <div className="text-xs text-[var(--c-hint)]">
                      {t('checkout.pay_paynet_desc')}
                    </div>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              </div>

              <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{trustCopy.channels}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--c-hint)]">
                  {trustCopy.note}
                </p>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div
            className="pt-4 pb-2"
            style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}
          >
            <button
              type="submit"
              disabled={isProcessing}
              className="btn-filled"
            >
              {isProcessing ? (
                t('checkout.processing_btn')
              ) : (
                <span>{t('checkout.pay_button', { amount: formatCurrency(totalAmount, currency) })}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
