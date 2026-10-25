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
              <span className="mt-1 flex items-center justify-between gap-3 text-muted">
                <span>
                  {shortOrderId(order.id)} · {formatDate(order.createdAt)}
                </span>
                <span className="text-ink">
                  <OrderStatusLabel status={order.status} />
                </span>
              </span>
            </>
          );

          return (
            <li key={order.id}>
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
            <th scope="col">Заказ</th>
            <th scope="col">Покупатель</th>
            <th scope="col">Сумма</th>
            <th scope="col">Оплата</th>
            <th scope="col">Статус</th>
            <th scope="col">Дата</th>
            {onSelect && (
              <th scope="col">
                <span className="sr-only">Действия</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{shortOrderId(order.id)}</td>
              <td>
                <div>{order.customer_name || 'Покупатель Telegram'}</div>
                <div className="text-muted">ID {order.customer_telegram_id}</div>
              </td>
              <td>{formatMoney(Number(order.total_amount), currency)}</td>
              <td>
                {order.payment_method === 'PAYNET_XOLIS' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
                    Paynet Xolis (0%)
                  </span>
                ) : order.payment_method === 'TELEGRAM_STARS' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800">
                    Stars ⭐
                  </span>
                ) : (
                  <span className="text-muted text-xs">{order.payment_method || '—'}</span>
                )}
              </td>
              <td>
                <OrderStatusLabel status={order.status} />
              </td>
              <td className="whitespace-nowrap text-muted">{formatDate(order.createdAt)}</td>
              {onSelect && (
                <td className="text-right">
                  <button type="button" onClick={() => onSelect(order)} className="link">
                    Открыть
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
