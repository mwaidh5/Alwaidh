import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { auth, db, firebaseReady } from '../firebase';
import { products as seedProducts } from '../data/products';
import type { Product } from '../types/product';

const COLLECTION = 'products';
const LS_KEY = 'alwaidh.products.v1';
const LS_SEEDED = 'alwaidh.products.seeded.v1';

export type StorageMode = 'firestore' | 'local';

export function productStorageMode(): StorageMode {
  return firebaseReady && db ? 'firestore' : 'local';
}

function readLocal(): Product[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Product[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: Product[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function normalize(data: Record<string, unknown>, id: string): Product {
  return {
    id,
    name: String(data.name ?? ''),
    category: (data.category as Product['category']) ?? 'computers',
    brand: String(data.brand ?? ''),
    price: Number(data.price ?? 0),
    currency: String(data.currency ?? 'IQD'),
    ...(() => {
      const arr = Array.isArray(data.images) ? data.images.map(String).filter(Boolean) : [];
      const primary = String(data.image ?? '');
      const images = arr.length ? arr : primary ? [primary] : [];
      return { image: images[0] ?? '', images };
    })(),
    rating: Number(data.rating ?? 0),
    inStock: Boolean(data.inStock ?? true),
    shortDescription: String(data.shortDescription ?? ''),
    description: String(data.description ?? ''),
    specs: (data.specs as Record<string, string>) ?? {},
    datasheet: String(data.datasheet ?? ''),
    manual: String(data.manual ?? ''),
    deletedAtMs: toMillis(data.deletedAt),
    deletedBy: String(data.deletedBy ?? ''),
  };
}

/** Firestore Timestamp (or ms number from the local fallback) → ms epoch. */
function toMillis(v: unknown): number | null {
  if (typeof v === 'number') return v;
  const ts = v as { toMillis?: () => number } | null;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : null;
}

/** Marker doc: proves seeding already happened once, so emptying the
 *  catalogue (or the Trash) never resurrects the demo products. */
const SEED_MARKER = '__seeded__';

function isRealProductDoc(id: string): boolean {
  return id !== SEED_MARKER;
}

async function seedIfEmpty(database: Firestore | null): Promise<void> {
  if (database) {
    const snap = await getDocs(collection(database, COLLECTION));
    // Any doc — product, trashed product, or the marker — means the shop
    // has been set up before: never re-create the demo catalogue.
    if (!snap.empty) return;
    const marker = await getDoc(doc(database, COLLECTION, SEED_MARKER));
    if (marker.exists()) return;
    await Promise.all([
      ...seedProducts.map((p) =>
        setDoc(doc(database, COLLECTION, p.id), {
          ...p,
          createdAt: serverTimestamp(),
        }),
      ),
      setDoc(doc(database, COLLECTION, SEED_MARKER), { seededAt: serverTimestamp() }),
    ]);
    return;
  }
  if (!localStorage.getItem(LS_SEEDED)) {
    writeLocal(seedProducts);
    localStorage.setItem(LS_SEEDED, '1');
  }
}

export async function listProducts(): Promise<Product[]> {
  const database = db;
  await seedIfEmpty(database);
  if (database) {
    const snap = await getDocs(query(collection(database, COLLECTION), orderBy('name', 'asc')));
    return snap.docs
      .filter((d) => isRealProductDoc(d.id))
      .map((d) => normalize(d.data() as Record<string, unknown>, d.id))
      .filter((p) => !p.deletedAtMs);
  }
  return readLocal()
    .filter((p) => !p.deletedAtMs)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function subscribeProducts(cb: (list: Product[]) => void): () => void {
  const database = db;
  if (database) {
    seedIfEmpty(database).catch((e) =>
      console.warn('Product seed skipped:', e instanceof Error ? e.message : e),
    );
    const unsub = onSnapshot(
      query(collection(database, COLLECTION), orderBy('name', 'asc')),
      (snap) => {
        cb(
          snap.docs
            .filter((d) => isRealProductDoc(d.id))
            .map((d) => normalize(d.data() as Record<string, unknown>, d.id))
            .filter((p) => !p.deletedAtMs),
        );
      },
      (err) => {
        console.error('Products subscription failed; falling back to empty list:', err);
        cb([]);
      },
    );
    return unsub;
  }
  listProducts().then(cb);
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) listProducts().then(cb);
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** Live list of products in the Trash (soft-deleted), newest first. */
export function subscribeDeletedProducts(cb: (list: Product[]) => void): () => void {
  const database = db;
  if (database) {
    return onSnapshot(
      collection(database, COLLECTION),
      (snap) => {
        cb(
          snap.docs
            .filter((d) => isRealProductDoc(d.id))
            .map((d) => normalize(d.data() as Record<string, unknown>, d.id))
            .filter((p) => Boolean(p.deletedAtMs))
            .sort((a, b) => (b.deletedAtMs ?? 0) - (a.deletedAtMs ?? 0)),
        );
      },
      () => cb([]),
    );
  }
  const emit = () => cb(readLocal().filter((p) => Boolean(p.deletedAtMs)));
  emit();
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) emit();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export async function getProductById(id: string): Promise<Product | null> {
  const list = await listProducts();
  return list.find((p) => p.id === id) ?? null;
}

export async function upsertProduct(product: Product): Promise<void> {
  const database = db;
  if (database) {
    await setDoc(doc(database, COLLECTION, product.id), {
      ...product,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const list = readLocal();
  const existing = list.findIndex((p) => p.id === product.id);
  if (existing >= 0) list[existing] = product;
  else list.push(product);
  writeLocal(list);
  triggerLocalChange();
}

export async function createProduct(input: Omit<Product, 'id'>): Promise<string> {
  const database = db;
  const id = slugify(input.name) || crypto.randomUUID();
  if (database) {
    const ref = await addDoc(collection(database, COLLECTION), {
      ...input,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }
  const product: Product = { id, ...input };
  const list = readLocal();
  list.push(product);
  writeLocal(list);
  triggerLocalChange();
  return id;
}

/** Move a product to the Trash (recoverable — see restoreProduct). */
export async function deleteProduct(id: string): Promise<void> {
  const database = db;
  if (database) {
    await setDoc(
      doc(database, COLLECTION, id),
      { deletedAt: serverTimestamp(), deletedBy: auth?.currentUser?.email ?? '' },
      { merge: true },
    );
    return;
  }
  writeLocal(
    readLocal().map((p) => (p.id === id ? { ...p, deletedAtMs: Date.now() } : p)),
  );
  triggerLocalChange();
}

/** Bring a product back from the Trash. */
export async function restoreProduct(id: string): Promise<void> {
  const database = db;
  if (database) {
    await setDoc(
      doc(database, COLLECTION, id),
      { deletedAt: deleteField(), deletedBy: deleteField() },
      { merge: true },
    );
    return;
  }
  writeLocal(
    readLocal().map((p) => (p.id === id ? { ...p, deletedAtMs: null, deletedBy: '' } : p)),
  );
  triggerLocalChange();
}

/** Permanently delete a product (from the Trash). Cannot be undone. */
export async function destroyProduct(id: string): Promise<void> {
  const database = db;
  if (database) {
    // Ensure the seed marker exists first, so emptying the whole catalogue
    // can never trigger the demo products to come back.
    await setDoc(doc(database, COLLECTION, SEED_MARKER), { seededAt: serverTimestamp() }, { merge: true });
    await deleteDoc(doc(database, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((p) => p.id !== id));
  localStorage.setItem(LS_SEEDED, '1');
  triggerLocalChange();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function triggerLocalChange(): void {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY }));
  } catch {
    /* ignore */
  }
}
