import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { TenantDbClient } from '@telegram-commerce/database';
import type { Locale } from '@telegram-commerce/i18n';

export interface CartItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  variant?: string;
}

export type CheckoutStep =
  | 'awaiting_phone'
  | 'awaiting_delivery_method'
  | 'awaiting_address'
  | 'awaiting_confirm';

export type DeliveryMethod = 'COURIER' | 'PICKUP';

export interface SessionData {
  cart: CartItem[];
  currentCategory?: string;
  catalogPage?: number;
  customerPhone?: string;
  shippingAddress?: string;
  deliveryMethod?: DeliveryMethod;
  checkoutStep?: CheckoutStep;
  locale: Locale;
  languageSelected: boolean;
}

export interface TenantInfo {
  id: string;
  name: string;
  plan: 'BASIC_20' | 'PRO_30' | 'STANDALONE_LIFETIME';
  ownerTelegramId?: string;
  currency: string;
  isActive?: boolean;
  botConfigActive?: boolean;
  themeConfig: {
    storeName?: string;
    bannerUrl?: string;
    logoUrl?: string;
    primaryColor?: string;
    description?: string;
    paynetEnabled?: boolean;
    paynetQrUrl?: string;
    deliveryFeeUzs?: number;
    freeDeliveryThresholdUzs?: number;
    deliveryTerms?: string;
    legalName?: string;
    innOrPinfl?: string;
    supportContact?: string;
    returnPolicy?: string;
    privacyPolicyUrl?: string;
    isDemo?: boolean;
  };
}

export type BaseBotContext = Context & SessionFlavor<SessionData>;

export type BotContext = ConversationFlavor<BaseBotContext> & {
  tenant: TenantInfo;
  db: TenantDbClient;
  locale: Locale;
};
