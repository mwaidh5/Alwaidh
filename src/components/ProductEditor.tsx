import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createProduct, upsertProduct } from '../lib/productStore';
import { replaceImageAt, uploadProductDoc, uploadProductImage } from '../lib/imageUpload';
import { storagePathFromUrl } from '../lib/mediaStore';
import { categories } from '../data/categories';
import MediaPicker from './MediaPicker';
import ImageEditor from './ImageEditor';
import { useLang } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../lib/useSettings';
import type { Product, CategorySlug } from '../types/product';

export type FormState = Omit<Product, 'specs'> & { specsText: string };

export const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  category: 'computers',
  brand: '',
  price: 0,
  currency: 'IQD',
  image: '',
  images: [],
  rating: 0,
  inStock: true,
  shortDescription: '',
  specsText: '',
  subcategory: '',
  subcategories: [],
  deliveryFee: null,
  separateDelivery: false,
  draft: false,
  datasheet: '',
  manual: '',
};


/** Turn a saved product into the shape the form edits. */
export function toFormState(p: Product): FormState {
  return {
    ...p,
    specsText: specRowsOf(p)
      .map((r) => `${r.name}: ${r.value}`)
      .join('\n'),
  };
}

/**
 * The product editor as a self-contained pop-up: it owns its draft state and
 * saves itself, so any page can open it without sending the user to the
 * dashboard. Closing it simply closes it — you stay where you were.
 */
export default function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { isAdmin, isComputerStaff, isSolarStaff } = useAuth();
  const [state, setState] = useState<FormState>(() => toFormState(product));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Keep the form in step if the product updates underneath us.
  useEffect(() => setState(toFormState(product)), [product.id]);

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

  async function handleSave(asDraft: boolean) {
    setError('');
    setBusy(true);
    try {
      const images = state.images.map((x) => x.trim()).filter(Boolean);
      const payload = {
        name: state.name.trim(),
        category: state.category,
        brand: state.brand.trim(),
        subcategories: (state.subcategories ?? []).map((x) => x.trim()).filter(Boolean),
        subcategory: (state.subcategories ?? [])[0]?.trim() ?? '',
        price: Number(state.price) || 0,
        currency: state.currency.trim().toUpperCase() || 'IQD',
        image: images[0] ?? '',
        images,
        rating: Math.max(0, Math.min(5, Number(state.rating) || 0)),
        inStock: state.inStock,
        shortDescription: state.shortDescription.trim(),
        specs: parseSpecs(state.specsText),
        // Saved alongside the map so the order survives — Firestore hands
        // a map's keys back alphabetically.
        specsList: parseSpecRows(state.specsText),
        deliveryFee:
          state.deliveryFee === null || state.deliveryFee === undefined
            ? null
            : Number(state.deliveryFee) || 0,
        separateDelivery: Boolean(state.separateDelivery),
        draft: asDraft,
        datasheet: (state.datasheet ?? '').trim(),
        manual: (state.manual ?? '').trim(),
      };
      if (!payload.name) throw new Error('Name is required.');
      if (state.id) await upsertProduct({ id: state.id, ...payload });
      else await createProduct(payload);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <p className="fixed inset-x-4 top-4 z-50 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 shadow-lg">
          {error}
        </p>
      )}
      <ProductDialog
        state={state}
        setState={setState}
        busy={busy}
        categoryOptions={categories.filter((c) => allowedCategories.includes(c.slug))}
        onCancel={onClose}
        onSave={handleSave}
      />
    </>
  );
}


/**
 * Staff-only "Edit" button that opens the editor right where you are.
 * Renders nothing for customers, or for staff whose role doesn't cover this
 * product's category.
 */
export function StaffProductEdit({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { isAdmin, isComputerStaff, isSolarStaff } = useAuth();
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const canEdit =
    isAdmin ||
    (isComputerStaff &&
      (product.category === 'computers' || product.category === 'tiandy-cameras')) ||
    (isSolarStaff && product.category === 'solar');
  if (!canEdit) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title={t('Edit this product')}
        className={
          className ??
          'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50'
        }
      >
        ✏️ {t('Edit')}
      </button>
      {open && <ProductEditor product={product} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ProductDialog({
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
  onSave: (asDraft: boolean) => void;
}) {
  const { t } = useLang();
  const settings = useSettings();
  const isNew = !state.id;
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [removingBg, setRemovingBg] = useState(false);
  // Set when the stored image can't be downloaded on this device (blocked by
  // an extension/antivirus/proxy) — offers picking the file instead.
  const [bgFallback, setBgFallback] = useState(false);
  const bgFileInput = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Index of the image open in the crop/rotate editor, or null.
  const [editingImage, setEditingImage] = useState<number | null>(null);
  const [docBusy, setDocBusy] = useState<'datasheet' | 'manual' | null>(null);
  const [docError, setDocError] = useState('');
  // Bytes of images uploaded in this dialog, keyed by their URL — lets
  // "Remove background" work on them without re-downloading (no CORS,
  // no network, no cache surprises).
  const uploadedFiles = useRef<Map<string, File>>(new Map());

  async function handleUpload(files: FileList) {
    setUploadError('');
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const { url, file: stored } = await uploadProductImage(file, state.id || undefined);
        if (stored) uploadedFiles.current.set(url, stored);
        uploaded.push(url);
      }
      setState({ ...state, images: [...state.images, ...uploaded] });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function addImageUrl(url: string) {
    const clean = url.trim();
    if (clean) setState({ ...state, images: [...state.images, clean] });
  }

  function removeImageAt(i: number) {
    setState({ ...state, images: state.images.filter((_, idx) => idx !== i) });
  }

  function makePrimary(i: number) {
    if (i === 0) return;
    const next = [...state.images];
    const [chosen] = next.splice(i, 1);
    setState({ ...state, images: [chosen, ...next] });
  }

  /** Get the primary image's bytes: prefer the copy kept from this dialog's
   *  own upload, else download it — with a cache-busting retry and errors
   *  that name the actual problem. */
  async function readSourceImage(target: string): Promise<Blob> {
    const inMemory = uploadedFiles.current.get(target);
    if (inMemory) return inMemory;
    const attempt = async (url: string) => {
      // no-store: never reuse a cached copy saved without CORS headers.
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
      return resp.blob();
    };
    const isStorage = /firebasestorage\.googleapis\.com|\.firebasestorage\.app/.test(target);
    try {
      return await attempt(target);
    } catch (first) {
      // Stale caches can survive no-store on some browsers — retry once with
      // a cache-busting query param before giving up.
      if (isStorage) {
        try {
          return await attempt(`${target}${target.includes('?') ? '&' : '?'}cb=${Date.now()}`);
        } catch {
          /* report based on the first failure below */
        }
      }
      const raw = first instanceof Error ? first.message : String(first);
      const httpStatus = /^HTTP_(\d+)$/.exec(raw)?.[1];
      if (httpStatus) {
        throw new Error(
          `SOURCE_UNREADABLE: Could not open this image (error ${httpStatus}) — its link may have expired or the file was deleted. Upload the photo again, then retry.`,
        );
      }
      throw new Error(
        isStorage
          ? `SOURCE_UNREADABLE: Could not read this image from Storage even though it displays fine (${raw}). A firewall, antivirus, or proxy on this network may be blocking downloads — try another browser or network, or re-upload the photo and run Remove background straight away.`
          : 'SOURCE_UNREADABLE: This image comes from another website that does not allow downloading it. Save the photo to your device and upload it here instead.',
      );
    }
  }

  async function handleDocUpload(kind: 'datasheet' | 'manual', file: File) {
    setDocError('');
    setDocBusy(kind);
    try {
      // Datasheets may be a PDF or an image (it gets shown on the page);
      // manuals are download-only, so PDF it is.
      const { url } = await uploadProductDoc(file, state.id || undefined, kind === 'datasheet');
      setState({ ...state, [kind]: url });
    } catch (e) {
      setDocError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setDocBusy(null);
    }
  }

  /** Cut out the background of `source` and make it the primary image. */
  async function runBackgroundRemoval(source: Blob) {
    setUploadError('');
    setRemovingBg(true);
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      // The AI model is served from our own origin (see public/imgly-data,
      // populated by scripts/copy-imgly-assets.mjs) rather than the flaky
      // third-party CDN. 'small' keeps the one-time download light (~42 MB).
      const blob = await removeBackground(source, {
        publicPath: `${window.location.origin}/imgly-data/`,
        model: 'small',
      });
      const file = new File([blob], 'bg-removed.png', { type: 'image/png' });
      const { url, file: stored } = await uploadProductImage(file, state.id || undefined);
      if (stored) uploadedFiles.current.set(url, stored);
      // Replace the primary image with the cut-out version.
      setState({ ...state, images: [url, ...state.images.slice(1)] });
      setBgFallback(false);
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Background removal failed.';
      // A missing lazy chunk means the site was redeployed while this page
      // was open — reload to pick up the new build, then the user retries.
      if (/dynamically imported module|importing a module script/i.test(raw)) {
        setUploadError('The app was just updated — reloading the page to finish the update…');
        window.setTimeout(() => window.location.reload(), 1500);
        return;
      }
      setUploadError(
        // Reading the source image failed — never report this as a model problem.
        raw.startsWith('SOURCE_UNREADABLE:')
          ? raw.slice('SOURCE_UNREADABLE:'.length).trim()
          : /load failed|failed to fetch|network|fetching of the wasm/i.test(raw)
            ? 'Background removal could not load its AI model. Check your internet connection and try again — a computer with a stable connection works best.'
            : /memory|aborted/i.test(raw)
              ? 'This device ran out of memory running the AI. Try on a computer instead.'
              : raw,
      );
    } finally {
      setRemovingBg(false);
    }
  }

  async function handleRemoveBackground() {
    const target = state.images[0];
    if (!target) return;
    setUploadError('');
    setBgFallback(false);
    setRemovingBg(true);
    let source: Blob | null = null;
    try {
      source = await readSourceImage(target);
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Could not read the image.';
      setUploadError(
        raw.startsWith('SOURCE_UNREADABLE:')
          ? raw.slice('SOURCE_UNREADABLE:'.length).trim()
          : raw,
      );
      // The image itself is unreachable from this device — offer the
      // no-network route: pick the photo file directly.
      setBgFallback(true);
      return;
    } finally {
      setRemovingBg(false);
    }
    await runBackgroundRemoval(source);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl max-h-[90vh]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="font-bold text-slate-900">{isNew ? t('New product') : t('Edit product')}</h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        {state.draft && (
          <p className="mx-5 mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            {t('This product is a draft — it is hidden from the shop until you publish it.')}
          </p>
        )}
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
          <Field label="Sub-categories" full>
            {(settings.subcategories?.[state.category] ?? []).length === 0 ? (
              <p className="text-xs text-slate-500">
                {t('Add sub-categories in Settings → Product sub-categories.')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(settings.subcategories?.[state.category] ?? []).map((sub) => {
                  const chosen = (state.subcategories ?? []).includes(sub);
                  return (
                    <label
                      key={sub}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        chosen
                          ? 'border-brand-500 bg-brand-50 text-brand-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={chosen}
                        onChange={(e) => {
                          const current = state.subcategories ?? [];
                          setState({
                            ...state,
                            subcategories: e.target.checked
                              ? [...current, sub]
                              : current.filter((x) => x !== sub),
                          });
                        }}
                      />
                      {chosen ? '✓ ' : ''}
                      {sub}
                    </label>
                  );
                })}
              </div>
            )}
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
          <Field label="Delivery fee (blank = store default)">
            <input
              type="number"
              min={0}
              className="input"
              value={state.deliveryFee ?? ''}
              placeholder={t('Uses the default delivery fee')}
              onChange={(e) =>
                setState({
                  ...state,
                  deliveryFee: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
            <label className="mt-2 flex items-start gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={Boolean(state.separateDelivery)}
                onChange={(e) => setState({ ...state, separateDelivery: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                {t('Needs its own delivery')} —{' '}
                <span className="text-slate-500">
                  {t('its fee is added on top, even when the cart holds other items')}
                </span>
              </span>
            </label>
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
          <Field label="Product images" full>
            <div className="space-y-3">
              {state.images.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {state.images.map((img, i) => (
                    <div
                      key={`${img}-${i}`}
                      className="group relative h-24 w-24 overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                    >
                      <img src={img} alt="" className="h-full w-full object-cover" />
                      {i === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Main
                        </span>
                      )}
                      {/* Always visible on phones (no hover there). */}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-slate-900/60 px-1 py-0.5 transition sm:opacity-0 sm:group-hover:opacity-100">
                        {i !== 0 ? (
                          <button
                            type="button"
                            onClick={() => makePrimary(i)}
                            className="text-[10px] font-semibold text-white hover:underline"
                            title="Make this the main image"
                          >
                            ★ Main
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingImage(i)}
                          className="text-[10px] font-semibold text-white hover:underline"
                          title="Crop, rotate, or remove the background"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImageAt(i)}
                          className="text-[10px] font-semibold text-red-300 hover:underline"
                          title="Remove this image"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading || removingBg}
                  className="btn-secondary"
                >
                  {uploading ? t('Uploading…') : state.images.length ? t('+ Add images') : t('Upload images')}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  disabled={uploading || removingBg}
                  className="btn-secondary"
                >
                  {t('🖼️ Choose from website')}
                </button>
                {state.images.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveBackground}
                    disabled={uploading || removingBg}
                    className="btn-secondary"
                  >
                    {removingBg ? t('Removing…') : t('Remove background (main)')}
                  </button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length) handleUpload(files);
                }}
              />
              <input
                className="input"
                defaultValue=""
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addImageUrl((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
                onBlur={(e) => {
                  addImageUrl(e.target.value);
                  e.target.value = '';
                }}
                placeholder="…or paste an image URL and press Enter"
              />
              {uploadError && <p className="text-xs text-red-700">{uploadError}</p>}
              {bgFallback && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5">
                  <p className="text-xs text-amber-900">
                    You can still do it without downloading: choose the same photo from this
                    device and the background is removed right here.
                  </p>
                  <button
                    type="button"
                    onClick={() => bgFileInput.current?.click()}
                    disabled={removingBg}
                    className="btn-secondary mt-2 py-1.5 text-sm"
                  >
                    📁 Choose photo from this device
                  </button>
                  <input
                    ref={bgFileInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) runBackgroundRemoval(f);
                    }}
                  />
                </div>
              )}
              <p className="text-xs text-slate-500">
                JPG, PNG, WEBP, AVIF, or GIF · max 5 MB each. The first image is the main one shown
                in listings — tap a thumbnail's ✎ to crop, rotate, or remove its background, ★ to
                make it the main image, ✕ to delete it.
              </p>
            </div>
          </Field>
          <Field label="Datasheet (optional — shown on the product page)" full>
            <DocPicker
              kind="datasheet"
              value={state.datasheet ?? ''}
              accept="application/pdf,image/*"
              hint="PDF or image · shown below the product for customers"
              busy={docBusy}
              onPick={(f) => handleDocUpload('datasheet', f)}
              onClear={() => setState({ ...state, datasheet: '' })}
            />
          </Field>
          <Field label="Manual (optional — download only)" full>
            <DocPicker
              kind="manual"
              value={state.manual ?? ''}
              accept="application/pdf"
              hint="PDF · customers get a download button"
              busy={docBusy}
              onPick={(f) => handleDocUpload('manual', f)}
              onClear={() => setState({ ...state, manual: '' })}
            />
            {docError && <p className="mt-1 text-xs text-red-700">{docError}</p>}
          </Field>
          <Field label="Short description" full>
            <input
              className="input"
              value={state.shortDescription}
              onChange={(e) => setState({ ...state, shortDescription: e.target.value })}
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
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={() => onSave(true)}
            className="btn-secondary"
            disabled={busy}
            title={t('Only staff can see drafts — customers never do.')}
          >
            {state.draft && !isNew ? t('Keep as draft') : t('Save as draft')}
          </button>
          <button type="button" onClick={() => onSave(false)} className="btn-primary" disabled={busy}>
            {busy
              ? t('Saving…')
              : state.draft || isNew
                ? t('Publish')
                : t('Save changes')}
          </button>
        </div>
      </div>
      <MediaPicker
        open={pickerOpen}
        multiple
        title="Choose images already on the website"
        onClose={() => setPickerOpen(false)}
        onSelect={(urls) => setState({ ...state, images: [...state.images, ...urls] })}
      />
      {editingImage !== null && state.images[editingImage] && (
        <ImageEditor
          getSource={() => readSourceImage(state.images[editingImage])}
          sourceUrl={state.images[editingImage]}
          onCancel={() => setEditingImage(null)}
          onSave={async (file) => {
            // Write over the same file where we can, so editing a photo
            // doesn't leave a second copy behind in the media library. A
            // picture from another site has no file of ours to replace, so
            // that one is uploaded fresh.
            const existing = storagePathFromUrl(state.images[editingImage]);
            const { url, file: stored } = existing
              ? await replaceImageAt(existing, file)
              : await uploadProductImage(file, state.id || undefined);
            if (stored) uploadedFiles.current.set(url, stored);
            setState({
              ...state,
              images: state.images.map((img, idx) => (idx === editingImage ? url : img)),
            });
            setEditingImage(null);
          }}
        />
      )}
    </div>
  );
}

function DocPicker({
  kind,
  value,
  accept,
  hint,
  busy,
  onPick,
  onClear,
}: {
  kind: 'datasheet' | 'manual';
  value: string;
  accept: string;
  hint: string;
  busy: 'datasheet' | 'manual' | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`btn-secondary cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy === kind ? 'Uploading…' : value ? 'Replace file' : 'Upload file'}
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = '';
            }}
          />
        </label>
        {value && (
          <>
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              View ↗
            </a>
            <button
              type="button"
              onClick={onClear}
              className="text-sm font-semibold text-red-700 hover:underline"
            >
              Remove
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function Field({
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
        {useLang().t(label)}
      </label>
      {children}
    </div>
  );
}

/** "Name: value" lines, in the order they were written. */
export function parseSpecRows(text: string): { name: string; value: string }[] {
  const rows: { name: string; value: string }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (name && value) rows.push({ name, value });
  }
  return rows;
}

export function parseSpecs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { name, value } of parseSpecRows(text)) out[name] = value;
  return out;
}

/** Spec rows in their saved order, falling back to older map-only records. */
export function specRowsOf(p: {
  specs: Record<string, string>;
  specsList?: { name: string; value: string }[];
}): { name: string; value: string }[] {
  if (p.specsList?.length) return p.specsList;
  return Object.entries(p.specs ?? {}).map(([name, value]) => ({ name, value }));
}
