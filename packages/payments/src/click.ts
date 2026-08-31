import crypto from 'node:crypto';
import type { PaymentSessionOptions, PaymentSessionResult } from './types.js';

const CLICK_CHECKOUT_URL = 'https://my.click.uz/services/pay';

export interface ClickConfig {
  serviceId: string;
  merchantId: string;
  secretKey: string;
}

/**
 * Creates a Click checkout session URL with query parameters.
 */
export function createClickCheckoutSession(
  options: PaymentSessionOptions,
  config: ClickConfig
): PaymentSessionResult {
  const amountInSom = options.amount; // Click uses so'm directly

  const params = new URLSearchParams({
    service_id: config.serviceId,
    merchant_id: config.merchantId,
    amount: String(amountInSom),
    transaction_param: options.orderId,
    return_url: options.successUrl,
  });

  const paymentUrl = `${CLICK_CHECKOUT_URL}?${params.toString()}`;

  return {
    sessionId: `click_${options.orderId}`,
    paymentUrl,
    provider: 'click',
  };
}

/**
 * Verifies Click "Prepare" callback signature.
 *
 * Sign string: click_trans_id + service_id + secret_key + merchant_trans_id +
 *              merchant_prepare_id + amount + action + sign_time
 */
export function verifyClickPrepare(params: Record<string, string>, secretKey: string): boolean {
  const signString = [
    params.click_trans_id,
    params.service_id,
    secretKey,
    params.merchant_trans_id,
    params.merchant_prepare_id || '',
    params.amount,
    params.action,
    params.sign_time,
  ].join('');

  const expectedSign = crypto
    .createHash('md5')
    .update(signString)
    .digest('hex');

  return expectedSign === params.sign_string;
}

/**
 * Verifies Click "Complete" callback signature.
 *
 * Sign string: click_trans_id + service_id + secret_key + merchant_trans_id +
 *              merchant_prepare_id + amount + action + sign_time
 */
export function verifyClickComplete(params: Record<string, string>, secretKey: string): boolean {
  const signString = [
    params.click_trans_id,
    params.service_id,
    secretKey,
    params.merchant_trans_id,
    params.merchant_prepare_id,
    params.amount,
    params.action,
    params.sign_time,
  ].join('');

  const expectedSign = crypto
    .createHash('md5')
    .update(signString)
    .digest('hex');

  return expectedSign === params.sign_string;
}
