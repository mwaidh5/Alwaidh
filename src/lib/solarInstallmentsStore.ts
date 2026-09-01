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
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * The Central Bank initiative systems: sold on installments, priced from
 * one number — the 7-year total the bank's table publishes. Everything
 * else derives from it:
 *
 *   cash price      = 7-year total ÷ 1.225  (3% a year, plus a flat 1.5%)
 *   N-year total    = cash × (1 + 0.03 × N + 0.015)
 *   monthly payment = N-year total ÷ (N × 12)
 *
 * So a one-year plan costs 4.5% over cash and the seven-year plan 22.5%.
 * Everything is rounded to the nearest thousand dinars — nobody quotes
 * hundreds on a fifteen-million-dinar system.
 */
export interface InstallmentRow {
  id: string;
  order: number;
  /** System size, both units: "3" KW / "13" A. */
  sizeKw: string;
  sizeAmp: string;
  inverterKw: string;
  panelsKwp: string;
  panelsCount: string;
  batteryKwh: string;
  batteryLabel: string;
  backupHours: string;
  /** The published 7-year total, in dinars. */
  price7: number;
}

export const YEAR_RATE = 0.03;
/** The bank's flat charge on top of the yearly rate. */
export const BASE_RATE = 0.015;
export const FULL_YEARS = 7;

/** To the nearest thousand dinars. */
const round1k = (n: number) => Math.round(n / 1000) * 1000;

/** What a plan of N years costs over the cash price: 4.5% at one year,
 *  22.5% at seven. */
export function planRate(years: number): number {
  return 1 + YEAR_RATE * years + BASE_RATE;
}

export function cashPrice(price7: number): number {
  return round1k(price7 / planRate(FULL_YEARS));
}
export function planTotal(price7: number, years: number): number {
  if (years >= FULL_YEARS) return round1k(price7);
  return round1k(cashPrice(price7) * planRate(years));
}
export function planMonthly(price7: number, years: number): number {
  return round1k(planTotal(price7, years) / (years * 12));
}

const COLLECTION = 'solarInstallments';
const LS_KEY = 'alwaidh.solarInstallments.v1';

/** The bank's table, as published (August 2026). */
const SEED: Omit<InstallmentRow, 'id'>[] = [
  { order: 0, sizeKw: '3', sizeAmp: '13', inverterKw: '6', panelsKwp: '4.55', panelsCount: '7', batteryKwh: '16', batteryLabel: 'بطارية واحدة', backupHours: '4.25', price7: 8470000 },
  { order: 1, sizeKw: '5', sizeAmp: '22', inverterKw: '8', panelsKwp: '7.8', panelsCount: '12', batteryKwh: '32', batteryLabel: 'بطاريتين', backupHours: '5', price7: 14520000 },
  { order: 2, sizeKw: '6', sizeAmp: '26', inverterKw: '8', panelsKwp: '9.1', panelsCount: '14', batteryKwh: '32', batteryLabel: 'بطاريتين', backupHours: '4.25', price7: 15488000 },
  { order: 3, sizeKw: '7', sizeAmp: '30', inverterKw: '12', panelsKwp: '10.4', panelsCount: '16', batteryKwh: '32', batteryLabel: 'بطاريتين', backupHours: '4', price7: 16940000 },
  { order: 4, sizeKw: '9', sizeAmp: '40', inverterKw: '12', panelsKwp: '13.65', panelsCount: '21', batteryKwh: '48', batteryLabel: 'ثلاث بطاريات', backupHours: '4', price7: 22385000 },
  { order: 5, sizeKw: '10', sizeAmp: '45', inverterKw: '12', panelsKwp: '15.6', panelsCount: '24', batteryKwh: '48', batteryLabel: 'ثلاث بطاريات', backupHours: '4', price7: 24200000 },
];

export const SEED_INSTALLMENT_ROWS: InstallmentRow[] = SEED.map((r, i) => ({ ...r, id: `sample-${i}` }));

function normalize(data: Record<string, unknown>, id: string): InstallmentRow {
  return {
    id,
    order: Number(data.order ?? 0),
    sizeKw: String(data.sizeKw ?? ''),
    sizeAmp: String(data.sizeAmp ?? ''),
    inverterKw: String(data.inverterKw ?? ''),
    panelsKwp: String(data.panelsKwp ?? ''),
    panelsCount: String(data.panelsCount ?? ''),
    batteryKwh: String(data.batteryKwh ?? ''),
    batteryLabel: String(data.batteryLabel ?? ''),
    backupHours: String(data.backupHours ?? ''),
    price7: Number(data.price7 ?? 0),
  };
}

function readLocal(): InstallmentRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? (JSON.parse(raw) as InstallmentRow[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeLocal(list: InstallmentRow[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function subscribeInstallmentRows(cb: (list: InstallmentRow[]) => void): () => void {
  const database = db;
  if (!database) {
    cb(readLocal());
    return () => {};
  }
  return onSnapshot(
    query(collection(database, COLLECTION), orderBy('order', 'asc')),
    (snap) => cb(snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id))),
    () => cb([]),
  );
}

export async function listInstallmentRows(): Promise<InstallmentRow[]> {
  const database = db;
  if (!database) return readLocal();
  const snap = await getDocs(query(collection(database, COLLECTION), orderBy('order', 'asc')));
  return snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id));
}

export async function createInstallmentRow(order: number): Promise<void> {
  const database = db;
  const row = { ...SEED[0], order, sizeKw: '', sizeAmp: '', inverterKw: '', panelsKwp: '', panelsCount: '', batteryKwh: '', batteryLabel: '', backupHours: '', price7: 0 };
  if (database) {
    await addDoc(collection(database, COLLECTION), { ...row, createdAt: serverTimestamp() });
    return;
  }
  const list = readLocal();
  list.push({ ...row, id: `local-${Date.now()}` });
  writeLocal(list);
}

export async function upsertInstallmentRow(row: InstallmentRow): Promise<void> {
  const database = db;
  if (database) {
    const { id, ...rest } = row;
    await setDoc(doc(database, COLLECTION, id), { ...rest, updatedAt: serverTimestamp() });
    return;
  }
  const list = readLocal();
  const idx = list.findIndex((r) => r.id === row.id);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  writeLocal(list);
}

export async function deleteInstallmentRow(id: string): Promise<void> {
  const database = db;
  if (database) {
    await deleteDoc(doc(database, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((r) => r.id !== id));
}
