import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { TenantDbClient } from '@telegram-commerce/database';
import type { Locale } from '@telegram-commerce/i18n';

export interface CartItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
}

export interface SessionData {
  cart: CartItem[];
  currentCategory?: string;
  catalogPage?: number;
  customerPhone?: string;
  shippingAddress?: string;
  locale: Locale;
  languageSelected: boolean;
}

export interface TenantInfo {
  id: string;
  name: string;
  plan: 'BASIC_20' | 'PRO_30' | 'STANDALONE_LIFETIME';
  ownerTelegramId?: string;
  currency: string;
  themeConfig: {
    storeName?: string;
    bannerUrl?: string;
    logoUrl?: string;
    primaryColor?: string;
    description?: string;
  };
}

export type BaseBotContext = Context & SessionFlavor<SessionData>;

export type BotContext = ConversationFlavor<BaseBotContext> & {
  tenant: TenantInfo;
  db: TenantDbClient;
  locale: Locale;
};
