import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { Order } from '../types/index.js';
import { ShoppingBag, Eye, Check, Truck, XCircle, Search } from 'lucide-react';
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
      alert(`Status update failed: ${err.message}`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Customer Orders</h1>
          <p className="text-sm text-slate-400">Track and fulfill purchases from your Telegram storefront.</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by Order ID, Customer name, or Telegram ID..."
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
            <p className="text-sm text-slate-400">No orders found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Payment</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 font-mono text-xs text-sky-400 font-semibold">
                      #{order.id.slice(0, 8)}
                    </td>
                    <td className="py-3.5">
                      <div className="font-semibold text-slate-200">
                        {order.customer_name || 'Telegram User'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        TG: {order.customer_telegram_id}
                      </div>
                    </td>
                    <td className="py-3.5 font-bold text-slate-100">
                      ${Number(order.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 text-xs text-slate-400">
                      {order.payment_method}
                    </td>
                    <td className="py-3.5">
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1 bg-slate-800 border focus:outline-none ${
                          order.status === 'PAID'
                            ? 'text-emerald-400 border-emerald-500/30'
                            : order.status === 'DELIVERED'
                            ? 'text-sky-400 border-sky-500/30'
                            : order.status === 'PENDING'
                            ? 'text-amber-400 border-amber-500/30'
                            : 'text-rose-400 border-rose-500/30'
                        }`}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PAID">PAID</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </td>
                    <td className="py-3.5 text-xs text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Order #${selectedOrder.id.slice(0, 8)}`}
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-750">
              <div>
                <span className="text-xs text-slate-400">Customer Name</span>
                <p className="font-semibold text-slate-200">{selectedOrder.customer_name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Telegram User ID</span>
                <p className="font-mono text-xs text-slate-300">{selectedOrder.customer_telegram_id}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Phone Number</span>
                <p className="text-slate-300">{selectedOrder.customer_phone || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Delivery Address</span>
                <p className="text-slate-300">{selectedOrder.shipping_address || 'Digital'}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Itemized Products</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(Array.isArray(selectedOrder.items) ? selectedOrder.items : []).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800">
                    <span className="text-slate-200 font-medium">{item.title}</span>
                    <span className="text-slate-400 text-xs">
                      {item.quantity} × ${Number(item.price).toFixed(2)} = <b className="text-slate-100">${(item.quantity * Number(item.price)).toFixed(2)}</b>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 font-bold">
              <span className="text-slate-300">Total Order Amount:</span>
              <span className="text-lg text-sky-400">${Number(selectedOrder.total_amount).toFixed(2)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
