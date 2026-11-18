import React, { useEffect, useState } from 'react';
import { API_BASE, apiRequest, getAuthToken } from '../api/client.js';
import { Order, OrderStatusHistoryEntry } from '../types/index.js';
import {
  Search,
  ShoppingBag,
  Download,
  CheckCircle2,
  Truck,
  XCircle,
  RotateCcw,
  ExternalLink,
  Clock,
  Receipt,
} from 'lucide-react';
import { Modal } from '@telegram-commerce/ui';
import { OrdersTable } from '../components/OrdersTable.js';
import { OrderStatusLabel, ORDER_STATUS } from '../components/Status.js';
import { formatDate, formatMoney, shortOrderId } from '../lib/format.js';

type QueueFilter =
  | 'ALL'
  | 'PAYMENT_REVIEW'
  | 'PENDING'
  | 'PAID'
  | 'DELIVERED'
  | 'CANCELLED_REFUNDED';

const QUEUE_TABS: Array<{ id: QueueFilter; label: string }> = [
  { id: 'ALL', label: 'Все' },
  { id: 'PAYMENT_REVIEW', label: 'На проверке оплаты' },
  { id: 'PENDING', label: 'Ожидают оплаты' },
  { id: 'PAID', label: 'Оплачены' },
  { id: 'DELIVERED', label: 'Доставлены' },
  { id: 'CANCELLED_REFUNDED', label: 'Отменены / Возврат' },
];

export function Orders({ currency = 'UZS' }: { currency?: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [activeQueue, setActiveQueue] = useState<QueueFilter>('ALL');

  // Verification / action form state for selected order
  const [paymentIdInput, setPaymentIdInput] = useState('');
  const [receiptUrlInput, setReceiptUrlInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest<{ orders: Order[] }>('/api/v1/admin/orders');
      const list = data.orders || [];
      setOrders(list);
      setSelectedOrder((prev) => (prev ? list.find((o) => o.id === prev.id) || prev : null));
    } catch (err: any) {
      console.error('Failed to load orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setPaymentIdInput(order.payment_id || '');
    setReceiptUrlInput(order.receipt_url || '');
    setNoteInput('');
    setActionError(null);
  };

  const handleUpdateOrder = async (
    orderId: string,
    status: Order['status'],
    options?: { requirePaymentId?: boolean; confirmText?: string }
  ) => {
    setActionError(null);

    if (options?.requirePaymentId && !paymentIdInput.trim()) {
      setActionError(
        'Укажите номер транзакции или квитанции Paynet (paymentId), чтобы подтвердить поступление оплаты.'
      );
      return;
    }

    if (options?.confirmText && !confirm(options.confirmText)) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      const res = await apiRequest<{ order: Order }>(`/api/v1/admin/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          ...(paymentIdInput.trim() ? { paymentId: paymentIdInput.trim() } : {}),
          ...(receiptUrlInput.trim() ? { receiptUrl: receiptUrlInput.trim() } : {}),
          ...(noteInput.trim() ? { note: noteInput.trim() } : {}),
        }),
      });

      if (res.order) {
        setSelectedOrder(res.order);
        setNoteInput('');
      }
      await loadOrders();
    } catch (err: any) {
      setActionError(err?.message || 'Ошибка обновления заказа');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/orders/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || 'Не удалось экспортировать заказы');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Ошибка экспорта CSV: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const counts = {
    ALL: orders.length,
    PAYMENT_REVIEW: orders.filter((o) => o.status === 'PAYMENT_REVIEW').length,
    PENDING: orders.filter((o) => o.status === 'PENDING').length,
    PAID: orders.filter((o) => o.status === 'PAID').length,
    DELIVERED: orders.filter((o) => o.status === 'DELIVERED').length,
    CANCELLED_REFUNDED: orders.filter(
      (o) => o.status === 'CANCELLED' || o.status === 'REFUNDED'
    ).length,
  };

  const filtered = orders.filter((o) => {
    const matchesQueue =
      activeQueue === 'ALL'
        ? true
        : activeQueue === 'CANCELLED_REFUNDED'
        ? o.status === 'CANCELLED' || o.status === 'REFUNDED'
        : o.status === activeQueue;

    if (!matchesQueue) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      o.id.toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || '').toLowerCase().includes(q) ||
      (o.payment_id || '').toLowerCase().includes(q) ||
      o.customer_telegram_id.includes(q)
    );
  });

  const selectedItemsSubtotal = selectedOrder
    ? (selectedOrder.items || []).reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity || 0),
        0
      )
    : 0;
  const selectedDeliveryFee = selectedOrder ? Number(selectedOrder.delivery_fee || 0) : 0;
  const statusHistory: OrderStatusHistoryEntry[] =
    selectedOrder && Array.isArray(selectedOrder.status_history)
      ? selectedOrder.status_history
      : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1>Заказы</h1>
          <p className="hint">Очередь проверки оплат Paynet, сборка, доставка и возвраты.</p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={isExporting || orders.length === 0}
          className="btn-secondary !h-9 text-xs self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Экспорт…' : 'Экспорт CSV'}</span>
        </button>
      </div>

      {/* Queue Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-line pb-3">
        {QUEUE_TABS.map((tab) => {
          const isActive = activeQueue === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveQueue(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                isActive
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-muted border-line hover:text-ink hover:bg-subtle'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  isActive
                    ? 'bg-paper/20 text-paper'
                    : tab.id === 'PAYMENT_REVIEW' && count > 0
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-subtle text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по номеру, имени, телефону, Paynet ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="text-xs text-muted">
          Показано: <span className="font-semibold text-ink">{filtered.length}</span> из{' '}
          {orders.length}
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
            <p className="hint">Попробуйте переключить вкладку статуса или очистить поиск.</p>
          </div>
        ) : (
          <OrdersTable orders={filtered} currency={currency} onSelect={openOrderModal} />
        )}
      </div>

      {/* Order Details & Payment Verification Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Заказ ${shortOrderId(selectedOrder.id)}` : 'Детали заказа'}
        className="max-w-2xl"
      >
        {selectedOrder && (
          <div className="space-y-5 text-sm">
            {/* Status Header */}
            <div className="rounded-md border border-line bg-subtle/50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted uppercase">Текущий статус</div>
                <div className="text-sm font-semibold">
                  <OrderStatusLabel status={selectedOrder.status} />
                </div>
              </div>
              <div className="text-right text-xs text-muted space-y-0.5">
                <div>Создан: {formatDate(selectedOrder.createdAt, true)}</div>
                {selectedOrder.payment_id && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-semibold">
                    Paynet ID: {selectedOrder.payment_id}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Verification & Operator Actions */}
            <div className="rounded-md border border-line p-4 space-y-3 bg-paper">
              <div className="text-xs font-semibold text-ink uppercase tracking-wide">
                Проверка оплаты и управление заказом
              </div>

              {actionError && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                  {actionError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">
                    ID транзакции / квитанции Paynet *
                  </label>
                  <input
                    type="text"
                    value={paymentIdInput}
                    onChange={(e) => setPaymentIdInput(e.target.value)}
                    placeholder="Например: PN-84920192"
                    className="input font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Обязателен для подтверждения поступления денег.
                  </p>
                </div>

                <div>
                  <label className="label text-xs">
                    Ссылка на фискальный чек Soliq / OFD
                  </label>
                  <input
                    type="url"
                    value={receiptUrlInput}
                    onChange={(e) => setReceiptUrlInput(e.target.value)}
                    placeholder="https://ofd.soliq.uz/check?..."
                    className="input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs">Комментарий оператора (необязательно)</label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Например: Поступление проверено в Paynet Бизнес"
                  className="input text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={
                    isUpdatingStatus ||
                    selectedOrder.status === 'PAID' ||
                    selectedOrder.status === 'DELIVERED' ||
                    selectedOrder.status === 'CANCELLED' ||
                    selectedOrder.status === 'REFUNDED'
                  }
                  onClick={() =>
                    handleUpdateOrder(selectedOrder.id, 'PAID', { requirePaymentId: true })
                  }
                  className="btn-primary !h-9 text-xs !bg-emerald-700 !border-emerald-700 hover:!bg-emerald-800"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Подтвердить поступление денег (В сборку)</span>
                </button>

                <button
                  type="button"
                  disabled={
                    isUpdatingStatus ||
                    selectedOrder.status === 'DELIVERED' ||
                    selectedOrder.status === 'CANCELLED' ||
                    selectedOrder.status === 'REFUNDED'
                  }
                  onClick={() => handleUpdateOrder(selectedOrder.id, 'DELIVERED')}
                  className="btn-secondary !h-9 text-xs"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Отметить доставленным</span>
                </button>

                <button
                  type="button"
                  disabled={
                    isUpdatingStatus ||
                    selectedOrder.status === 'CANCELLED' ||
                    selectedOrder.status === 'REFUNDED'
                  }
                  onClick={() =>
                    handleUpdateOrder(selectedOrder.id, 'CANCELLED', {
                      confirmText: 'Отменить заказ и вернуть товары в остаток?',
                    })
                  }
                  className="btn-danger !h-9 text-xs"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Отменить заказ</span>
                </button>

                <button
                  type="button"
                  disabled={
                    isUpdatingStatus ||
                    selectedOrder.status === 'REFUNDED' ||
                    selectedOrder.status === 'PENDING' ||
                    selectedOrder.status === 'CANCELLED'
                  }
                  onClick={() =>
                    handleUpdateOrder(selectedOrder.id, 'REFUNDED', {
                      confirmText: 'Оформить возврат по заказу и вернуть товары в остаток?',
                    })
                  }
                  className="btn-danger !h-9 text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Оформить возврат (с возвратом в остаток)</span>
                </button>
              </div>
            </div>

            {/* Verified Receipt Info */}
            {(selectedOrder.receipt_url || selectedOrder.verified_by) && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-xs space-y-1">
                {selectedOrder.verified_by && (
                  <div className="text-emerald-900">
                    Проверено: <strong>{selectedOrder.verified_by}</strong>
                    {selectedOrder.verified_at
                      ? ` · ${formatDate(selectedOrder.verified_at, true)}`
                      : ''}
                  </div>
                )}
                {selectedOrder.receipt_url && (
                  <a
                    href={selectedOrder.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-800 underline font-medium"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Открыть фискальный чек</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Customer Details */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted uppercase">Данные покупателя</h3>
              <div className="rounded-md border border-line p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Имя:</span>
                  <span className="font-medium text-ink">
                    {selectedOrder.customer_name || 'Не указано'}
                  </span>
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
                <div className="flex items-center justify-between">
                  <span className="text-muted">Способ получения:</span>
                  <span className="font-medium text-ink">
                    {selectedOrder.delivery_method === 'PICKUP' ? 'Самовывоз' : 'Доставка курьером'}
                  </span>
                </div>
                {selectedOrder.shipping_address && (
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-muted">Адрес:</span>
                    <span className="text-right text-ink">{selectedOrder.shipping_address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order Items & Delivery Fee Breakdown */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted uppercase">Состав заказа</h3>
              <div className="rounded-md border border-line divide-y divide-line overflow-hidden">
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-medium text-ink">
                          {item.title}
                          {item.variant && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-subtle border border-line text-[10px] font-semibold">
                              {item.variant}
                            </span>
                          )}
                        </div>
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
                <div className="p-3 bg-subtle/30 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-muted">
                    <span>Товары:</span>
                    <span>{formatMoney(selectedItemsSubtotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span>Доставка:</span>
                    <span>
                      {selectedDeliveryFee > 0
                        ? formatMoney(selectedDeliveryFee, currency)
                        : 'Бесплатно'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-line font-semibold text-ink">
                    <span>Итого к оплате:</span>
                    <span className="text-sm">
                      {formatMoney(Number(selectedOrder.total_amount), currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status History Timeline */}
            {statusHistory.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted uppercase">История статусов</h3>
                <div className="rounded-md border border-line p-3 space-y-2.5 text-xs">
                  {statusHistory.map((entry, idx) => {
                    const meta = ORDER_STATUS[entry.status as keyof typeof ORDER_STATUS];
                    return (
                      <div key={idx} className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium text-ink">
                              {meta ? meta.label : entry.status}
                            </div>
                            {entry.note && <div className="text-muted">{entry.note}</div>}
                            {entry.by && (
                              <div className="text-[11px] text-muted">Кем: {entry.by}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-[11px] text-muted whitespace-nowrap">
                          {entry.at ? formatDate(entry.at, true) : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
