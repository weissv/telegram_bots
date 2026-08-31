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
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  tenant_id: string;
  customer_telegram_id: string;
  customer_name?: string;
  customer_phone?: string;
  shipping_address?: string;
  total_amount: string | number;
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'CANCELLED';
  payment_method: string;
  items: OrderItem[];
  createdAt: string;
}

export interface AnalyticsMetrics {
  totalRevenue: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  totalProductsCount: number;
  averageOrderValue: number;
}

export interface MerchantProfile {
  user: {
    userId: string;
    email: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    plan: string;
    isActive: boolean;
    ownerTelegramId?: string;
    botConfig: {
      botUsername?: string;
      currency?: string;
      themeConfig?: any;
    };
  };
}
