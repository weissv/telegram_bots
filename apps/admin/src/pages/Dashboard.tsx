import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { AnalyticsResponse } from '../types/index.js';
import { formatDayLabel, formatMoney } from '../lib/format.js';
import { OrdersTable } from '../components/OrdersTable.js';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const compactNumber = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

export function Dashboard({ currency }: { currency: string }) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<AnalyticsResponse>('/api/v1/admin/analytics')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <p role="alert" className="text-red-700">Не удалось загрузить данные: {error}</p>;
  }

  if (!data) {
    return <p className="text-muted">Загрузка…</p>;
  }

  const { metrics, recentOrders } = data;
  const revenueByDay = data.revenueByDay ?? [];
  const periodRevenue = revenueByDay.reduce((sum, d) => sum + d.revenue, 0);
  const periodOrders = revenueByDay.reduce((sum, d) => sum + d.orders, 0);

  const stats = [
    { label: 'Выручка', value: formatMoney(metrics.totalRevenue, currency) },
    { label: 'Оплаченные заказы', value: String(metrics.paidOrdersCount) },
    { label: 'Ожидают оплаты', value: String(metrics.pendingOrdersCount) },
    { label: 'Товаров в каталоге', value: String(metrics.totalProductsCount) },
  ];

  return (
    <div className="space-y-8">
      <h1>Обзор</h1>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border border-line p-4">
            <dt className="text-muted">{stat.label}</dt>
            <dd className="mt-1 break-words text-2xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="revenue-heading">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="revenue-heading">Выручка за 14 дней</h2>
          {periodOrders > 0 && (
            <p className="text-muted">
              {formatMoney(periodRevenue, currency)} · заказов: {periodOrders}
            </p>
          )}
        </div>
        {periodOrders === 0 ? (
          <p className="text-muted">За последние 14 дней оплаченных заказов не было.</p>
        ) : (
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByDay} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#e6e6e1" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDayLabel}
                  tickLine={false}
                  axisLine={{ stroke: '#e6e6e1' }}
                  tick={{ fill: '#6b6b66', fontSize: 12 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={(value: number) => compactNumber.format(value)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#6b6b66', fontSize: 12 }}
                  width={48}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value), currency)}
                  labelFormatter={(label) => formatDayLabel(String(label))}
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e6e6e1',
                    borderRadius: 6,
                    boxShadow: 'none',
                    fontSize: 13,
                  }}
                  itemStyle={{ color: '#18181b' }}
                  cursor={{ stroke: '#e6e6e1' }}
                />
                <Area
                  type="linear"
                  dataKey="revenue"
                  name="Выручка"
                  stroke="#18181b"
                  strokeWidth={1.5}
                  fill="#18181b"
                  fillOpacity={0.05}
                  dot={false}
                  activeDot={{ r: 3, fill: '#18181b', stroke: '#ffffff' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-3">Последние заказы</h2>
        {recentOrders.length === 0 ? (
          <p className="text-muted">Заказов пока нет.</p>
        ) : (
          <OrdersTable orders={recentOrders} currency={currency} />
        )}
      </section>
    </div>
  );
}
