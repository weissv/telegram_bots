import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { Order } from '../types/index.js';
import { Search, ShoppingBag, Eye, User, Phone, MapPin, CreditCard, Calendar } from 'lucide-react';
import { Modal } from '@telegram-commerce/ui';
import { OrdersTable } from '../components/OrdersTable.js';
import { OrderStatusLabel, ORDER_STATUS } from '../components/Status.js';
import { formatDate, formatMoney, shortOrderId } from '../lib/format.js';

export function Orders({ currency = 'UZS' }: { currency?: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest<{ orders: Order[] }>('/api/v1/admin/orders');
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      setIsUpdatingStatus(true);
      await apiRequest(`/api/v1/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: status as any });
      }
    } catch (err: any) {
      alert(`Ошибка обновления статуса: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const filtered = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_telegram_id.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1>Заказы</h1>
          <p className="hint">Список заказов клиентов, управление статусами доставки и оплаты.</p>
        </div>
      </div>

      {/* Search & Stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по номеру, имени или Telegram ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="text-xs text-muted">
          Всего заказов: <span className="font-semibold text-ink">{orders.length}</span>
        </div>
      </div>

      {/* Orders List Container */}
      <div className="rounded-md border border-line bg-paper overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted">Загрузка заказов…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <ShoppingBag className="w-8 h-8 text-muted mx-auto" />
            <p className="text-sm font-medium">Заказы не найдены</p>
            <p className="hint">Когда покупатели оформят заказы через Mini App, они появятся здесь.</p>
          </div>
        ) : (
          <OrdersTable
            orders={filtered}
            currency={currency}
            onSelect={(order) => setSelectedOrder(order)}
          />
        )}
      </div>

      {/* Order Details Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Заказ ${shortOrderId(selectedOrder.id)}` : 'Детали заказа'}
      >
        {selectedOrder && (
          <div className="space-y-5 text-sm">
            {/* Status & Quick Change */}
            <div className="rounded-md border border-line bg-subtle/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted uppercase">Текущий статус</span>
                <OrderStatusLabel status={selectedOrder.status} />
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-line">
                <span className="text-xs text-muted">Изменить:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ORDER_STATUS) as Array<keyof typeof ORDER_STATUS>).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={isUpdatingStatus || selectedOrder.status === st}
                      onClick={() => handleUpdateStatus(selectedOrder.id, st)}
                      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                        selectedOrder.status === st
                          ? 'border-ink bg-ink text-paper font-medium'
                          : 'border-line bg-paper text-ink hover:bg-subtle disabled:opacity-40'
                      }`}
                    >
                      {ORDER_STATUS[st].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted uppercase">Данные покупателя</h3>
              <div className="rounded-md border border-line p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Имя:</span>
                  <span className="font-medium text-ink">{selectedOrder.customer_name || 'Не указано'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Telegram ID:</span>
                  <span className="font-mono text-ink">{selectedOrder.customer_telegram_id}</span>
                </div>
                {selectedOrder.customer_phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Телефон:</span>
                    <a href={`tel:${selectedOrder.customer_phone}`} className="link">
                      {selectedOrder.customer_phone}
                    </a>
                  </div>
                )}
                {selectedOrder.shipping_address && (
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-muted">Адрес доставки:</span>
                    <span className="text-right text-ink">{selectedOrder.shipping_address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted uppercase">Состав заказа</h3>
              <div className="rounded-md border border-line divide-y divide-line overflow-hidden">
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-medium text-ink">{item.title}</div>
                        <div className="text-muted">
                          {item.quantity} шт. × {formatMoney(Number(item.price), currency)}
                        </div>
                      </div>
                      <div className="font-medium">
                        {formatMoney(Number(item.price) * item.quantity, currency)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-xs text-muted">Список позиций пуст</div>
                )}
                <div className="p-3 bg-subtle/50 flex items-center justify-between text-xs font-semibold">
                  <span>Итого к оплате:</span>
                  <span className="text-sm">{formatMoney(Number(selectedOrder.total_amount), currency)}</span>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-line">
              <span>Способ оплаты: <strong className="text-ink">{selectedOrder.payment_method || 'MOCK'}</strong></span>
              <span>Дата: {formatDate(selectedOrder.createdAt)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
