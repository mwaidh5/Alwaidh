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
import { db } from '../firebase';

/** A column in the price sheet (label is what shows in the header). */
export interface PriceColumn {
  key: string;
  label: string;
  sub?: string; // optional small sub-label, e.g. "Backup Time"
}

/** A row is a map of column-key -> cell value, plus a sort order. */
export interface PriceRow {
  id: string;
  order: number;
  values: Record<string, string>;
}

export const DEFAULT_COLUMNS: PriceColumn[] = [
  { key: 'capacity', label: 'السعة' },
  { key: 'inverter', label: 'العاكسة' },
  { key: 'panels', label: 'عدد الألواح' },
  { key: 'batteries', label: 'البطاريات' },
  { key: 'backup', label: 'ساعات التغذية', sub: 'Backup Time' },
  { key: 'price', label: 'السعر' },
  { key: 'priceWithInverter', label: 'السعر مع انفيرتر', sub: 'IP65' },
];

const COLLECTION = 'solarPrices';
const LS_KEY = 'alwaidh.solarPriceRows.v1';
const LS_SEEDED = 'alwaidh.solarPriceRows.seeded.v1';

const SEED: Omit<PriceRow, 'id'>[] = [
  { order: 0, values: { capacity: '4 أمبير', inverter: '2 كيلو واط', panels: '2', batteries: 'ليثيوم 5 كيلو واط', backup: '4 ساعة', price: '2,150,000', priceWithInverter: '-' } },
  { order: 1, values: { capacity: '10 أمبير', inverter: '3 كيلو واط', panels: '6', batteries: 'بطاريتين ليثيوم 5 كيلو واط', backup: '3.75 ساعة', price: '3,800,000', priceWithInverter: '-' } },
  { order: 2, values: { capacity: '20 أمبير', inverter: '6 كيلو واط', panels: '12', batteries: 'ليثيوم 15 كيلو واط', backup: '3 ساعة', price: '5,450,000', priceWithInverter: '6,000,000' } },
  { order: 3, values: { capacity: '30 أمبير', inverter: '11 كيلو واط', panels: '18', batteries: 'بطاريتين ليثيوم 15 كيلو واط', backup: '4 ساعة', price: '9,100,000', priceWithInverter: '10,000,000' } },
  { order: 4, values: { capacity: '40 أمبير', inverter: '12 كيلو واط', panels: '24', batteries: 'بطاريتين ليثيوم 15 كيلو واط', backup: '3 ساعة', price: '10,200,000', priceWithInverter: '11,100,000' } },
  { order: 5, values: { capacity: '50 أمبير', inverter: '12 كيلو واط', panels: '28', batteries: '3 بطاريات ليثيوم 15 كيلو واط', backup: '3 ساعة', price: '14,250,000', priceWithInverter: '-' } },
];

export const SEED_PRICE_ROWS: PriceRow[] = SEED.map((r, i) => ({ ...r, id: `sample-${i}` }));

function readLocal(): PriceRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PriceRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: PriceRow[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY }));
  } catch {
    /* ignore */
  }
}

function normalize(data: Record<string, unknown>, id: string): PriceRow {
  const values = (data.values && typeof data.values === 'object' ? data.values : {}) as Record<string, string>;
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) clean[k] = String(v ?? '');
  return { id, order: Number(data.order ?? 0), values: clean };
}

async function seedIfEmpty(database: Firestore | null): Promise<void> {
  if (database) {
    const snap = await getDocs(collection(database, COLLECTION));
    if (!snap.empty) return;
    await Promise.all(
      SEED.map((r) => addDoc(collection(database, COLLECTION), { ...r, createdAt: serverTimestamp() })),
    );
    return;
  }
  if (!localStorage.getItem(LS_SEEDED)) {
    writeLocal(SEED.map((r, i) => ({ ...r, id: `seed-${i}` })));
    localStorage.setItem(LS_SEEDED, '1');
  }
}

export async function listPriceRows(): Promise<PriceRow[]> {
  const database = db;
  await seedIfEmpty(database);
  if (database) {
    const snap = await getDocs(query(collection(database, COLLECTION), orderBy('order', 'asc')));
    return snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id));
  }
  return readLocal().slice().sort((a, b) => a.order - b.order);
}

export function subscribePriceRows(cb: (list: PriceRow[]) => void): () => void {
  const database = db;
  if (database) {
    seedIfEmpty(database).catch(() => {
      /* non-fatal */
    });
    return onSnapshot(
      query(collection(database, COLLECTION), orderBy('order', 'asc')),
      (snap) => cb(snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id))),
      () => cb([]),
    );
  }
  listPriceRows().then(cb);
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) listPriceRows().then(cb);
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export async function createPriceRow(order: number): Promise<void> {
  const database = db;
  const row = { order, values: {} as Record<string, string> };
  if (database) {
    await addDoc(collection(database, COLLECTION), { ...row, createdAt: serverTimestamp() });
    return;
  }
  const list = readLocal();
  list.push({ ...row, id: `local-${Date.now()}` });
  writeLocal(list);
}

export async function upsertPriceRow(row: PriceRow): Promise<void> {
  const database = db;
  if (database) {
    await setDoc(doc(database, COLLECTION, row.id), {
      order: row.order,
      values: row.values,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const list = readLocal();
  const idx = list.findIndex((r) => r.id === row.id);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  writeLocal(list);
}

export async function deletePriceRow(id: string): Promise<void> {
  const database = db;
  if (database) {
    await deleteDoc(doc(database, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((r) => r.id !== id));
}
