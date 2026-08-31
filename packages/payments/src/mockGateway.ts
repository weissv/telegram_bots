import { PaymentSessionOptions, PaymentSessionResult } from './types.js';

/**
 * Mock gateway adapter for local dev, offline orders, cash-on-delivery, and testing.
 */
export function createMockPaymentSession(options: PaymentSessionOptions): PaymentSessionResult {
  const mockId = `mock_sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const returnUrl = new URL(options.successUrl);
  returnUrl.searchParams.set('session_id', mockId);
  returnUrl.searchParams.set('status', 'mock_success');

  return {
    sessionId: mockId,
    paymentUrl: returnUrl.toString(),
    provider: 'mock',
  };
}
