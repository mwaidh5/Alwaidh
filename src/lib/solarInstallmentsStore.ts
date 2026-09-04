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
 * one number — the cash price staff type in, kept exactly as typed.
 * Everything else derives from it:
 *
 *   N-year total    = cash × (1 + 0.03 × N + 0.015)
 *   monthly payment = N-year total ÷ (N × 12)
 *
 * So a one-year plan costs 4.5% over cash and the seven-year plan 22.5%.
 * The derived numbers are rounded to the nearest thousand dinars — nobody
 * quotes hundreds on a fifteen-million-dinar system — but the typed cash
 * price is never touched.
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
  /** The cash price, in dinars, exactly as staff typed it. */
  cash: number;
  /** The 7-year total, derived from the cash price and kept for older
   *  readers of the collection. */
  price7: number;
}

/**
 * More backup: each extra 16 KWh battery costs the same, and how many
 * hours it adds depends on how big the system is — about three on a
 * 20 A system, one on a 60 A system. That is 60 ÷ amps, to the half hour.
 */
export const EXTRA_BATTERY_PRICE = 2_700_000;
export const EXTRA_BATTERY_KWH = 16;
export const MAX_EXTRA_BATTERIES = 4;
export function extraBatteryHours(sizeAmp: string | number): number {
  const amps = Number(String(sizeAmp).replace(/[^\d.]/g, ''));
  if (!(amps > 0)) return 0;
  return Math.max(0.5, Math.round((60 / amps) * 2) / 2);
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

/** The cash price is the typed number itself. */
export function cashPrice(cash: number): number {
  return cash;
}
export function planTotal(cash: number, years: number): number {
  return round1k(cash * planRate(years));
}
export function planMonthly(cash: number, years: number): number {
  return round1k(planTotal(cash, years) / (years * 12));
}
/**
 * A row saved by an older version of the site carries only the 7-year
 * figure. Two rates have been in use - 1.225 now, 1.21 before - and staff
 * type round thousands, so the divisor that lands on a round thousand is
 * the one that row was saved with. Failing both, the current rate, to
 * the thousand.
 */
function legacyCash(price7: number): number {
  if (!(price7 > 0)) return 0;
  for (const rate of [planRate(FULL_YEARS), 1.21]) {
    const cash = price7 / rate;
    if (Math.abs(cash - Math.round(cash)) < 1e-6 && Math.round(cash) % 1000 === 0) return Math.round(cash);
  }
  return round1k(price7 / planRate(FULL_YEARS));
}

/** The bank's 7-year figure for a cash price, unrounded. */
export function price7Of(cash: number): number {
  return Math.round(cash * planRate(FULL_YEARS));
}

const COLLECTION = 'solarInstallments';
const LS_KEY = 'alwaidh.solarInstallments.v1';

/** The bank's table, as published (August 2026). */
const SEED: Omit<InstallmentRow, 'id' | 'cash'>[] = [
  { order: 0, sizeKw: '3', sizeAmp: '13', inverterKw: '6', panelsKwp: '4.55', panelsCount: '7', batteryKwh: '16', batteryLabel: 'بطارية واحدة', backupHours: '4.25', price7: 8470000 },
  { order: 1, sizeKw: '5', sizeAmp: '22', inverterKw: '8', panelsKwp: '7.8', panelsCount: '12', batteryKwh: '32', batteryLabel: 'بطاريتين', backupHours: '5', price7: 14520000 },
  { order: 2, sizeKw: '6', sizeAmp: '26', inverterKw: '8', panelsKwp: '9.1', panelsCount: '14', batteryKwh: '32', batteryLabel: 'بطاريتين', backupHours: '4.25', price7: 15488000 },
  { order: 3, sizeKw: '7', sizeAmp: '30', inverterKw: '12', panelsKwp: '10.4', panelsCount: '16', batteryKwh: '32', batteryLabel: 'بطاريتين', backupHours: '4', price7: 16940000 },
  { order: 4, sizeKw: '9', sizeAmp: '40', inverterKw: '12', panelsKwp: '13.65', panelsCount: '21', batteryKwh: '48', batteryLabel: 'ثلاث بطاريات', backupHours: '4', price7: 22385000 },
  { order: 5, sizeKw: '10', sizeAmp: '45', inverterKw: '12', panelsKwp: '15.6', panelsCount: '24', batteryKwh: '48', batteryLabel: 'ثلاث بطاريات', backupHours: '4', price7: 24200000 },
];

export const SEED_INSTALLMENT_ROWS: InstallmentRow[] = SEED.map((r, i) => ({
  ...r,
  id: `sample-${i}`,
  cash: round1k(r.price7 / planRate(FULL_YEARS)),
}));

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
    cash: Number(data.cash) > 0 ? Number(data.cash) : legacyCash(Number(data.price7)),
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
  const row = { ...SEED[0], order, sizeKw: '', sizeAmp: '', inverterKw: '', panelsKwp: '', panelsCount: '', batteryKwh: '', batteryLabel: '', backupHours: '', cash: 0, price7: 0 };
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
    await setDoc(doc(database, COLLECTION, id), {
      ...rest,
      cash: row.cash,
      price7: price7Of(row.cash),
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

export async function deleteInstallmentRow(id: string): Promise<void> {
  const database = db;
  if (database) {
    await deleteDoc(doc(database, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((r) => r.id !== id));
}
