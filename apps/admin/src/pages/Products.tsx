import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { Product } from '../types/index.js';
import { Plus, Edit2, Trash2, Package, Search, Image, Check } from 'lucide-react';
import { Modal } from '@telegram-commerce/ui';

export function Products() {
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
  const [category, setCategory] = useState('Apparel');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest('/api/v1/admin/products');
      setProducts(data.products || []);
    } catch (err) {
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
    setCategory('Apparel');
    setImageUrl('https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setTitle(p.title);
    setDescription(p.description);
    setPrice(String(p.price));
    setStock(String(p.stock));
    setCategory(p.category);
    setImageUrl(p.images?.[0] || '');
    setIsActive(p.is_active);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await apiRequest(`/api/v1/admin/products/${id}`, { method: 'DELETE' });
      await loadProducts();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        title,
        description,
        price: Number.parseFloat(price),
        stock: Number.parseInt(stock, 10),
        category,
        images: imageUrl ? [imageUrl] : [],
        isActive,
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
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Product Catalog</h1>
          <p className="text-sm text-slate-400">Add, edit, and manage items in your Telegram Mini App & Bot.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm shadow-lg shadow-sky-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Filter products by title or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* Products Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Package className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">No products found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="pb-3">Product</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Price</th>
                  <th className="pb-3">Stock</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80'}
                          alt={p.title}
                          className="w-10 h-10 rounded-xl object-cover bg-slate-800"
                        />
                        <div>
                          <div className="font-semibold text-slate-100">{p.title}</div>
                          <div className="text-xs text-slate-500 truncate max-w-xs">{p.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3.5 font-bold text-slate-100">
                      ${Number(p.price).toFixed(2)}
                    </td>
                    <td className="py-3.5">
                      <span className={`text-xs font-semibold ${p.stock > 10 ? 'text-emerald-400' : p.stock > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {p.stock} units
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        {p.is_active ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Product Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cyberpunk Hoodie"
              className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of features and materials..."
              className="mt-1 w-full p-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300">Price ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Stock Qty</label>
              <input
                type="number"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Category</label>
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Apparel"
                className="mt-1 w-full h-10 px-3 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="mt-1 w-full h-10 px-3.5 rounded-xl bg-slate-800 border border-slate-750 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
            />
            <label htmlFor="isActive" className="text-xs font-medium text-slate-300">
              Visible and available for purchase in store
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-400 shadow-md shadow-sky-500/20"
            >
              {isSubmitting ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
