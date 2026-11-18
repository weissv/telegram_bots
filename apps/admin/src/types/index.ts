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
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  variant?: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_REVIEW'
  | 'PAID'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface OrderStatusHistoryEntry {
  status: string;
  at: string;
  by?: string;
  note?: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  customer_telegram_id: string;
  customer_name?: string;
  customer_phone?: string;
  shipping_address?: string;
  delivery_method?: string;
  delivery_fee?: string | number;
  total_amount: string | number;
  status: OrderStatus;
  payment_method: string;
  payment_id?: string | null;
  receipt_url?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  status_history?: OrderStatusHistoryEntry[];
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

export interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

export interface AnalyticsResponse {
  metrics: AnalyticsMetrics;
  recentOrders: Order[];
  revenueByDay: DailyRevenue[];
}

export interface MerchantReadiness {
  botConnected: boolean;
  paynetConfigured: boolean;
  legalConfigured: boolean;
  hasActiveProduct: boolean;
  canPublish: boolean;
}

export interface SubscriptionRecord {
  id: string;
  plan?: string;
  status: string;
  invoice_number?: string | null;
  amount_uzs?: number | null;
  payment_reference?: string | null;
  current_period_end?: string | null;
  createdAt?: string;
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
    subscriptionStatus?: string;
    ownerTelegramId?: string;
    botConfig: {
      botUsername?: string;
      currency?: string;
      isActive?: boolean;
      themeConfig?: any;
    };
    subscriptions?: SubscriptionRecord[];
  };
  readiness?: MerchantReadiness;
  subscription?: SubscriptionRecord | null;
  latestSubscription?: SubscriptionRecord | null;
}
