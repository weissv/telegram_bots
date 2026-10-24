import React from 'react';
import { CheckCircle2, MessageSquare, ArrowRight, Sparkles, ShoppingBag } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
        {/* Animated Success Badge */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
          <div className="relative w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="w-9 h-9" />
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Заказ успешно оплачен!
          </span>
          <h2 className="text-xl font-bold text-slate-100">
            Спасибо за покупку!
          </h2>
          {orderId && (
            <p className="text-xs font-mono text-slate-400">
              Номер заказа: <span className="text-sky-400 font-semibold">#{orderId.slice(0, 8)}</span>
            </p>
          )}
        </div>

        {/* Order Summary Box */}
        <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-750 text-left space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Оплачено:</span>
            <span className="text-sm font-bold text-slate-100">
              {formatCurrency(totalAmount, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Позиций в заказе:</span>
            <span className="font-semibold text-slate-200">{itemsCount} шт.</span>
          </div>
          <div className="pt-2 border-t border-slate-700/60 text-[11px] text-slate-300 flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>
              Электронный чек и статус заказа уже отправлены в ваш чат с ботом.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onCloseMiniApp}
            className="w-full h-12 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Вернуться в чат с ботом</span>
          </button>

          <button
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700/80 active:scale-[0.98] transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Продолжить покупки</span>
          </button>
        </div>
      </div>
    </div>
  );
}
