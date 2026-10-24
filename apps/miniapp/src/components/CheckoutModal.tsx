import React, { useState } from 'react';
import { X, CreditCard, Star } from 'lucide-react';
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

          {/* Payment Methods */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-[var(--c-hint)] uppercase tracking-wide">
              {t('checkout.payment_method')}
            </div>

            <div className="space-y-1.5">
              <label
                onClick={() => setPaymentMethod('MOCK')}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                  paymentMethod === 'MOCK'
                    ? 'border-[var(--c-brand)] bg-[var(--c-secondary)]'
                    : 'border-[var(--c-separator)] bg-[var(--c-section)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full border flex items-center justify-center">
                    {paymentMethod === 'MOCK' && (
                      <div className="w-2 h-2 rounded-full bg-[var(--c-brand)]" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--c-text)]">
                      {t('checkout.pay_mock_title')}
                    </div>
                    <div className="text-xs text-[var(--c-hint)]">
                      {t('checkout.pay_mock_desc')}
                    </div>
                  </div>
                </div>
              </label>

              <label
                onClick={() => setPaymentMethod('TELEGRAM_STARS')}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                  paymentMethod === 'TELEGRAM_STARS'
                    ? 'border-[var(--c-brand)] bg-[var(--c-secondary)]'
                    : 'border-[var(--c-separator)] bg-[var(--c-section)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full border flex items-center justify-center">
                    {paymentMethod === 'TELEGRAM_STARS' && (
                      <div className="w-2 h-2 rounded-full bg-[var(--c-brand)]" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--c-text)] flex items-center gap-1">
                      <span>{t('checkout.pay_stars_title')}</span>
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    </div>
                    <div className="text-xs text-[var(--c-hint)]">
                      {t('checkout.pay_stars_desc')}
                    </div>
                  </div>
                </div>
              </label>

              <label
                onClick={() => setPaymentMethod('STRIPE')}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                  paymentMethod === 'STRIPE'
                    ? 'border-[var(--c-brand)] bg-[var(--c-secondary)]'
                    : 'border-[var(--c-separator)] bg-[var(--c-section)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full border flex items-center justify-center">
                    {paymentMethod === 'STRIPE' && (
                      <div className="w-2 h-2 rounded-full bg-[var(--c-brand)]" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--c-text)] flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[var(--c-hint)]" />
                      <span>{t('checkout.pay_stripe_title')}</span>
                    </div>
                    <div className="text-xs text-[var(--c-hint)]">
                      {t('checkout.pay_stripe_desc')}
                    </div>
                  </div>
                </div>
              </label>
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
