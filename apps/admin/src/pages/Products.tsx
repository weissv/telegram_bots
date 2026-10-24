import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { Product } from '../types/index.js';
import { Plus, Edit2, Trash2, Package, Search, Image as ImageIcon } from 'lucide-react';
import { Modal } from '@telegram-commerce/ui';
import { formatMoney } from '../lib/format.js';

export function Products({ currency = 'UZS' }: { currency?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('29.99');
  const [stock, setStock] = useState('50');
  const [category, setCategory] = useState('Одежда');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest<{ products: Product[] }>('/api/v1/admin/products');
      setProducts(data.products || []);
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
    setPrice('29.99');
    setStock('50');
    setCategory('Одежда');
    setImageUrl('https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80');
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

  const filtered = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1>Каталог товаров</h1>
          <p className="hint">Ассортимент витрины, остатки на складе и ценообразование.</p>
        </div>
        <button type="button" onClick={handleOpenAdd} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>Добавить товар</span>
        </button>
      </div>

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
            <p className="hint">Измените запрос поиска или добавьте новый товар.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
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
                  return (
                    <tr key={product.id}>
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

      {/* Edit / Add Modal */}
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
              placeholder="Например: Худи Оверсайз"
              className="input"
            />
          </div>

          <div>
            <label className="label">Описание</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Подробное описание товара, состав, размеры..."
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Цена (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Остаток на складе</label>
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
                placeholder="Одежда, Аксессуары..."
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
