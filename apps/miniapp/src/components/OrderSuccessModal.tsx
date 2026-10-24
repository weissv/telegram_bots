import React from 'react';
import { Check, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';

interface OrderSuccessModalProps {
  isOpen: boolean;
  orderId: string | null;
  totalAmount: number;
  currency: string;
  itemsCount: number;
  onClose: () => void;
  onCloseMiniApp: () => void;
}

export function OrderSuccessModal({
  isOpen,
  orderId,
  totalAmount,
  currency,
  itemsCount,
  onClose,
  onCloseMiniApp,
}: OrderSuccessModalProps) {
  const { formatCurrency } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-opacity">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--c-bg)] border border-[var(--c-separator)] p-6 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
        {/* Success Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/15 text-green-600 flex items-center justify-center">
          <Check className="w-8 h-8 stroke-[2.5]" />
        </div>

        {/* Text Details */}
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-[var(--c-text)]">
            Заказ оплачен!
          </h2>
          <p className="text-sm text-[var(--c-hint)]">
            Мы уже начали готовить ваш заказ к отправке.
          </p>
          {orderId && (
            <p className="text-xs font-mono text-[var(--c-hint)] pt-1">
              Номер: #{orderId.slice(0, 8).toUpperCase()}
            </p>
          )}
        </div>

        {/* Receipt Box */}
        <div className="p-3.5 rounded-xl bg-[var(--c-secondary)] text-left space-y-2 text-xs">
          <div className="flex items-center justify-between text-[var(--c-hint)]">
            <span>Позиций в заказе:</span>
            <span className="font-medium text-[var(--c-text)]">{itemsCount} шт.</span>
          </div>
          <div className="flex items-center justify-between text-[var(--c-hint)]">
            <span>Сумма оплаты:</span>
            <span className="text-sm font-bold text-[var(--c-text)] tabular">
              {formatCurrency(totalAmount, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[var(--c-hint)]">
            <span>Статус:</span>
            <span className="text-green-600 font-semibold">Оплачено</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-filled"
          >
            Вернуться в магазин
          </button>

          <button
            type="button"
            onClick={onCloseMiniApp}
            className="btn-tinted"
          >
            Закрыть приложение
          </button>
        </div>
      </div>
    </div>
  );
}
