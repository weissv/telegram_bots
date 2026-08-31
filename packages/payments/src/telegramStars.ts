import { PaymentSessionOptions, PaymentSessionResult } from './types.js';

export interface TelegramStarsInvoiceParams {
  title: string;
  description: string;
  payload: string;
  currency: string; // "XTR" for Telegram Stars
  prices: Array<{ label: string; amount: number }>; // Stars amount
}

/**
 * Helper to build Telegram Stars / Digital Goods invoice parameters.
 */
export function buildStarsInvoice(options: PaymentSessionOptions): TelegramStarsInvoiceParams {
  // 1 Star is approx $0.02, or custom 1:1 mapping based on merchant preference
  const starAmount = Math.max(1, Math.round(options.amount * 50));

  return {
    title: `Order #${options.orderId.slice(0, 8)}`,
    description: `Payment for order items in ${options.currency}`,
    payload: JSON.stringify({
      orderId: options.orderId,
      tenantId: options.tenantId,
      customerTelegramId: options.customerTelegramId,
    }),
    currency: 'XTR',
    prices: [{ label: 'Total', amount: starAmount }],
  };
}
