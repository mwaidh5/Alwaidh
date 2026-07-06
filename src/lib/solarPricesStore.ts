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

export interface SolarPrice {
  id: string;
  capacity: string; // السعة
  inverter: string; // العاكسة
  panels: string; // عدد الألواح
  batteries: string; // البطاريات
  backup: string; // ساعات التغذية / Backup Time
  price: string; // السعر
  priceWithInverter: string; // السعر مع انفيرتر IP65
  order: number;
}

const COLLECTION = 'solarPrices';
const LS_KEY = 'alwaidh.solarPrices.v1';
const LS_SEEDED = 'alwaidh.solarPrices.seeded.v1';

const SEED: Omit<SolarPrice, 'id'>[] = [
  { capacity: '4 أمبير', inverter: '2 كيلو واط', panels: '2', batteries: 'ليثيوم 5 كيلو واط', backup: '4 ساعة', price: '2,150,000', priceWithInverter: '-', order: 0 },
  { capacity: '10 أمبير', inverter: '3 كيلو واط', panels: '6', batteries: 'بطاريتين ليثيوم 5 كيلو واط', backup: '3.75 ساعة', price: '3,800,000', priceWithInverter: '-', order: 1 },
  { capacity: '20 أمبير', inverter: '6 كيلو واط', panels: '12', batteries: 'ليثيوم 15 كيلو واط', backup: '3 ساعة', price: '5,450,000', priceWithInverter: '6,000,000', order: 2 },
  { capacity: '30 أمبير', inverter: '11 كيلو واط', panels: '18', batteries: 'بطاريتين ليثيوم 15 كيلو واط', backup: '4 ساعة', price: '9,100,000', priceWithInverter: '10,000,000', order: 3 },
  { capacity: '40 أمبير', inverter: '12 كيلو واط', panels: '24', batteries: 'بطاريتين ليثيوم 15 كيلو واط', backup: '3 ساعة', price: '10,200,000', priceWithInverter: '11,100,000', order: 4 },
  { capacity: '50 أمبير', inverter: '12 كيلو واط', panels: '28', batteries: '3 بطاريات ليثيوم 15 كيلو واط', backup: '3 ساعة', price: '14,250,000', priceWithInverter: '-', order: 5 },
];

export const SEED_PRICES: SolarPrice[] = SEED.map((p, i) => ({ ...p, id: `sample-${i}` }));

function readLocal(): SolarPrice[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SolarPrice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: SolarPrice[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY }));
  } catch {
    /* ignore */
  }
}

function normalize(data: Record<string, unknown>, id: string): SolarPrice {
  return {
    id,
    capacity: String(data.capacity ?? ''),
    inverter: String(data.inverter ?? ''),
    panels: String(data.panels ?? ''),
    batteries: String(data.batteries ?? ''),
    backup: String(data.backup ?? ''),
    price: String(data.price ?? ''),
    priceWithInverter: String(data.priceWithInverter ?? ''),
    order: Number(data.order ?? 0),
  };
}

async function seedIfEmpty(database: Firestore | null): Promise<void> {
  if (database) {
    const snap = await getDocs(collection(database, COLLECTION));
    if (!snap.empty) return;
    await Promise.all(
      SEED.map((p) => addDoc(collection(database, COLLECTION), { ...p, createdAt: serverTimestamp() })),
    );
    return;
  }
  if (!localStorage.getItem(LS_SEEDED)) {
    writeLocal(SEED.map((p, i) => ({ ...p, id: `seed-${i}` })));
    localStorage.setItem(LS_SEEDED, '1');
  }
}

export async function listSolarPrices(): Promise<SolarPrice[]> {
  const database = db;
  await seedIfEmpty(database);
  if (database) {
    const snap = await getDocs(query(collection(database, COLLECTION), orderBy('order', 'asc')));
    return snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id));
  }
  return readLocal().slice().sort((a, b) => a.order - b.order);
}

export function subscribeSolarPrices(cb: (list: SolarPrice[]) => void): () => void {
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
  listSolarPrices().then(cb);
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) listSolarPrices().then(cb);
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export async function createSolarPrice(input: Omit<SolarPrice, 'id'>): Promise<void> {
  const database = db;
  if (database) {
    await addDoc(collection(database, COLLECTION), { ...input, createdAt: serverTimestamp() });
    return;
  }
  const list = readLocal();
  list.push({ ...input, id: `local-${Date.now()}` });
  writeLocal(list);
}

export async function upsertSolarPrice(item: SolarPrice): Promise<void> {
  const database = db;
  if (database) {
    await setDoc(doc(database, COLLECTION, item.id), { ...item, updatedAt: serverTimestamp() });
    return;
  }
  const list = readLocal();
  const idx = list.findIndex((p) => p.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  writeLocal(list);
}

export async function deleteSolarPrice(id: string): Promise<void> {
  const database = db;
  if (database) {
    await deleteDoc(doc(database, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((p) => p.id !== id));
}
