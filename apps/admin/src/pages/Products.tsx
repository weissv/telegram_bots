import React, { useEffect, useState, useRef } from 'react';
import { apiRequest } from '../api/client.js';
import { Product } from '../types/index.js';
import {
  Plus,
  Edit2,
  Trash2,
  Package,
  Search,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { Modal } from '@telegram-commerce/ui';
import { formatMoney } from '../lib/format.js';

interface ParsedProductRow {
  id?: string;
  title: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  imageUrl: string;
  isActive: boolean;
  isValid: boolean;
  error?: string;
}

export function Products({ currency = 'UZS' }: { currency?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Single Product Edit/Create
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('290000');
  const [stock, setStock] = useState('50');
  const [category, setCategory] = useState('Одежда');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Bulk Operations State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  // CSV Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [upsertMode, setUpsertMode] = useState(true);
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest<{ products: Product[] }>('/api/v1/admin/products');
      setProducts(data.products || []);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setTitle('');
    setDescription('');
    setPrice('290000');
    setStock('50');
    setCategory('Одежда');
    setImageUrl('https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80');
    setIsActive(true);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setTitle(p.title);
    setDescription(p.description || '');
    setPrice(String(p.price));
    setStock(String(p.stock));
    setCategory(p.category || 'Общее');
    setImageUrl(p.images?.[0] || '');
    setIsActive(p.is_active);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;
    try {
      await apiRequest(`/api/v1/admin/products/${id}`, {
        method: 'DELETE',
      });
      await loadProducts();
    } catch (err: any) {
      alert(`Ошибка при удалении товара: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        title,
        description,
        price: parseFloat(price) || 0,
        stock: parseInt(stock, 10) || 0,
        category,
        images: imageUrl ? [imageUrl] : [],
        is_active: isActive,
      };

      if (editingProduct) {
        await apiRequest(`/api/v1/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/v1/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      await loadProducts();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения товара');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Multi-Select Bulk Actions ───
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkStatusChange = async (newStatus: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      setIsBulkOperating(true);
      await apiRequest('/api/v1/admin/products/bulk-status', {
        method: 'POST',
        body: JSON.stringify({
          productIds: Array.from(selectedIds),
          isActive: newStatus,
        }),
      });
      await loadProducts();
    } catch (err: any) {
      alert(`Ошибка пакетного обновления статуса: ${err.message}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Удалить выбранные товары (${selectedIds.size} шт.)? Это действие необратимо.`)) return;

    try {
      setIsBulkOperating(true);
      await apiRequest('/api/v1/admin/products/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          productIds: Array.from(selectedIds),
        }),
      });
      await loadProducts();
    } catch (err: any) {
      alert(`Ошибка пакетного удаления: ${err.message}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  // ─── CSV Export ("Отгрузка каталога") ───
  const handleExportCsv = () => {
    if (products.length === 0) {
      alert('В каталоге нет товаров для экспорта.');
      return;
    }

    const headers = ['ID', 'Название', 'Категория', 'Цена', 'Остаток', 'Описание', 'Изображение', 'Активен'];
    const rows = products.map((p) => [
      p.id,
      p.title,
      p.category || 'Общее',
      p.price,
      p.stock,
      p.description || '',
      (p.images && p.images[0]) || '',
      p.is_active ? 'Да' : 'Нет',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
            .join(';')
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `catalog_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ─── CSV Template Download ("Скачать образец") ───
  const handleDownloadTemplate = () => {
    const headers = ['ID', 'Название', 'Категория', 'Цена', 'Остаток', 'Описание', 'Изображение', 'Активен'];
    const sampleRows = [
      [
        '',
        'Оверсайз худи Tashkent Edition',
        'Одежда',
        '420000',
        '35',
        'Плотный футер 420г/м² из 100% узбекского хлопка пенье. Мягкий начес, глубокий капюшон.',
        'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
        'Да',
      ],
      [
        '',
        'Кожаные кроссовки Classic Street Low',
        'Обувь',
        '650000',
        '20',
        'Натуральная матовая телячья кожа, анатомическая стелька с поддержкой стопы.',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
        'Да',
      ],
      [
        '',
        'Бейсболка с вышивкой Toshkent',
        'Аксессуары',
        '140000',
        '45',
        'Плотный саржевый хлопок, металлическая застежка-регулятор, вентиляционные люверсы.',
        'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80',
        'Да',
      ],
    ];

    const csvContent =
      '\uFEFF' +
      [headers, ...sampleRows]
        .map((row) =>
          row
            .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
            .join(';')
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sample_catalog_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ─── CSV Parsing & Upload ───
  const parseCsvText = (text: string): ParsedProductRow[] => {
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : headerLine.includes('\t') ? '\t' : ',';

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = parseLine(headerLine).map((h) => h.toLowerCase().replace(/["']/g, ''));

    const getIndex = (aliases: string[]) => {
      return rawHeaders.findIndex((h) => aliases.some((a) => h.includes(a)));
    };

    const idIdx = getIndex(['id']);
    const titleIdx = getIndex(['название', 'title', 'name', 'товар']);
    const catIdx = getIndex(['категория', 'category', 'раздел']);
    const priceIdx = getIndex(['цена', 'price', 'стоимость']);
    const stockIdx = getIndex(['остаток', 'stock', 'количество', 'кол-во', 'qty']);
    const descIdx = getIndex(['описание', 'description', 'инфо']);
    const imgIdx = getIndex(['изображение', 'image', 'фото', 'картинка', 'img']);
    const activeIdx = getIndex(['активен', 'active', 'статус', 'status']);

    const rows: ParsedProductRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length === 0 || cols.every((c) => c === '')) continue;

      const id = idIdx !== -1 && cols[idIdx] ? cols[idIdx].trim() : undefined;
      const rowTitle = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx].trim() : '';
      const rowCategory = catIdx !== -1 && cols[catIdx] ? cols[catIdx].trim() : 'Общее';
      const rawPrice = priceIdx !== -1 ? cols[priceIdx].replace(/[^\d.,]/g, '').replace(',', '.') : '';
      const rowPrice = parseFloat(rawPrice);
      const rawStock = stockIdx !== -1 ? parseInt(cols[stockIdx].replace(/\D/g, ''), 10) : 0;
      const rowStock = isNaN(rawStock) ? 0 : rawStock;
      const rowDescription = descIdx !== -1 && cols[descIdx] ? cols[descIdx].trim() : '';
      const rowImageUrl = imgIdx !== -1 && cols[imgIdx] ? cols[imgIdx].trim() : '';
      const rawActive = activeIdx !== -1 && cols[activeIdx] ? cols[activeIdx].toLowerCase() : 'да';
      const rowIsActive = !['нет', 'no', 'false', '0', 'скрыт', 'hidden'].includes(rawActive);

      let isValid = true;
      let error: string | undefined;

      if (!rowTitle) {
        isValid = false;
        error = 'Нет названия';
      } else if (isNaN(rowPrice) || rowPrice < 0) {
        isValid = false;
        error = 'Неверная цена';
      }

      rows.push({
        id: id || undefined,
        title: rowTitle,
        category: rowCategory,
        price: isNaN(rowPrice) ? 0 : rowPrice,
        stock: rowStock,
        description: rowDescription,
        imageUrl: rowImageUrl,
        isActive: rowIsActive,
        isValid,
        error,
      });
    }

    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatusMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const rows = parseCsvText(text);
        setParsedRows(rows);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('Нет валидных строк для импорта.');
      return;
    }

    try {
      setIsImporting(true);
      setImportStatusMsg(null);

      const payload = {
        upsert: upsertMode,
        products: validRows.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          title: r.title,
          category: r.category,
          price: r.price,
          stock: r.stock,
          description: r.description,
          images: r.imageUrl ? [r.imageUrl] : [],
          isActive: r.isActive,
        })),
      };

      const res = await apiRequest<{ created: number; updated: number; total: number }>(
        '/api/v1/admin/products/bulk',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      setImportStatusMsg(
        `✅ Импорт успешно завершен! Создано: ${res.created}, обновлено: ${res.updated}.`
      );
      await loadProducts();
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setImportStatusMsg(`❌ Ошибка импорта: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const filtered = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const validParsedCount = parsedRows.filter((r) => r.isValid).length;
  const invalidParsedCount = parsedRows.length - validParsedCount;

  return (
    <div className="space-y-6">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1>Каталог товаров</h1>
          <p className="hint">Ассортимент витрины, остатки на складе, пакетная загрузка и экспорт.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="btn-secondary !h-9 text-xs"
            title="Выгрузить весь каталог в CSV для Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Экспорт CSV</span>
          </button>

          {/* Import CSV Button */}
          <button
            type="button"
            onClick={() => {
              setParsedRows([]);
              setImportStatusMsg(null);
              setIsImportModalOpen(true);
            }}
            className="btn-secondary !h-9 text-xs"
            title="Загрузить товары из CSV файла"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Импорт CSV</span>
          </button>

          {/* Single Add Button */}
          <button type="button" onClick={handleOpenAdd} className="btn-primary !h-9 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить товар</span>
          </button>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="p-3 rounded-md bg-subtle border border-line flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-ink">Выбрано: {selectedIds.size} товаров</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted hover:text-ink underline ml-1"
            >
              Снять выбор
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBulkOperating}
              onClick={() => handleBulkStatusChange(true)}
              className="btn-secondary !h-8 !px-2.5 text-xs inline-flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5 text-green-700" />
              <span>Опубликовать</span>
            </button>

            <button
              type="button"
              disabled={isBulkOperating}
              onClick={() => handleBulkStatusChange(false)}
              className="btn-secondary !h-8 !px-2.5 text-xs inline-flex items-center gap-1.5"
            >
              <EyeOff className="w-3.5 h-3.5 text-muted" />
              <span>Скрыть</span>
            </button>

            <button
              type="button"
              disabled={isBulkOperating}
              onClick={handleBulkDelete}
              className="btn-danger !h-8 !px-2.5 text-xs inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Удалить выбранные</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Stats Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по названию или категории..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="text-xs text-muted">
          Всего товаров: <span className="font-semibold text-ink">{products.length}</span>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-md border border-line bg-paper overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted">Загрузка товаров…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Package className="w-8 h-8 text-muted mx-auto" />
            <p className="text-sm font-medium">Товары не найдены</p>
            <p className="hint">Измените запрос поиска или воспользуйтесь импортом CSV.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-line text-ink focus:ring-0 cursor-pointer"
                      title="Выбрать все"
                    />
                  </th>
                  <th scope="col">Товар</th>
                  <th scope="col">Категория</th>
                  <th scope="col">Цена</th>
                  <th scope="col">Остаток</th>
                  <th scope="col">Статус</th>
                  <th scope="col" className="text-right">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const img =
                    product.images?.[0] ||
                    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=120&q=80';
                  const isChecked = selectedIds.has(product.id);

                  return (
                    <tr
                      key={product.id}
                      className={isChecked ? 'bg-subtle/50' : undefined}
                    >
                      <td className="w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(product.id)}
                          className="h-4 w-4 rounded border-line text-ink focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <img
                            src={img}
                            alt=""
                            className="w-10 h-10 rounded object-cover border border-line bg-subtle shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-ink truncate">{product.title}</div>
                            {product.description && (
                              <div className="text-muted text-xs line-clamp-1">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-muted">{product.category || '—'}</td>
                      <td className="font-medium whitespace-nowrap">
                        {formatMoney(Number(product.price), currency)}
                      </td>
                      <td>
                        <span
                          className={
                            product.stock <= 0
                              ? 'text-red-700 font-medium'
                              : product.stock <= 5
                              ? 'text-amber-600 font-medium'
                              : 'text-ink'
                          }
                        >
                          {product.stock} шт.
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            product.is_active ? 'text-green-700' : 'text-muted'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              product.is_active ? 'bg-green-600' : 'bg-muted'
                            }`}
                          />
                          {product.is_active ? 'Активен' : 'Скрыт'}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(product)}
                            className="btn-secondary !h-8 !px-2.5 text-xs"
                            title="Редактировать"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            className="btn-danger !h-8 !px-2.5 text-xs"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Пакетный импорт товаров (CSV / Excel)"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-md bg-subtle/70 border border-line text-xs space-y-2">
            <div className="font-semibold text-ink flex items-center justify-between">
              <span>Инструкция по загрузке каталога</span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="link inline-flex items-center gap-1 font-medium text-xs"
              >
                <Download className="w-3 h-3" />
                <span>Скачать образец таблицы (.csv)</span>
              </button>
            </div>
            <p className="text-muted leading-relaxed">
              Загрузите файл <code>.csv</code> с колонками: <b>Название, Категория, Цена, Остаток, Описание, Изображение</b>. Если указан <b>ID</b> существующего товара, система обновит его цену и остатки.
            </p>
          </div>

          {/* File Picker */}
          <div>
            <label className="label">Выберите файл CSV</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-xs text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-line file:text-xs file:font-medium file:bg-paper file:text-ink hover:file:bg-subtle cursor-pointer"
            />
          </div>

          {/* Status Alert */}
          {importStatusMsg && (
            <div
              className={`p-3 rounded-md text-xs font-medium ${
                importStatusMsg.startsWith('❌')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}
            >
              {importStatusMsg}
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">
                  Найдено товаров: {parsedRows.length} (
                  <span className="text-green-700">{validParsedCount} валидно</span>
                  {invalidParsedCount > 0 && (
                    <span className="text-red-700">, {invalidParsedCount} ошибок</span>
                  )}
                  )
                </span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={upsertMode}
                    onChange={(e) => setUpsertMode(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-line text-ink focus:ring-0"
                  />
                  <span className="text-muted">Обновлять существующие по ID</span>
                </label>
              </div>

              <div className="max-h-56 overflow-y-auto border border-line rounded-md">
                <table className="w-full text-left text-xs divide-y divide-line">
                  <thead className="bg-subtle/50 text-muted sticky top-0">
                    <tr>
                      <th className="p-2">Товар</th>
                      <th className="p-2">Категория</th>
                      <th className="p-2">Цена</th>
                      <th className="p-2">Остаток</th>
                      <th className="p-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-paper">
                    {parsedRows.slice(0, 15).map((row, idx) => (
                      <tr key={idx} className={!row.isValid ? 'bg-red-50/50' : undefined}>
                        <td className="p-2 font-medium max-w-[140px] truncate" title={row.title}>
                          {row.title || <span className="text-red-600 italic">Пусто</span>}
                        </td>
                        <td className="p-2 text-muted">{row.category}</td>
                        <td className="p-2 font-mono whitespace-nowrap">
                          {formatMoney(row.price, currency)}
                        </td>
                        <td className="p-2">{row.stock} шт.</td>
                        <td className="p-2 whitespace-nowrap">
                          {row.isValid ? (
                            <span className="text-green-700 font-medium inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Валидно
                            </span>
                          ) : (
                            <span className="text-red-700 font-medium inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsedRows.length > 15 && (
                <p className="text-[11px] text-muted text-center">
                  Показано 15 из {parsedRows.length} строк…
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="btn-secondary"
            >
              Закрыть
            </button>
            <button
              type="button"
              disabled={isImporting || validParsedCount === 0}
              onClick={handleExecuteImport}
              className="btn-primary"
            >
              {isImporting ? 'Загрузка…' : `Загрузить ${validParsedCount} товаров`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit / Add Single Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Редактировать товар' : 'Новый товар'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="label">Название товара</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Худи Оверсайз Tashkent Edition"
              className="input"
            />
          </div>

          <div>
            <label className="label">Описание</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Подробное описание товара, состав, ткань, посадка..."
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Цена ({currency})</label>
              <input
                type="number"
                step="1000"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Остаток на складе (шт.)</label>
              <input
                type="number"
                min="0"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Категория</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Одежда, Обувь, Аксессуары..."
                className="input"
              />
            </div>
            <div>
              <label className="label">URL изображения</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="input"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-line text-ink focus:ring-0"
              />
              <span className="text-sm font-medium">Товар отображается в каталоге</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
            >
              {isSubmitting ? 'Сохранение…' : editingProduct ? 'Сохранить изменения' : 'Создать товар'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
