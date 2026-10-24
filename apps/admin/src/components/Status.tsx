import React from 'react';
import { Order } from '../types/index.js';

type Tone = 'amber' | 'green' | 'red' | 'gray';

const TONE_CLASS: Record<Tone, string> = {
  amber: 'bg-amber-500',
  green: 'bg-green-600',
  red: 'bg-red-600',
  gray: 'bg-muted',
};

export const ORDER_STATUS: Record<Order['status'], { label: string; tone: Tone }> = {
  PENDING: { label: 'Ожидает оплаты', tone: 'amber' },
  PAID: { label: 'Оплачен', tone: 'green' },
  DELIVERED: { label: 'Доставлен', tone: 'gray' },
  CANCELLED: { label: 'Отменён', tone: 'red' },
};

export function Dot({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_CLASS[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function OrderStatusLabel({ status }: { status: Order['status'] }) {
  const entry = ORDER_STATUS[status];
  if (!entry) return <Dot tone="gray">{status}</Dot>;
  return <Dot tone={entry.tone}>{entry.label}</Dot>;
}
