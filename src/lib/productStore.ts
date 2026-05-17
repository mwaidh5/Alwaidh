import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { db, firebaseReady } from '../firebase';
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
    currency: String(data.currency ?? 'USD'),
    image: String(data.image ?? ''),
    rating: Number(data.rating ?? 0),
    inStock: Boolean(data.inStock ?? true),
    shortDescription: String(data.shortDescription ?? ''),
    description: String(data.description ?? ''),
    specs: (data.specs as Record<string, string>) ?? {},
  };
}

async function seedIfEmpty(database: Firestore | null): Promise<void> {
  if (database) {
    const snap = await getDocs(collection(database, COLLECTION));
    if (!snap.empty) return;
    await Promise.all(
      seedProducts.map((p) =>
        setDoc(doc(database, COLLECTION, p.id), {
          ...p,
          createdAt: serverTimestamp(),
        }),
      ),
    );
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
    return snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id));
  }
  return readLocal().slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function subscribeProducts(cb: (list: Product[]) => void): () => void {
  const database = db;
  if (database) {
    seedIfEmpty(database);
    const unsub = onSnapshot(
      query(collection(database, COLLECTION), orderBy('name', 'asc')),
      (snap) => {
        cb(snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id)));
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

export async function deleteProduct(id: string): Promise<void> {
  const database = db;
  if (database) {
    await deleteDoc(doc(database, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((p) => p.id !== id));
  triggerLocalChange();
}

export async function resetProductsToSeed(): Promise<void> {
  const database = db;
  if (database) {
    const snap = await getDocs(collection(database, COLLECTION));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await Promise.all(
      seedProducts.map((p) =>
        setDoc(doc(database, COLLECTION, p.id), { ...p, createdAt: serverTimestamp() }),
      ),
    );
    return;
  }
  writeLocal(seedProducts);
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
