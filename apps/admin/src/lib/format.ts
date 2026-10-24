const PLAN_LABELS: Record<string, string> = {
  BASIC_20: 'Базовый · $20/мес',
  PRO_30: 'Pro · $30/мес',
  STANDALONE_LIFETIME: 'Standalone',
};

export function planLabel(plan: string | undefined): string {
  if (!plan) return '';
  return PLAN_LABELS[plan] ?? plan;
}

/**
 * Formats an amount in the tenant currency. Codes that Intl does not know
 * (for example XTR, Telegram Stars) fall back to "number CODE".
 */
export function formatMoney(amount: number, currency: string): string {
  if (currency !== 'XTR') {
    try {
      return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(amount);
    } catch {
      // Invalid currency code: use the plain-number fallback below.
    }
  }
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
}

export function formatDate(iso: string, withTime = false): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('ru-RU');
  if (!withTime) return day;
  return `${day}, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Turns a 'YYYY-MM-DD' key into dd.MM. */
export function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
}

export function shortOrderId(id: string): string {
  return `#${id.slice(0, 8)}`;
}
