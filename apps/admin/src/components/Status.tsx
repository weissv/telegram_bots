import React from 'react';
import { Order } from '../types/index.js';

type Tone = 'amber' | 'blue' | 'green' | 'red' | 'gray';

const TONE_CLASS: Record<Tone, string> = {
  amber: 'bg-amber-500',
  blue: 'bg-sky-600',
  green: 'bg-green-600',
  red: 'bg-red-600',
  gray: 'bg-muted',
};

export const ORDER_STATUS: Record<Order['status'], { label: string; tone: Tone }> = {
  PENDING: { label: 'Ожидает оплаты', tone: 'amber' },
  PAYMENT_REVIEW: { label: 'На проверке оплаты', tone: 'blue' },
  PAID: { label: 'Оплачен (в сборке)', tone: 'green' },
  DELIVERED: { label: 'Доставлен', tone: 'gray' },
  CANCELLED: { label: 'Отменён', tone: 'red' },
  REFUNDED: { label: 'Возврат', tone: 'red' },
};

export const SUBSCRIPTION_STATUS_META: Record<
  string,
  { label: string; badgeClass: string; tone: Tone }
> = {
  PENDING_PAYMENT: {
    label: 'Ожидает оплаты',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    tone: 'amber',
  },
  PENDING_REVIEW: {
    label: 'На проверке оплаты',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    tone: 'blue',
  },
  TRIALING: {
    label: 'Пробный период',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    tone: 'blue',
  },
  ACTIVE: {
    label: 'Активна',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    tone: 'green',
  },
  PAST_DUE: {
    label: 'Просрочена / Приостановлена',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    tone: 'red',
  },
  CANCELED: {
    label: 'Отменена',
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    tone: 'gray',
  },
};

export function Dot({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_CLASS[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function OrderStatusLabel({ status }: { status: Order['status'] | string }) {
  const entry = ORDER_STATUS[status as Order['status']];
  if (!entry) return <Dot tone="gray">{status}</Dot>;
  return <Dot tone={entry.tone}>{entry.label}</Dot>;
}

export function SubscriptionStatusBadge({ status }: { status?: string }) {
  const key = (status || 'PENDING_PAYMENT').toUpperCase();
  const meta = SUBSCRIPTION_STATUS_META[key] || {
    label: key,
    badgeClass: 'bg-subtle text-muted border-line',
    tone: 'gray' as Tone,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold ${meta.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_CLASS[meta.tone]}`} />
      <span>{meta.label}</span>
    </span>
  );
}
