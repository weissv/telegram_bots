import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { Order } from '../types/index.js';
import { ShoppingBag, Eye, Check, Truck, XCircle, Search, User, Phone, MapPin, CreditCard } from 'lucide-react';
import { Modal } from '@telegram-commerce/ui';

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest('/api/v1/admin/orders');
      setOrders(data.orders || []);
    } catch (err) {
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
    }
  };

  const filtered = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_telegram_id.includes(search)
  );

  const statusMap: Record<string, { label: string; class: string }> = {
    PAID: { label: 'Оплачен', class: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
    DELIVERED: { label: 'Доставлен', class: 'bg-sky-500/15 text-sky-400 border border-sky-500/30' },
    PENDING: { label: 'Ожидает оплаты', class: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
    CANCELLED: { label: 'Отменён', class: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Заказы покупателей</h1>
          <p className="text-sm text-slate-400">Отслеживание и управление заказами из витрины Telegram.</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Поиск по номеру заказа, имени или Telegram ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
        />
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">Заказы не найдены.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="pb-3">Номер заказа</th>
                  <th className="pb-3">Покупатель</th>
                  <th className="pb-3">Сумма</th>
                  <th className="pb-3">Оплата</th>
                  <th className="pb-3">Статус</th>
                  <th className="pb-3">Дата</th>
                  <th className="pb-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((order) => {
                  const s = statusMap[order.status] || { label: order.status, class: 'bg-slate-700 text-slate-300' };

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 font-mono text-xs text-sky-400 font-semibold">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="py-3.5">
                        <div className="font-medium text-slate-100">
                          {order.customer_name || 'Покупатель Telegram'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          TG ID: {order.customer_telegram_id}
                        </div>
                      </td>
                      <td className="py-3.5 font-bold text-slate-100">
                        ${Number(order.total_amount).toFixed(2)}
                      </td>
                      <td className="py-3.5 text-xs text-slate-300">
                        {order.payment_method || 'STRIPE'}
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.class}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-400 text-xs">
                        {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
                        >
                          Детали
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <Modal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          title={`Детали заказа #${selectedOrder.id.slice(0, 8)}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-400" />
                  Покупатель:
                </span>
                <p className="font-bold text-slate-100">{selectedOrder.customer_name || 'Не указано'}</p>
                <p className="text-[11px] text-slate-400">TG ID: {selectedOrder.customer_telegram_id}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-sky-400" />
                  Телефон:
                </span>
                <p className="font-bold text-slate-100">{selectedOrder.customer_phone || 'Не указан'}</p>
              </div>

              <div className="col-span-2 space-y-1 pt-2 border-t border-slate-700/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  Адрес доставки / комментарий:
                </span>
                <p className="text-slate-200">{selectedOrder.shipping_address || 'Telegram доставка'}</p>
              </div>
            </div>

            {/* Items list */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Состав заказа</h4>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-800/40">
                {(Array.isArray(selectedOrder.items) ? selectedOrder.items : []).map((item: any, idx: number) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-100">{item.title}</p>
                      <p className="text-slate-400">{item.quantity} шт. × ${Number(item.price).toFixed(2)}</p>
                    </div>
                    <span className="font-bold text-slate-100">
                      ${(item.quantity * Number(item.price)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-sm">
              <span className="text-slate-400">Итоговая сумма:</span>
              <span className="text-lg font-bold text-sky-400">
                ${Number(selectedOrder.total_amount).toFixed(2)}
              </span>
            </div>

            {/* Status change actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="text-xs text-slate-400">Сменить статус заказа:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'PAID')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-semibold border border-emerald-500/30 transition-colors"
                >
                  ✓ Отметить оплаченным
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'DELIVERED')}
                  className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 text-xs font-semibold border border-sky-500/30 transition-colors"
                >
                  🚚 Отметить доставленным
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'CANCELLED')}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-xs font-semibold border border-rose-500/30 transition-colors"
                >
                  ✕ Отменить заказ
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
