export interface Product {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  price: string | number;
  stock: number;
  images: string[];
  variants?: string[];
  category: string;
  is_active: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  variant?: string;
}

export type DeliveryMethod = 'COURIER' | 'PICKUP';

export interface StoreTheme {
  storeName?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  bannerUrl?: string;
  logoUrl?: string;
  description?: string;
  currency?: string;
  currencySymbol?: string;
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
}

export interface ShopBootstrap {
  tenant: {
    id: string;
    name: string;
    plan: string;
    currency: string;
    isActive: boolean;
  };
  theme: StoreTheme;
  categories: string[];
  featuredProducts: Product[];
  checkoutEnabled?: boolean;
  isDemo?: boolean;
  checkoutDisabledReason?: string | null;
}

export interface ActiveOrderState {
  orderId: string;
  accessToken: string;
  amount: number;
  paynetUrl: string;
  status: string;
  itemsCount?: number;
}
