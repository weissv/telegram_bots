import React from 'react';
import { Clock, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';

interface OrderSuccessModalProps {
  isOpen: boolean;
  orderId: string | null;
  totalAmount: number;
  currency: string;
  itemsCount?: number;
  supportContact?: string;
  onClose: () => void;
  onCloseMiniApp: () => void;
}

const REVIEW_COPY = {
  ru: {
    heading: 'Оплата отправлена на проверку оператору магазина',
    subtitle:
      'Оператор проверит поступление средств по Paynet и подтвердит заказ. Уведомление придёт в Telegram.',
    statusBadge: 'На проверке оплаты',
    totalLabel: 'Сумма заказа:',
    supportLabel: 'Поддержка магазина:',
  },
  uz: {
    heading: "To'lov do'kon operatoriga tekshiruvga yuborildi",
    subtitle:
      "Operator Paynet orqali mablag' tushganini tekshirib, buyurtmani tasdiqlaydi. Bildirishnoma Telegram'ga keladi.",
    statusBadge: "To'lov tekshirilmoqda",
    totalLabel: 'Buyurtma summasi:',
    supportLabel: "Do'kon qo'llab-quvvatlash:",
  },
  en: {
    heading: 'Payment submitted for store verification',
    subtitle:
      'The store operator will verify your Paynet transfer and confirm your order. You will be notified in Telegram.',
    statusBadge: 'Payment under review',
    totalLabel: 'Order amount:',
    supportLabel: 'Store support:',
  },
} as const;

export function OrderSuccessModal({
  isOpen,
  orderId,
  totalAmount,
  currency,
  itemsCount,
  supportContact,
  onClose,
  onCloseMiniApp,
}: OrderSuccessModalProps) {
  const { t, locale, formatCurrency } = useI18n();

  if (!isOpen) return null;

  const copy = REVIEW_COPY[locale] || REVIEW_COPY.ru;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-opacity">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--c-bg)] border border-[var(--c-separator)] p-6 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
        {/* Review Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Clock className="w-8 h-8 stroke-[2.2]" />
        </div>

        {/* Text Details */}
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-[var(--c-text)] leading-snug">
            {copy.heading}
          </h2>
          <p className="text-xs text-[var(--c-hint)] leading-relaxed">
            {copy.subtitle}
          </p>
          {orderId && (
            <p className="text-xs font-mono text-[var(--c-text)] pt-1 font-semibold">
              {t('success.order_num', { id: orderId.slice(0, 8).toUpperCase() })}
            </p>
          )}
        </div>

        {/* Receipt Box */}
        <div className="p-3.5 rounded-xl bg-[var(--c-secondary)] text-left space-y-2 text-xs">
          {typeof itemsCount === 'number' && itemsCount > 0 && (
            <div className="flex items-center justify-between text-[var(--c-hint)]">
              <span>{t('success.items_qty')}</span>
              <span className="font-medium text-[var(--c-text)]">
                {itemsCount} {t('cart.items_suffix')}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-[var(--c-hint)]">
            <span>{copy.totalLabel}</span>
            <span className="text-sm font-bold text-[var(--c-text)] tabular">
              {formatCurrency(totalAmount, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[var(--c-hint)]">
            <span>{t('success.status_label')}</span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              {copy.statusBadge}
            </span>
          </div>
          {supportContact && (
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--c-separator)] text-[var(--c-hint)]">
              <span>{copy.supportLabel}</span>
              <span className="font-medium text-[var(--c-text)] text-right break-all">
                {supportContact}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button type="button" onClick={onClose} className="btn-filled">
            {t('success.back_catalog')}
          </button>

          <button type="button" onClick={onCloseMiniApp} className="btn-tinted">
            {t('success.close_app')}
          </button>
        </div>
      </div>
    </div>
  );
}
