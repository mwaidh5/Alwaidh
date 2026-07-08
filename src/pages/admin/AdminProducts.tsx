import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createProduct,
  deleteProduct,
  resetProductsToSeed,
  subscribeProducts,
  upsertProduct,
} from '../../lib/productStore';
import { uploadProductImage } from '../../lib/imageUpload';
import { categories } from '../../data/categories';
import { formatPrice } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import type { Product, CategorySlug } from '../../types/product';

type FormState = Omit<Product, 'specs'> & { specsText: string };

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  category: 'computers',
  brand: '',
  price: 0,
  currency: 'IQD',
  image: '',
  rating: 0,
  inStock: true,
  shortDescription: '',
  description: '',
  specsText: '',
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [filter, setFilter] = useState<'all' | CategorySlug>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { isAdmin, isComputerStaff, isSolarStaff } = useAuth();
  const allowedCategories = useMemo<CategorySlug[]>(
    () =>
      isAdmin
        ? categories.map((c) => c.slug)
        : [
            ...(isComputerStaff ? (['computers', 'tiandy-cameras'] as CategorySlug[]) : []),
            ...(isSolarStaff ? (['solar'] as CategorySlug[]) : []),
          ],
    [isAdmin, isComputerStaff, isSolarStaff],
  );
  const categoryOptions = categories.filter((c) => allowedCategories.includes(c.slug));

  useEffect(() => {
    return subscribeProducts((list) => setProducts(list));
  }, []);

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
    if (!confirm(`Delete ${selected.size} selected product(s)? This cannot be undone.`)) return;
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
  }, [products, filter, query, allowedCategories]);

  function startCreate() {
    setError('');
    setEditing({ ...EMPTY_FORM, category: allowedCategories[0] ?? 'computers' });
  }

  function startEdit(p: Product) {
    setError('');
    setEditing({
      ...p,
      specsText: Object.entries(p.specs)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n'),
    });
  }

  async function handleSave() {
    if (!editing) return;
    setError('');
    setBusy(true);
    try {
      const specs = parseSpecs(editing.specsText);
      const isNew = !editing.id;
      const payload = {
        name: editing.name.trim(),
        category: editing.category,
        brand: editing.brand.trim(),
        price: Number(editing.price) || 0,
        currency: editing.currency.trim().toUpperCase() || 'IQD',
        image: editing.image.trim(),
        rating: Math.max(0, Math.min(5, Number(editing.rating) || 0)),
        inStock: editing.inStock,
        shortDescription: editing.shortDescription.trim(),
        description: editing.description.trim(),
        specs,
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
    if (!confirm('Delete this product?')) return;
    try {
      await deleteProduct(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  async function handleReset() {
    if (!confirm('Reset all products back to the built-in seed catalogue? This deletes any custom products.')) return;
    setBusy(true);
    try {
      await resetProductsToSeed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-600">
            {products ? `${products.length} total · ${filtered.length} shown` : 'Loading…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button type="button" onClick={handleReset} disabled={busy} className="btn-secondary">
              Reset to seed
            </button>
          )}
          <button type="button" onClick={startCreate} className="btn-primary">
            + Add product
          </button>
        </div>
      </header>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, brand, or id"
            className="input max-w-xs"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="input max-w-xs"
          >
            <option value="all">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected.size > 0 && (
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

      {products === null ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">No products match.</p>
      ) : (
        <div className="card overflow-x-auto">
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
                      {p.inStock ? 'In stock' : 'Out'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="ml-3 text-sm font-semibold text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

function ProductDialog({
  state,
  setState,
  busy,
  categoryOptions,
  onCancel,
  onSave,
}: {
  state: FormState;
  setState: (s: FormState) => void;
  busy: boolean;
  categoryOptions: { slug: CategorySlug; name: string }[];
  onCancel: () => void;
  onSave: () => void;
}) {
  const isNew = !state.id;
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [removingBg, setRemovingBg] = useState(false);

  async function handleUpload(file: File) {
    setUploadError('');
    setUploading(true);
    try {
      const { url } = await uploadProductImage(file, state.id || undefined);
      setState({ ...state, image: url });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleRemoveBackground() {
    if (!state.image) return;
    setUploadError('');
    setRemovingBg(true);
    try {
      // Loaded on demand — the model downloads on first use, then is cached.
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(state.image);
      const file = new File([blob], 'bg-removed.png', { type: 'image/png' });
      const { url } = await uploadProductImage(file, state.id || undefined);
      setState({ ...state, image: url });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Background removal failed.');
    } finally {
      setRemovingBg(false);
    }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl max-h-[90vh]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="font-bold text-slate-900">{isNew ? 'New product' : 'Edit product'}</h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Name" full>
            <input
              className="input"
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
            />
          </Field>
          <Field label="Brand">
            <input
              className="input"
              value={state.brand}
              onChange={(e) => setState({ ...state, brand: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <select
              className="input"
              value={state.category}
              onChange={(e) =>
                setState({ ...state, category: e.target.value as CategorySlug })
              }
            >
              {categoryOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price">
            <input
              type="number"
              min={0}
              className="input"
              value={state.price}
              onChange={(e) => setState({ ...state, price: Number(e.target.value) })}
            />
          </Field>
          <Field label="Currency">
            <input
              className="input"
              value={state.currency}
              onChange={(e) => setState({ ...state, currency: e.target.value })}
            />
          </Field>
          <Field label="Rating (0–5)">
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className="input"
              value={state.rating}
              onChange={(e) => setState({ ...state, rating: Number(e.target.value) })}
            />
          </Field>
          <Field label="In stock">
            <label className="flex items-center gap-2 pt-2 text-sm">
              <input
                type="checkbox"
                checked={state.inStock}
                onChange={(e) => setState({ ...state, inStock: e.target.checked })}
              />
              Available for purchase
            </label>
          </Field>
          <Field label="Product image" full>
            <div className="flex flex-wrap items-start gap-3">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                {state.image ? (
                  <img src={state.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs text-slate-400">
                    No image
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading || removingBg}
                    className="btn-secondary"
                  >
                    {uploading ? 'Uploading…' : 'Upload image'}
                  </button>
                  {state.image && (
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      disabled={uploading || removingBg}
                      className="btn-secondary"
                    >
                      {removingBg ? 'Removing…' : 'Remove background'}
                    </button>
                  )}
                  {state.image && (
                    <button
                      type="button"
                      onClick={() => setState({ ...state, image: '' })}
                      className="text-sm font-semibold text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
                <input
                  className="input"
                  value={state.image}
                  onChange={(e) => setState({ ...state, image: e.target.value })}
                  placeholder="…or paste an image URL"
                />
                {uploadError && (
                  <p className="text-xs text-red-700">{uploadError}</p>
                )}
                <p className="text-xs text-slate-500">
                  JPG, PNG, WEBP, AVIF, or GIF · max 5 MB. “Remove background” uses an in-browser AI
                  model that downloads on first use (may take a moment).
                </p>
              </div>
            </div>
          </Field>
          <Field label="Short description" full>
            <input
              className="input"
              value={state.shortDescription}
              onChange={(e) => setState({ ...state, shortDescription: e.target.value })}
            />
          </Field>
          <Field label="Description" full>
            <textarea
              className="input min-h-[100px]"
              value={state.description}
              onChange={(e) => setState({ ...state, description: e.target.value })}
            />
          </Field>
          <Field label="Specs (one per line, key: value)" full>
            <textarea
              className="input min-h-[120px] font-mono"
              value={state.specsText}
              onChange={(e) => setState({ ...state, specsText: e.target.value })}
              placeholder={'CPU: Intel Core i7\nRAM: 16 GB'}
            />
          </Field>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={onSave} className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function parseSpecs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}
