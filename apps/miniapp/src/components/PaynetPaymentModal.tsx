import React from 'react';
import { X, QrCode, ExternalLink, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';

interface PaynetPaymentModalProps {
  isOpen: boolean;
  orderId: string;
  totalAmount: number;
  currency: string;
  paynetQrUrl: string;
  onConfirmPaid: () => Promise<void>;
  onClose: () => void;
  isConfirming: boolean;
}

export function PaynetPaymentModal({
  isOpen,
  orderId,
  totalAmount,
  currency,
  paynetQrUrl,
  onConfirmPaid,
  onClose,
  isConfirming,
}: PaynetPaymentModalProps) {
  const { t, formatCurrency } = useI18n();

  if (!isOpen) return null;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
    paynetQrUrl
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 transition-opacity">
      <div
        className="w-full max-h-[94vh] bg-[var(--c-bg)] border-t border-[var(--c-separator)] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle & header */}
        <div className="border-b border-[var(--c-separator)]">
          <div className="w-full pt-2.5 pb-1 flex justify-center">
            <div className="w-10 h-1 rounded-full bg-[var(--c-hint)] opacity-40" />
          </div>
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-base font-semibold text-[var(--c-text)]">
                {t('checkout.paynet_heading')}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-[var(--c-hint)] hover:text-[var(--c-text)]"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-center">
          {/* Badge & Order Info */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>{t('checkout.paynet_badge')}</span>
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-bold text-[var(--c-text)] tabular">
              {formatCurrency(totalAmount, currency)}
            </div>
            <div className="text-xs font-mono text-[var(--c-hint)]">
              {t('success.order_num', { id: orderId.slice(0, 8).toUpperCase() })}
            </div>
          </div>

          {/* QR Code Container */}
          <div className="mx-auto w-56 h-56 p-2 bg-white rounded-2xl shadow-md border border-[var(--c-separator)] flex items-center justify-center overflow-hidden">
            <img
              src={qrImageUrl}
              alt="Paynet Xolis QR Code"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Step-by-step instructions */}
          <div className="p-3.5 rounded-xl bg-[var(--c-secondary)] text-left text-xs space-y-2 text-[var(--c-text)]">
            <div className="font-semibold text-[var(--c-hint)] uppercase tracking-wide text-[11px]">
              Как оплатить:
            </div>
            <div className="space-y-1 text-xs opacity-90">
              <p>• {t('checkout.paynet_step1')}</p>
              <p>• {t('checkout.paynet_step2')}</p>
              <p>• {t('checkout.paynet_step3')}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1 pb-4">
            {/* Paynet Deep Link */}
            <a
              href={paynetQrUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-filled flex items-center justify-center gap-2 !bg-emerald-600 hover:!bg-emerald-700 !text-white text-sm font-semibold"
            >
              <span>{t('checkout.paynet_open_btn')}</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Confirm Paid button */}
            <button
              type="button"
              disabled={isConfirming}
              onClick={onConfirmPaid}
              className="btn-tinted w-full flex items-center justify-center gap-2 text-sm font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {isConfirming ? t('checkout.processing_btn') : t('checkout.paynet_confirm_btn')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
