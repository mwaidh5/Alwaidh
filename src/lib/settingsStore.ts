import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

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
}

export const DEFAULT_SETTINGS: SiteSettings = {
  storeName: 'Alwaidh',
  contactEmail: 'hello@alwaidh.com',
  supportPhone: '',
  defaultCurrency: 'USD',
  taxRatePercent: 0,
  shippingFlat: 0,
  enableCheckout: true,
  showSolarCalculator: true,
  maintenanceMode: false,
  bannerMessage: '',
  extraAdminEmails: [],
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

export async function saveSettings(s: SiteSettings): Promise<void> {
  const database = db;
  const normalized: SiteSettings = {
    ...s,
    extraAdminEmails: s.extraAdminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
  };
  if (database) {
    await setDoc(doc(database, SINGLETON_PATH[0], SINGLETON_PATH[1]), normalized, { merge: true });
    return;
  }
  writeLocal(normalized);
}
