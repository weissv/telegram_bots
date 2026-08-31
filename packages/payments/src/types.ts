export interface PaymentSessionOptions {
  orderId: string;
  tenantId: string;
  amount: number;
  currency: string;
  customerTelegramId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface PaymentSessionResult {
  sessionId: string;
  paymentUrl: string;
  provider: 'stripe' | 'telegram_stars' | 'mock';
}

export interface SubscriptionCheckoutOptions {
  telegramUserId: string;
  plan: 'BASIC_20' | 'PRO_30' | 'STANDALONE_LIFETIME';
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}
