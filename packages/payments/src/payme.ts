import crypto from 'node:crypto';
import type { PaymentSessionOptions, PaymentSessionResult } from './types.js';

const PAYME_CHECKOUT_URL = 'https://checkout.paycom.uz';

export interface PaymeConfig {
  merchantId: string;
  merchantKey: string;
}

/**
 * Creates a Payme checkout session URL with base64-encoded merchant params.
 * Payme expects parameters encoded in the URL fragment.
 */
export function createPaymeCheckoutSession(
  options: PaymentSessionOptions,
  config: PaymeConfig
): PaymentSessionResult {
  const amountInTiyin = Math.round(options.amount * 100); // Payme uses tiyin (1/100 of so'm)

  const params = Buffer.from(
    JSON.stringify({
      m: config.merchantId,
      ac: {
        order_id: options.orderId,
        tenant_id: options.tenantId,
      },
      a: amountInTiyin,
      c: options.successUrl,
    })
  ).toString('base64');

  const paymentUrl = `${PAYME_CHECKOUT_URL}/${params}`;

  return {
    sessionId: `payme_${options.orderId}`,
    paymentUrl,
    provider: 'payme',
  };
}

/**
 * Verifies Payme webhook callback signature.
 * Payme sends Basic Auth header with merchantId:merchantKey.
 */
export function verifyPaymeCallback(
  authorizationHeader: string,
  merchantKey: string
): boolean {
  if (!authorizationHeader || !authorizationHeader.startsWith('Basic ')) {
    return false;
  }

  const base64Credentials = authorizationHeader.substring(6);
  const decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [, key] = decoded.split(':');

  return key === merchantKey;
}

/**
 * Processes Payme JSON-RPC method calls.
 * Supports: CheckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction, CheckTransaction
 */
export function handlePaymeRpcMethod(method: string, params: any): { result?: any; error?: any } {
  switch (method) {
    case 'CheckPerformTransaction':
      return {
        result: {
          allow: true,
        },
      };

    case 'CreateTransaction':
      return {
        result: {
          create_time: Date.now(),
          transaction: params.id,
          state: 1,
        },
      };

    case 'PerformTransaction':
      return {
        result: {
          transaction: params.id,
          perform_time: Date.now(),
          state: 2,
        },
      };

    case 'CancelTransaction':
      return {
        result: {
          transaction: params.id,
          cancel_time: Date.now(),
          state: -1,
        },
      };

    case 'CheckTransaction':
      return {
        result: {
          create_time: Date.now(),
          perform_time: Date.now(),
          cancel_time: 0,
          transaction: params.id,
          state: 2,
          reason: null,
        },
      };

    default:
      return {
        error: {
          code: -32601,
          message: { ru: 'Метод не найден', uz: "Metod topilmadi" },
        },
      };
  }
}
