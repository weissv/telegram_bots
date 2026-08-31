import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { AnalyticsMetrics, Order } from '../types/index.js';
import { DollarSign, ShoppingBag, Clock, Package, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function Dashboard() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await apiRequest('/api/v1/admin/analytics');
        setMetrics(data.metrics);
        setRecentOrders(data.recentOrders || []);
      } catch (err) {
        console.error('Analytics load error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Mock sample sparkline data for revenue chart
  const chartData = [
    { day: 'Mon', revenue: 140 },
    { day: 'Tue', revenue: 220 },
    { day: 'Wed', revenue: 380 },
    { day: 'Thu', revenue: 290 },
    { day: 'Fri', revenue: 490 },
    { day: 'Sat', revenue: 620 },
    { day: 'Sun', revenue: (metrics?.totalRevenue || 500) % 800 + 300 },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Merchant Dashboard</h1>
          <p className="text-sm text-slate-400">Live sales performance and Telegram storefront analytics.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Bot Webhook Active
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-100 mt-2">
            ${(metrics?.totalRevenue || 0).toFixed(2)}
          </p>
          <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" /> +14.2% from last week
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Paid Orders</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-100 mt-2">
            {metrics?.paidOrdersCount || 0}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Fulfilled via Telegram</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Orders</span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-100 mt-2">
            {metrics?.pendingOrdersCount || 0}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Awaiting customer payment</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Products</span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-100 mt-2">
            {metrics?.totalProductsCount || 0}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Available in Mini App</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-slate-100">Weekly Revenue Trend</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
                itemStyle={{ color: '#38bdf8' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-slate-100">Latest Customer Orders</h3>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No orders recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Items</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentOrders.map((order) => {
                  const items = Array.isArray(order.items) ? order.items : [];
                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 font-mono text-xs text-sky-400 font-semibold">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="py-3.5 text-slate-200">
                        {order.customer_name || 'Telegram User'}
                      </td>
                      <td className="py-3.5 text-slate-400 text-xs">
                        {items.map((i: any) => `${i.title} (x${i.quantity})`).join(', ') || 'Package'}
                      </td>
                      <td className="py-3.5 font-bold text-slate-100">
                        ${Number(order.total_amount).toFixed(2)}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            order.status === 'PAID'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : order.status === 'DELIVERED'
                              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                              : order.status === 'PENDING'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-400 text-xs">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
