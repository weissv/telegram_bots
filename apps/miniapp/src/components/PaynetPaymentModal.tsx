import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  QrCode,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';

interface PaynetPaymentModalProps {
  isOpen: boolean;
  orderId: string;
  totalAmount: number;
  currency: string;
  paynetQrUrl: string;
  onConfirmPaid: () => Promise<void>;
  onCancelOrder?: () => Promise<void>;
  onClose: () => void;
  isConfirming: boolean;
  isCancelling?: boolean;
  errorMessage?: string | null;
}

const MODAL_COPY = {
  ru: {
    copyAmount: '📋 Скопировать сумму',
    copyLink: '🔗 Скопировать ссылку Paynet',
    copied: 'Скопировано!',
    howToPay: 'Как оплатить:',
    qrFallbackTitle: 'QR-код временно недоступен',
    qrFallbackHint: 'Нажмите «Открыть Paynet» ниже или скопируйте ссылку для оплаты.',
    confirmBtn: 'Я оплатил — отправить на проверку',
    reviewNote:
      'После нажатия кнопки заказ перейдёт в статус «На проверке оплаты». Оператор магазина проверит поступление средств и подтвердит заказ.',
    cancelOrderBtn: 'Отменить неоплаченный заказ',
  },
  uz: {
    copyAmount: '📋 Summani nusxalash',
    copyLink: '🔗 Paynet havolasini nusxalash',
    copied: 'Nusxalandi!',
    howToPay: "Qanday to'lanadi:",
    qrFallbackTitle: 'QR-kod vaqtincha yuklanmadi',
    qrFallbackHint: "Quyidagi Paynet tugmasini bosing yoki to'lov havolasini nusxalang.",
    confirmBtn: "Men to'ladim — tekshiruvga yuborish",
    reviewNote:
      "Tugmani bosganingizdan so'ng buyurtma «To'lov tekshirilmoqda» holatiga o'tadi. Do'kon operatori mablag' tushganini tasdiqlaydi.",
    cancelOrderBtn: "To'lanmagan buyurtmani bekor qilish",
  },
  en: {
    copyAmount: '📋 Copy amount',
    copyLink: '🔗 Copy Paynet link',
    copied: 'Copied!',
    howToPay: 'How to pay:',
    qrFallbackTitle: 'QR image unavailable',
    qrFallbackHint: 'Tap the Paynet button below or copy the payment link.',
    confirmBtn: 'I paid — submit for verification',
    reviewNote:
      'After clicking, your order moves to payment review. The store operator will verify receipt of funds and confirm your order.',
    cancelOrderBtn: 'Cancel unpaid order',
  },
} as const;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for WebViews without Clipboard API permission
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function PaynetPaymentModal({
  isOpen,
  orderId,
  totalAmount,
  currency,
  paynetQrUrl,
  onConfirmPaid,
  onCancelOrder,
  onClose,
  isConfirming,
  isCancelling = false,
  errorMessage,
}: PaynetPaymentModalProps) {
  const { t, locale, formatCurrency } = useI18n();
  const [qrLoadError, setQrLoadError] = useState(false);
  const [copiedField, setCopiedField] = useState<'amount' | 'link' | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setQrLoadError(false);
    setCopiedField(null);
  }, [isOpen, paynetQrUrl]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const copy = MODAL_COPY[locale] || MODAL_COPY.ru;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
    paynetQrUrl
  )}`;

  const handleCopy = async (field: 'amount' | 'link', value: string) => {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopiedField(field);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedField((curr) => (curr === field ? null : curr));
    }, 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 transition-opacity"
      onClick={() => !isConfirming && !isCancelling && onClose()}
    >
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
              disabled={isConfirming || isCancelling}
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

          {/* QR Code Container with Fallback */}
          <div className="mx-auto w-56 h-56 p-3 bg-white rounded-2xl shadow-md border border-[var(--c-separator)] flex items-center justify-center overflow-hidden">
            {qrLoadError ? (
              <div className="flex flex-col items-center justify-center text-center space-y-2 px-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <QrCode className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="text-xs font-semibold text-zinc-900">
                  {copy.qrFallbackTitle}
                </div>
                <p className="text-[11px] leading-snug text-zinc-500">
                  {copy.qrFallbackHint}
                </p>
              </div>
            ) : (
              <img
                src={qrImageUrl}
                alt="Paynet Xolis QR Code"
                onError={() => setQrLoadError(true)}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Quick Copy Helpers */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleCopy('amount', String(totalAmount))}
              className="h-10 px-2.5 rounded-xl bg-[var(--c-secondary)] border border-[var(--c-separator)] text-xs font-medium text-[var(--c-text)] flex items-center justify-center gap-1.5 active:opacity-80"
            >
              {copiedField === 'amount' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-emerald-600 font-semibold">{copy.copied}</span>
                </>
              ) : (
                <span className="truncate">{copy.copyAmount}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleCopy('link', paynetQrUrl)}
              className="h-10 px-2.5 rounded-xl bg-[var(--c-secondary)] border border-[var(--c-separator)] text-xs font-medium text-[var(--c-text)] flex items-center justify-center gap-1.5 active:opacity-80"
            >
              {copiedField === 'link' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-emerald-600 font-semibold">{copy.copied}</span>
                </>
              ) : (
                <span className="truncate">{copy.copyLink}</span>
              )}
            </button>
          </div>

          {/* Step-by-step instructions */}
          <div className="p-3.5 rounded-xl bg-[var(--c-secondary)] text-left text-xs space-y-2 text-[var(--c-text)]">
            <div className="font-semibold text-[var(--c-hint)] uppercase tracking-wide text-[11px]">
              {copy.howToPay}
            </div>
            <div className="space-y-1 text-xs opacity-90">
              <p>• {t('checkout.paynet_step1')}</p>
              <p>• {t('checkout.paynet_step2')}</p>
              <p>• {t('checkout.paynet_step3')}</p>
            </div>
            <p className="text-[11px] text-[var(--c-hint)] pt-1 border-t border-[var(--c-separator)]">
              {copy.reviewNote}
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div
            className="space-y-2 pt-1"
            style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}
          >
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

            {/* Confirm Paid -> PAYMENT_REVIEW button */}
            <button
              type="button"
              disabled={isConfirming || isCancelling}
              onClick={onConfirmPaid}
              className="btn-tinted w-full flex items-center justify-center gap-2 text-sm font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {isConfirming ? t('checkout.processing_btn') : copy.confirmBtn}
              </span>
            </button>

            {onCancelOrder && (
              <button
                type="button"
                disabled={isConfirming || isCancelling}
                onClick={onCancelOrder}
                className="w-full py-2 text-xs font-medium text-[var(--c-destructive)] hover:underline disabled:opacity-50"
              >
                {isCancelling ? t('checkout.processing_btn') : copy.cancelOrderBtn}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
