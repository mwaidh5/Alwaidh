import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_COLUMNS, type PriceColumn } from './solarPricesStore';

export interface SiteSettings {
  storeName: string;
  contactEmail: string;
  supportPhone: string;
  defaultCurrency: string;
  taxRatePercent: number;
  shippingFlat: number;
  enableCheckout: boolean;
  showSolarCalculator: boolean;
  maintenanceMode: boolean;
  bannerMessage: string;
  extraAdminEmails: string[];
  computerStaffEmails: string[];
  solarStaffEmails: string[];
  heroImage: string;
  solarBannerImage: string;
  logoImage: string;
  tiandyLogo: string;
  solarPriceColumns: PriceColumn[];
}

export const DEFAULT_SETTINGS: SiteSettings = {
  storeName: 'Alwaidh',
  contactEmail: 'hello@alwaidh.com',
  supportPhone: '',
  defaultCurrency: 'IQD',
  taxRatePercent: 0,
  shippingFlat: 0,
  enableCheckout: true,
  showSolarCalculator: true,
  maintenanceMode: false,
  bannerMessage: '',
  extraAdminEmails: [],
  computerStaffEmails: [],
  solarStaffEmails: [],
  heroImage: '',
  solarBannerImage: '',
  logoImage: '',
  tiandyLogo: '',
  solarPriceColumns: DEFAULT_COLUMNS,
};

const SINGLETON_PATH = ['settings', 'site'] as const;
const LS_KEY = 'alwaidh.settings.v1';

function readLocal(): SiteSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SiteSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeLocal(s: SiteSettings): void {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY }));
  } catch {
    /* ignore */
  }
}

function normalize(data: Record<string, unknown>): SiteSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    extraAdminEmails: Array.isArray(data.extraAdminEmails)
      ? (data.extraAdminEmails as string[]).map((e) => String(e).toLowerCase())
      : DEFAULT_SETTINGS.extraAdminEmails,
    computerStaffEmails: Array.isArray(data.computerStaffEmails)
      ? (data.computerStaffEmails as string[]).map((e) => String(e).toLowerCase())
      : DEFAULT_SETTINGS.computerStaffEmails,
    solarStaffEmails: Array.isArray(data.solarStaffEmails)
      ? (data.solarStaffEmails as string[]).map((e) => String(e).toLowerCase())
      : DEFAULT_SETTINGS.solarStaffEmails,
    solarPriceColumns:
      Array.isArray(data.solarPriceColumns) && data.solarPriceColumns.length
        ? (data.solarPriceColumns as PriceColumn[])
        : DEFAULT_SETTINGS.solarPriceColumns,
  } as SiteSettings;
}

export async function loadSettings(): Promise<SiteSettings> {
  const database = db;
  if (database) {
    const snap = await getDoc(doc(database, SINGLETON_PATH[0], SINGLETON_PATH[1]));
    if (!snap.exists()) return DEFAULT_SETTINGS;
    return normalize(snap.data() as Record<string, unknown>);
  }
  return readLocal();
}

export function subscribeSettings(cb: (s: SiteSettings) => void): () => void {
  const database = db;
  if (database) {
    return onSnapshot(doc(database, SINGLETON_PATH[0], SINGLETON_PATH[1]), (snap) => {
      cb(snap.exists() ? normalize(snap.data() as Record<string, unknown>) : DEFAULT_SETTINGS);
    });
  }
  cb(readLocal());
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) cb(readLocal());
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** Update a single settings field without touching the others. */
export async function updateSettingsField<K extends keyof SiteSettings>(
  key: K,
  value: SiteSettings[K],
): Promise<void> {
  const database = db;
  if (database) {
    await setDoc(
      doc(database, SINGLETON_PATH[0], SINGLETON_PATH[1]),
      { [key]: value },
      { merge: true },
    );
    return;
  }
  writeLocal({ ...readLocal(), [key]: value });
}

export async function saveSettings(s: SiteSettings): Promise<void> {
  const database = db;
  const cleanEmails = (list: string[]) =>
    list.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const normalized: SiteSettings = {
    ...s,
    extraAdminEmails: cleanEmails(s.extraAdminEmails),
    computerStaffEmails: cleanEmails(s.computerStaffEmails),
    solarStaffEmails: cleanEmails(s.solarStaffEmails),
  };
  if (database) {
    await setDoc(doc(database, SINGLETON_PATH[0], SINGLETON_PATH[1]), normalized, { merge: true });
    return;
  }
  writeLocal(normalized);
}
