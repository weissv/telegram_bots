import React, { useState } from 'react';
import {
  X,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Truck,
  Store,
  AlertTriangle,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { CartItem, DeliveryMethod, StoreTheme } from '../types/index.js';
import { useI18n } from '../i18n/useI18n.js';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currency: string;
  totalAmount: number;
  theme: StoreTheme;
  initialTelegramUser: any;
  checkoutEnabled: boolean;
  isDemo?: boolean;
  checkoutDisabledReason?: string | null;
  onConfirmOrder: (orderDetails: {
    customerName: string;
    customerPhone: string;
    deliveryMethod: DeliveryMethod;
    shippingAddress: string;
    paymentMethod: 'PAYNET_XOLIS';
    deliveryFee: number;
    grandTotal: number;
  }) => Promise<void>;
  isProcessing: boolean;
}

const CHECKOUT_COPY = {
  ru: {
    phoneLabel: 'Контактный телефон (обязательно)',
    phoneHint: 'Укажите номер вручную — Telegram не передаёт номер телефона автоматически.',
    phoneInvalid: 'Введите корректный номер телефона (минимум 7 цифр).',
    deliveryMethodTitle: 'Способ получения',
    courierLabel: 'Доставка курьером',
    pickupLabel: 'Самовывоз',
    pickupAddressPlaceholder: 'Комментарий к самовывозу (необязательно)',
    addressRequired: 'Укажите адрес доставки для курьера.',
    itemsSubtotal: 'Товары:',
    deliveryFeeLabel: 'Доставка:',
    deliveryFree: 'Бесплатно',
    freeThresholdHint: 'Бесплатная доставка от {amount}',
    totalLabel: 'Итого к оплате:',
    legalBlockTitle: 'Условия доставки, возврата и данные продавца',
    sellerLabel: 'Продавец:',
    innLabel: 'ИНН / ПИНФЛ:',
    supportLabel: 'Поддержка:',
    deliveryTermsLabel: 'Условия доставки:',
    returnPolicyLabel: 'Возврат и обмен:',
    privacyLinkLabel: 'Политика конфиденциальности и обработки данных',
    notSpecified: 'Не указано продавцом',
    channels: 'Uzcard · Humo · Visa · Приложение Paynet',
    paynetNote:
      'После оформления откроется QR-код и ссылка Paynet QR-Online магазина. После нажатия «Я оплатил» оператор проверит поступление средств.',
    demoBanner: 'Демо-витрина: приём реальных заказов и оплат отключён',
    disabledBanner: 'Онлайн-оплата временно отключена продавцом',
    consentNote:
      'Оформляя заказ, вы соглашаетесь с условиями доставки, возврата и политикой конфиденциальности.',
    submitDisabledBtn: 'Оформление недоступно',
  },
  uz: {
    phoneLabel: 'Telefon raqami (majburiy)',
    phoneHint: "Raqamni qo'lda kiriting — Telegram telefon raqamini avtomatik yubormaydi.",
    phoneInvalid: "To'g'ri telefon raqamini kiriting (kamida 7 ta raqam).",
    deliveryMethodTitle: 'Yetkazib berish usuli',
    courierLabel: 'Kuryer orqali yetkazib berish',
    pickupLabel: 'Olib ketish (Samovivoz)',
    pickupAddressPlaceholder: "Olib ketish bo'yicha izoh (ixtiyoriy)",
    addressRequired: 'Kuryer uchun yetkazib berish manzilini kiriting.',
    itemsSubtotal: 'Mahsulotlar:',
    deliveryFeeLabel: 'Yetkazib berish:',
    deliveryFree: 'Bepul',
    freeThresholdHint: '{amount} dan boshlab bepul yetkazib berish',
    totalLabel: "Jami to'lov:",
    legalBlockTitle: "Yetkazib berish, qaytarish shartlari va sotuvchi ma'lumotlari",
    sellerLabel: 'Sotuvchi:',
    innLabel: 'STIR / JSHSHIR:',
    supportLabel: "Qo'llab-quvvatlash:",
    deliveryTermsLabel: 'Yetkazib berish shartlari:',
    returnPolicyLabel: 'Qaytarish va almashtirish:',
    privacyLinkLabel: 'Maxfiylik siyosati',
    notSpecified: "Sotuvchi tomonidan ko'rsatilmagan",
    channels: 'Uzcard · Humo · Visa · Paynet ilovasi',
    paynetNote:
      "Rasmiylashtirishdan so'ng do'konning Paynet QR-Online kodi ochiladi. «To'ladim» tugmasi bosilgach, operator to'lovni tekshiradi.",
    demoBanner: "Demo-vitrina: haqiqiy buyurtmalar va to'lovlar qabul qilinmaydi",
    disabledBanner: "Onlayn to'lov sotuvchi tomonidan vaqtincha o'chirilgan",
    consentNote:
      "Buyurtmani rasmiylashtirib, yetkazib berish, qaytarish va maxfiylik shartlariga rozilik bildirasiz.",
    submitDisabledBtn: "Rasmiylashtirish mavjud emas",
  },
  en: {
    phoneLabel: 'Contact phone (required)',
    phoneHint: 'Enter your phone number manually — Telegram does not share it automatically.',
    phoneInvalid: 'Please enter a valid phone number (at least 7 digits).',
    deliveryMethodTitle: 'Delivery method',
    courierLabel: 'Courier delivery',
    pickupLabel: 'Store pickup',
    pickupAddressPlaceholder: 'Pickup note (optional)',
    addressRequired: 'Please enter a delivery address.',
    itemsSubtotal: 'Items subtotal:',
    deliveryFeeLabel: 'Delivery fee:',
    deliveryFree: 'Free',
    freeThresholdHint: 'Free delivery from {amount}',
    totalLabel: 'Total due:',
    legalBlockTitle: 'Delivery, returns & seller legal details',
    sellerLabel: 'Seller:',
    innLabel: 'Tax ID / INN:',
    supportLabel: 'Support:',
    deliveryTermsLabel: 'Delivery terms:',
    returnPolicyLabel: 'Return policy:',
    privacyLinkLabel: 'Privacy policy',
    notSpecified: 'Not specified by seller',
    channels: 'Uzcard · Humo · Visa · Paynet App',
    paynetNote:
      'You will receive the store Paynet QR-Online link. Clicking "I paid" sends your payment for merchant operator verification.',
    demoBanner: 'Demo storefront: real orders and payments are disabled',
    disabledBanner: 'Online checkout is temporarily disabled by the seller',
    consentNote:
      'By placing an order, you agree to the delivery terms, return policy, and privacy policy.',
    submitDisabledBtn: 'Checkout unavailable',
  },
} as const;

export function CheckoutModal({
  isOpen,
  onClose,
  items,
  currency,
  totalAmount,
  theme,
  initialTelegramUser,
  checkoutEnabled,
  isDemo,
  checkoutDisabledReason,
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
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('COURIER');
  const [shippingAddress, setShippingAddress] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const copy = CHECKOUT_COPY[locale] || CHECKOUT_COPY.ru;

  const baseDeliveryFee = Math.max(0, Number(theme.deliveryFeeUzs ?? 25000));
  const freeThreshold = Math.max(0, Number(theme.freeDeliveryThresholdUzs ?? 0));
  const isFreeByThreshold = freeThreshold > 0 && totalAmount >= freeThreshold;
  const deliveryFee =
    deliveryMethod === 'PICKUP' || isFreeByThreshold ? 0 : baseDeliveryFee;
  const grandTotal = totalAmount + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutEnabled || isProcessing) return;
    setValidationError(null);

    const digits = customerPhone.replace(/\D/g, '');
    if (digits.length < 7) {
      setValidationError(copy.phoneInvalid);
      return;
    }

    if (deliveryMethod === 'COURIER' && !shippingAddress.trim()) {
      setValidationError(copy.addressRequired);
      return;
    }

    await onConfirmOrder({
      customerName: customerName.trim() || 'Покупатель Telegram',
      customerPhone: customerPhone.trim(),
      deliveryMethod,
      shippingAddress:
        deliveryMethod === 'PICKUP'
          ? shippingAddress.trim() || 'Самовывоз'
          : shippingAddress.trim(),
      paymentMethod: 'PAYNET_XOLIS',
      deliveryFee,
      grandTotal,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 transition-opacity"
      onClick={() => !isProcessing && onClose()}
    >
      <div
        className="w-full max-h-[94vh] bg-[var(--c-bg)] border-t border-[var(--c-separator)] rounded-t-2xl shadow-xl flex flex-col overflow-hidden"
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
          {/* Blocked / Demo Warning Banner */}
          {!checkoutEnabled && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{isDemo ? copy.demoBanner : copy.disabledBanner}</span>
              </div>
              {checkoutDisabledReason && (
                <p className="text-[11px] opacity-90 pl-6">{checkoutDisabledReason}</p>
              )}
              {theme.supportContact && (
                <p className="text-[11px] pl-6">
                  {copy.supportLabel} <strong>{theme.supportContact}</strong>
                </p>
              )}
            </div>
          )}

          {/* Items Summary & Breakdown */}
          <div className="p-3.5 rounded-xl bg-[var(--c-secondary)] space-y-2.5 text-sm">
            <div>
              <span className="font-medium text-[var(--c-text)] text-xs">
                {t('cart.drawer_title')} ({items.length}):
              </span>
              <span className="text-xs text-[var(--c-hint)] block mt-0.5">
                {items
                  .map(
                    (i) =>
                      `${i.product.title}${i.variant ? ` [${i.variant}]` : ''} (×${i.quantity})`
                  )
                  .join(', ')}
              </span>
            </div>

            <div className="pt-2 border-t border-[var(--c-separator)] space-y-1 text-xs">
              <div className="flex items-center justify-between text-[var(--c-hint)]">
                <span>{copy.itemsSubtotal}</span>
                <span className="tabular font-medium text-[var(--c-text)]">
                  {formatCurrency(totalAmount, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[var(--c-hint)]">
                <span>
                  {copy.deliveryFeeLabel} (
                  {deliveryMethod === 'PICKUP' ? copy.pickupLabel : copy.courierLabel})
                </span>
                <span className="tabular font-medium text-[var(--c-text)]">
                  {deliveryFee === 0 ? copy.deliveryFree : formatCurrency(deliveryFee, currency)}
                </span>
              </div>
              {deliveryMethod === 'COURIER' && freeThreshold > 0 && !isFreeByThreshold && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  {copy.freeThresholdHint.replace('{amount}', formatCurrency(freeThreshold, currency))}
                </p>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-[var(--c-separator)] text-sm font-bold text-[var(--c-text)]">
                <span>{copy.totalLabel}</span>
                <span className="tabular">{formatCurrency(grandTotal, currency)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Method Selector */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--c-hint)] uppercase tracking-wide">
              {copy.deliveryMethodTitle}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMethod('COURIER')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2 ${
                  deliveryMethod === 'COURIER'
                    ? 'border-[var(--c-brand)] bg-[var(--c-brand)]/10 text-[var(--c-text)]'
                    : 'border-[var(--c-separator)] bg-[var(--c-secondary)] text-[var(--c-hint)]'
                }`}
              >
                <Truck className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold leading-tight">{copy.courierLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryMethod('PICKUP')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2 ${
                  deliveryMethod === 'PICKUP'
                    ? 'border-[var(--c-brand)] bg-[var(--c-brand)]/10 text-[var(--c-text)]'
                    : 'border-[var(--c-separator)] bg-[var(--c-secondary)] text-[var(--c-hint)]'
                }`}
              >
                <Store className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold leading-tight">{copy.pickupLabel}</span>
              </button>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[var(--c-hint)] uppercase tracking-wide">
              {t('checkout.customer_data')}
            </div>

            <div className="space-y-1.5">
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

            <div className="space-y-1.5">
              <label className="text-xs text-[var(--c-hint)] block font-medium">
                {copy.phoneLabel}
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t('checkout.phone_placeholder')}
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--c-secondary)] text-sm text-[var(--c-text)] placeholder:text-[var(--c-hint)]"
              />
              <p className="text-[11px] text-[var(--c-hint)] leading-snug">{copy.phoneHint}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[var(--c-hint)] block">
                {deliveryMethod === 'COURIER'
                  ? `${t('checkout.address')} *`
                  : copy.pickupAddressPlaceholder}
              </label>
              <input
                type="text"
                required={deliveryMethod === 'COURIER'}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder={
                  deliveryMethod === 'COURIER'
                    ? t('checkout.address_placeholder')
                    : copy.pickupAddressPlaceholder
                }
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--c-secondary)] text-sm text-[var(--c-text)] placeholder:text-[var(--c-hint)]"
              />
            </div>
          </div>

          {/* Payment Method: Paynet Xolis Only */}
          <div className="space-y-2 pt-1">
            <div className="text-xs font-semibold text-[var(--c-hint)] uppercase tracking-wide">
              {t('checkout.payment_method')}
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-500/60 bg-emerald-500/10 space-y-2">
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

              <div className="pt-2 border-t border-emerald-500/20 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{copy.channels}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--c-hint)]">{copy.paynetNote}</p>
              </div>
            </div>
          </div>

          {/* Seller Legal, Delivery & Return Policy Disclosure BEFORE Confirmation */}
          <div className="p-3.5 rounded-xl bg-[var(--c-secondary)] border border-[var(--c-separator)] space-y-2 text-[11px] text-[var(--c-hint)]">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--c-text)] text-xs">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>{copy.legalBlockTitle}</span>
            </div>

            <div className="space-y-1 leading-relaxed">
              <div>
                <span className="font-medium text-[var(--c-text)]">{copy.sellerLabel}</span>{' '}
                {theme.legalName || theme.storeName || copy.notSpecified}
                {theme.innOrPinfl ? ` · ${copy.innLabel} ${theme.innOrPinfl}` : ''}
              </div>

              <div>
                <span className="font-medium text-[var(--c-text)]">{copy.supportLabel}</span>{' '}
                {theme.supportContact || copy.notSpecified}
              </div>

              {theme.deliveryTerms && (
                <div>
                  <span className="font-medium text-[var(--c-text)]">{copy.deliveryTermsLabel}</span>{' '}
                  {theme.deliveryTerms}
                </div>
              )}

              {theme.returnPolicy && (
                <div>
                  <span className="font-medium text-[var(--c-text)]">{copy.returnPolicyLabel}</span>{' '}
                  {theme.returnPolicy}
                </div>
              )}

              {theme.privacyPolicyUrl && (
                <div className="pt-0.5">
                  <a
                    href={theme.privacyPolicyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--c-link)] underline"
                  >
                    <span>{copy.privacyLinkLabel}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {validationError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
              {validationError}
            </div>
          )}

          {/* Submit Action */}
          <div
            className="pt-2 space-y-2"
            style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}
          >
            <p className="text-[11px] text-center text-[var(--c-hint)] leading-snug">
              {copy.consentNote}
            </p>
            <button
              type="submit"
              disabled={!checkoutEnabled || isProcessing}
              className="btn-filled"
            >
              {!checkoutEnabled ? (
                <span>{copy.submitDisabledBtn}</span>
              ) : isProcessing ? (
                t('checkout.processing_btn')
              ) : (
                <span>{t('checkout.pay_button', { amount: formatCurrency(grandTotal, currency) })}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
