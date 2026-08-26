import { useEffect, useMemo, useState } from 'react';
import {
  createProduct,
  deleteProduct,
  destroyProduct,
  restoreProduct,
  subscribeDeletedProducts,
  subscribeProducts,
  upsertProduct,
} from '../../lib/productStore';
import { categories } from '../../data/categories';
import {
  EMPTY_FORM,
  parseSpecs,
  ProductDialog,
  toFormState,
  type FormState,
} from '../../components/ProductEditor';
import { useLang } from '../../lib/i18n';
import { formatPrice } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import type { Product, CategorySlug } from '../../types/product';

export default function AdminProducts() {
  const { t } = useLang();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [filter, setFilter] = useState<'all' | CategorySlug>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { isAdmin, isComputerStaff, isSolarStaff, isShopManager } = useAuth();
  const allowedCategories = useMemo<CategorySlug[]>(
    () =>
      isAdmin || isShopManager
        ? categories.map((c) => c.slug)
        : [
            ...(isComputerStaff ? (['computers', 'tiandy-cameras'] as CategorySlug[]) : []),
            ...(isSolarStaff ? (['solar'] as CategorySlug[]) : []),
          ],
    [isAdmin, isComputerStaff, isSolarStaff, isShopManager],
  );
  const categoryOptions = categories.filter((c) => allowedCategories.includes(c.slug));

  const [trashed, setTrashed] = useState<Product[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'draft'>('all');

  useEffect(() => {
    return subscribeProducts((list) => setProducts(list));
  }, []);

  useEffect(() => {
    return subscribeDeletedProducts(setTrashed);
  }, []);

  // Staff can jump here straight from a product page: /admin/products?edit=<id>
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const wanted = searchParams.get('edit');
    if (!wanted || !products) return;
    const match = products.find((p) => p.id === wanted);
    if (match) {
      startEdit(match);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, products, setSearchParams]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const ids = filtered.map((p) => p.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function applyToSelected(label: string, transform: (p: Product) => Product) {
    if (selected.size === 0) return;
    setError('');
    setBusy(true);
    try {
      const list = products ?? [];
      await Promise.all(
        [...selected].map((id) => {
          const p = list.find((x) => x.id === id);
          return p ? upsertProduct(transform(p)) : Promise.resolve();
        }),
      );
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Move ${selected.size} selected product(s) to the Trash? You can restore them later.`)) return;
    setError('');
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => deleteProduct(id)));
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk delete failed.');
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const list = products ?? [];
    return list.filter((p) => {
      if (!allowedCategories.includes(p.category)) return false;
      if (statusFilter === 'live' && p.draft) return false;
      if (statusFilter === 'draft' && !p.draft) return false;
      if (filter !== 'all' && p.category !== filter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, filter, query, allowedCategories, statusFilter]);

  function startCreate() {
    setError('');
    setEditing({ ...EMPTY_FORM, category: allowedCategories[0] ?? 'computers' });
  }

  function startEdit(p: Product) {
    setError('');
    setEditing(toFormState(p));
  }

  async function handleSave(asDraft?: boolean) {
    if (!editing) return;
    setError('');
    setBusy(true);
    try {
      const specs = parseSpecs(editing.specsText);
      const isNew = !editing.id;
      const images = editing.images.map((s) => s.trim()).filter(Boolean);
      const payload = {
        name: editing.name.trim(),
        category: editing.category,
        brand: editing.brand.trim(),
        subcategories: (editing.subcategories ?? []).map((x) => x.trim()).filter(Boolean),
        // Mirror the first one so older readers keep working.
        subcategory: (editing.subcategories ?? [])[0]?.trim() ?? '',
        price: Number(editing.price) || 0,
        currency: editing.currency.trim().toUpperCase() || 'IQD',
        image: images[0] ?? '',
        images,
        rating: Math.max(0, Math.min(5, Number(editing.rating) || 0)),
        inStock: editing.inStock,
        comingSoon: Boolean(editing.comingSoon),
        shortDescription: editing.shortDescription.trim(),
        nameAr: (editing.nameAr ?? '').trim(),
        shortDescriptionAr: (editing.shortDescriptionAr ?? '').trim(),
        keywordsAr: (editing.keywordsAr ?? '').trim(),
        specs,
        deliveryFee:
          editing.deliveryFee === null || editing.deliveryFee === undefined
            ? null
            : Number(editing.deliveryFee) || 0,
        separateDelivery: Boolean(editing.separateDelivery),
        draft: asDraft ?? Boolean(editing.draft),
        datasheet: (editing.datasheet ?? '').trim(),
        manual: (editing.manual ?? '').trim(),
      };
      if (!payload.name) throw new Error('Name is required.');
      if (isNew) {
        await createProduct(payload);
      } else {
        await upsertProduct({ id: editing.id, ...payload });
      }
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Move this product to the Trash? You can restore it later.')) return;
    try {
      await deleteProduct(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  async function handleRestore(id: string) {
    try {
      await restoreProduct(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.');
    }
  }

  async function handleDestroy(p: Product) {
    if (!confirm(`Permanently delete "${p.name}"? This CANNOT be undone.`)) return;
    try {
      await destroyProduct(p.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('Products')}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {products ? `${products.length} total · ${filtered.length} shown` : 'Loading…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowTrash((v) => !v)}
            className={showTrash ? 'btn-primary' : 'btn-secondary'}
          >
            {showTrash ? t('← Back to products') : `🗑️ ${t('Trash')} (${trashed.length})`}
          </button>
          {!showTrash && (
            <button type="button" onClick={startCreate} className="btn-primary">
              {t('+ Add product')}
            </button>
          )}
        </div>
      </header>

      {!showTrash && (
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search by name, brand, or id')}
            className="input max-w-xs"
          />
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm font-semibold">
            {(
              [
                { key: 'all', label: t('All') },
                { key: 'live', label: t('Live') },
                { key: 'draft', label: t('Drafts') },
              ] as { key: 'all' | 'live' | 'draft'; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-md px-3 py-1.5 transition ${
                  statusFilter === f.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="input max-w-xs"
          >
            <option value="all">{t('All categories')}</option>
            {categoryOptions.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      )}

      {!showTrash && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm">
          <span className="font-semibold text-brand-800">{selected.size} selected</span>
          <span className="text-slate-400">·</span>
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1"
            value=""
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value as CategorySlug;
              if (v) applyToSelected('Set category', (p) => ({ ...p, category: v }));
            }}
          >
            <option value="">Set category…</option>
            {categoryOptions.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyToSelected('Publish', (p) => ({ ...p, draft: false }))}
            className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-50"
          >
            {t('Publish')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyToSelected('Make draft', (p) => ({ ...p, draft: true }))}
            className="rounded border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-800 hover:bg-amber-50"
          >
            {t('Make draft')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyToSelected('Set stock', (p) => ({ ...p, inStock: true }))}
            className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-50"
          >
            In stock
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyToSelected('Set stock', (p) => ({ ...p, inStock: false }))}
            className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-50"
          >
            Out of stock
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyToSelected('Set currency', (p) => ({ ...p, currency: 'IQD' }))}
            className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-50"
          >
            Set currency → IQD
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const f = prompt('Multiply selected prices by (e.g. 1310 to convert USD → IQD):');
              const factor = Number(f);
              if (f && factor > 0) {
                applyToSelected('Adjust price', (p) => ({ ...p, price: Math.round(p.price * factor) }));
              }
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-50"
          >
            Multiply price ×…
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={deleteSelected}
            className="rounded border border-red-300 bg-white px-2 py-1 font-semibold text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-slate-500 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {showTrash ? (
        <TrashList trashed={trashed} onRestore={handleRestore} onDestroy={handleDestroy} />
      ) : products === null ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">{t('No products match.')}</p>
      ) : (
        <>
        {/* Phone: tap-friendly cards with big Edit / Delete buttons. */}
        <div className="space-y-3 md:hidden">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`card p-3 ${selected.has(p.id) ? 'ring-2 ring-brand-400' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`Select ${p.name}`}
                  checked={selected.has(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300"
                />
                {p.image ? (
                  <img
                    src={p.image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-md bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-slate-900">{p.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{p.brand}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {formatPrice(p.price, p.currency)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {t(p.inStock ? 'In stock' : 'Out')}
                    </span>
                    {p.draft && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {t('Draft')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="btn-primary w-full py-2.5"
                >
                  {t('Edit')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="w-full rounded-lg border border-red-300 bg-white py-2.5 font-semibold text-red-700 active:bg-red-50"
                >
                  {t('Delete')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Larger screens: full table. */}
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((p) => (
                <tr key={p.id} className={selected.has(p.id) ? 'bg-brand-50/40' : undefined}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.name}`}
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-slate-100" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.brand} · {p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.category}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatPrice(p.price, p.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {t(p.inStock ? 'In stock' : 'Out')}
                    </span>
                    {p.draft && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {t('Draft')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      {t('Edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="ml-3 text-sm font-semibold text-red-700 hover:underline"
                    >
                      {t('Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {editing && (
        <ProductDialog
          state={editing}
          setState={setEditing}
          busy={busy}
          categoryOptions={categoryOptions}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function TrashList({
  trashed,
  onRestore,
  onDestroy,
}: {
  trashed: Product[];
  onRestore: (id: string) => void;
  onDestroy: (p: Product) => void;
}) {
  if (trashed.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-slate-500">
        <p className="text-2xl">🗑️</p>
        <p className="mt-2">The Trash is empty.</p>
        <p className="mt-1 text-xs">Deleted products land here and can be restored anytime.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Deleted products stay here until you restore them or delete them forever.
      </p>
      {trashed.map((p) => (
        <div key={p.id} className="card flex flex-wrap items-center gap-3 p-3">
          {p.image ? (
            <img src={p.image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover opacity-60" />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-md bg-slate-100" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-700">{p.name}</p>
            <p className="text-xs text-slate-500">
              {p.brand && `${p.brand} · `}
              {formatPrice(p.price, p.currency)}
              {p.deletedAtMs &&
                ` · deleted ${new Date(p.deletedAtMs).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`}
              {p.deletedBy && ` by ${p.deletedBy.split('@')[0]}`}
            </p>
          </div>
          <div className="flex flex-none gap-2">
            <button type="button" onClick={() => onRestore(p.id)} className="btn-secondary py-1.5">
              ↩️ Restore
            </button>
            <button
              type="button"
              onClick={() => onDestroy(p)}
              className="rounded-lg border border-red-300 bg-white px-4 py-1.5 font-semibold text-red-700 hover:bg-red-50"
            >
              Delete forever
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

