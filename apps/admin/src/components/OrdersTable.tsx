import React from 'react';
import { Order } from '../types/index.js';
import { formatDate, formatMoney, shortOrderId } from '../lib/format.js';
import { OrderStatusLabel } from './Status.js';

interface OrdersTableProps {
  orders: Order[];
  currency: string;
  onSelect?: (order: Order) => void;
}

export function OrdersTable({ orders, currency, onSelect }: OrdersTableProps) {
  return (
    <>
      <ul className="divide-y divide-line border-y border-line md:hidden">
        {orders.map((order) => {
          const content = (
            <>
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{order.customer_name || 'Покупатель Telegram'}</span>
                <span className="font-medium">{formatMoney(Number(order.total_amount), currency)}</span>
              </span>
              <span className="mt-1 flex items-center justify-between gap-3 text-muted text-xs">
                <span>
                  {shortOrderId(order.id)} · {formatDate(order.createdAt, true)}
                </span>
                <span className="text-ink">
                  <OrderStatusLabel status={order.status} />
                </span>
              </span>
              {order.payment_id && (
                <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-mono text-emerald-800">
                  Paynet ID: {order.payment_id}
                </span>
              )}
            </>
          );

          return (
            <li key={order.id} className="px-3">
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(order)}
                  className="block w-full py-3 text-left"
                >
                  {content}
                </button>
              ) : (
                <div className="py-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      <table className="data-table hidden md:table">
        <thead>
          <tr>
            <th scope="col" className="!pl-4">Заказ</th>
            <th scope="col">Покупатель</th>
            <th scope="col">Сумма</th>
            <th scope="col">Оплата / Чек</th>
            <th scope="col">Статус</th>
            <th scope="col">Дата</th>
            {onSelect && (
              <th scope="col" className="!pr-4 text-right">
                <span className="sr-only">Действия</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="!pl-4 font-mono text-xs">{shortOrderId(order.id)}</td>
              <td>
                <div className="font-medium text-ink">
                  {order.customer_name || 'Покупатель Telegram'}
                </div>
                <div className="text-muted text-xs">
                  {order.customer_phone ? `${order.customer_phone} · ` : ''}
                  TG {order.customer_telegram_id}
                </div>
              </td>
              <td className="font-medium whitespace-nowrap">
                {formatMoney(Number(order.total_amount), currency)}
              </td>
              <td>
                <div className="space-y-1">
                  {order.payment_method === 'PAYNET_XOLIS' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
                      Paynet QR
                    </span>
                  ) : order.payment_method === 'TELEGRAM_STARS' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800">
                      Stars ⭐
                    </span>
                  ) : (
                    <span className="text-muted text-xs">{order.payment_method || '—'}</span>
                  )}
                  {order.payment_id && (
                    <div className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 inline-block ml-1">
                      #{order.payment_id}
                    </div>
                  )}
                </div>
              </td>
              <td>
                <OrderStatusLabel status={order.status} />
              </td>
              <td className="whitespace-nowrap text-muted text-xs">
                {formatDate(order.createdAt, true)}
              </td>
              {onSelect && (
                <td className="text-right !pr-4">
                  <button
                    type="button"
                    onClick={() => onSelect(order)}
                    className={`text-xs font-medium ${
                      order.status === 'PAYMENT_REVIEW'
                        ? 'px-2.5 py-1 rounded bg-sky-600 text-white hover:bg-sky-700'
                        : 'link'
                    }`}
                  >
                    {order.status === 'PAYMENT_REVIEW' ? 'Проверить оплату' : 'Открыть'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
