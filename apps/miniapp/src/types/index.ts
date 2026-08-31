export interface Product {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  price: string | number;
  stock: number;
  images: string[];
  category: string;
  is_active: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

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
}
