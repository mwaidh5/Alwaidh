import {
  addDoc,
  collection,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Product } from '../types/product';

/**
 * The product diary: who added, changed, trashed or restored what, and
 * exactly which fields moved. Written beside every product write; only
 * staff may read it, and nobody may edit or erase an entry.
 */

const COLLECTION = 'productLogs';

export type ProductAction = 'added' | 'edited' | 'trashed' | 'restored' | 'deleted' | 'photos';

export interface ProductLogEntry {
  id: string;
  productId: string;
  productName: string;
  action: ProductAction;
  /** One line per field that moved, already in plain words. */
  changes: string[];
  by: string;
  atMs: number;
}

/** The fields worth naming, in the order a person would read them. */
const WATCHED: { key: keyof Product; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'nameAr', label: 'Arabic name' },
  { key: 'price', label: 'Price' },
  { key: 'oldPrice', label: 'Old price' },
  { key: 'currency', label: 'Currency' },
  { key: 'inStock', label: 'In stock' },
  { key: 'draft', label: 'Draft' },
  { key: 'comingSoon', label: 'Coming soon' },
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
  { key: 'subcategories', label: 'Sub-categories' },
  { key: 'shortDescription', label: 'Description' },
  { key: 'shortDescriptionAr', label: 'Arabic description' },
  { key: 'keywordsAr', label: 'Arabic keywords' },
  { key: 'specs', label: 'Specs' },
  { key: 'specsList', label: 'Specs' },
  { key: 'images', label: 'Photos' },
  { key: 'image', label: 'Main photo' },
  { key: 'datasheet', label: 'Datasheet' },
  { key: 'manual', label: 'Manual' },
  { key: 'deliveryFee', label: 'Delivery fee' },
  { key: 'separateDelivery', label: 'Separate delivery' },
  { key: 'imageFit', label: 'Photo fit' },
  { key: 'rating', label: 'Rating' },
];

function show(v: unknown): string {
  if (v === undefined || v === null || v === '') return 'empty';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return v.toLocaleString('en-US');
  if (Array.isArray(v)) return v.length ? `${v.length} item${v.length === 1 ? '' : 's'}` : 'none';
  if (typeof v === 'object') {
    const n = Object.keys(v as object).length;
    return n ? `${n} entr${n === 1 ? 'y' : 'ies'}` : 'none';
  }
  const s = String(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const empty = (v: unknown) => v === undefined || v === null || v === '';
  if (empty(a) && empty(b)) return true;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** What changed between two versions, in words: "Price: 80,000 → 90,000". */
export function describeChanges(before: Partial<Product>, after: Partial<Product>): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const { key, label } of WATCHED) {
    if (!(key in after)) continue;
    if (same(before[key], after[key])) continue;
    // Specs and specsList are the same thing to a reader; say it once.
    if (seen.has(label)) continue;
    seen.add(label);
    lines.push(`${label}: ${show(before[key])} → ${show(after[key])}`);
  }
  return lines;
}

/** Record one product event. Never throws — a lost log must not lose a save. */
export async function logProduct(
  action: ProductAction,
  productId: string,
  productName: string,
  changes: string[] = [],
): Promise<void> {
  const database = db;
  if (!database) return;
  try {
    await addDoc(collection(database, COLLECTION), {
      productId,
      productName,
      action,
      changes: changes.slice(0, 25),
      by: auth?.currentUser?.email?.toLowerCase() ?? '',
      at: serverTimestamp(),
    });
  } catch {
    /* the diary is a convenience, not a gate */
  }
}

function normalize(data: Record<string, unknown>, id: string): ProductLogEntry {
  const at = data.at as { toMillis?: () => number } | null;
  return {
    id,
    productId: String(data.productId ?? ''),
    productName: String(data.productName ?? ''),
    action: (['added', 'edited', 'trashed', 'restored', 'deleted', 'photos'] as ProductAction[]).includes(
      data.action as ProductAction,
    )
      ? (data.action as ProductAction)
      : 'edited',
    changes: Array.isArray(data.changes) ? (data.changes as unknown[]).map(String) : [],
    by: String(data.by ?? ''),
    atMs: typeof at?.toMillis === 'function' ? at.toMillis() : 0,
  };
}

/** The whole diary, newest first — or one product's, when an id is given. */
export function subscribeProductLog(
  cb: (list: ProductLogEntry[]) => void,
  options: { productId?: string; limit?: number } = {},
): () => void {
  const database = db;
  if (!database) {
    cb([]);
    return () => {};
  }
  const base = collection(database, COLLECTION);
  const q = options.productId
    ? query(base, where('productId', '==', options.productId), orderBy('at', 'desc'), fbLimit(options.limit ?? 100))
    : query(base, orderBy('at', 'desc'), fbLimit(options.limit ?? 200));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id))),
    () => cb([]),
  );
}
