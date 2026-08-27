import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_COLUMNS, type PriceColumn } from './solarPricesStore';

/** One full-width banner at the top of the homepage. */
export interface HeroSlide {
  image: string;
  /** Optional taller crop used on phones, where the banner is portrait. */
  mobileImage: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonLink: string;
  /** Arabic wording for the same banner; empty falls back to the
      English run through the dictionary. */
  eyebrowAr: string;
  titleAr: string;
  subtitleAr: string;
  buttonLabelAr: string;
  /** Colour of the wording over the photo. */
  textColor: string;
  buttonBg: string;
  buttonText: string;
  /** 0–90: how much the photo is darkened so words stay readable. */
  overlay: number;
}

/** Colours every banner starts with — white text, brand-blue button. */
export const HERO_DEFAULT_COLORS = {
  textColor: '#ffffff',
  buttonBg: '#2563eb',
  buttonText: '#ffffff',
  overlay: 45,
};

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    image: '',
    mobileImage: '',
    eyebrow: 'New arrivals',
    title: 'Laptops built for real work',
    subtitle:
      'Business machines, workstations and accessories — spec’d properly, warrantied locally, and in stock today.',
    buttonLabel: 'Shop computers',
    buttonLink: '/shop?category=computers',
    eyebrowAr: 'وصل حديثاً',
    titleAr: 'حاسبات مصنوعة للعمل الجاد',
    subtitleAr: 'أجهزة أعمال ومحطات عمل وملحقات — بمواصفات مضبوطة وضمان محلي ومتوفرة اليوم.',
    buttonLabelAr: 'تسوّق الحاسبات',
    ...HERO_DEFAULT_COLORS,
  },
  {
    image: '',
    mobileImage: '',
    eyebrow: 'Clean energy',
    title: 'Cut your power bill for good',
    subtitle:
      'Panels, inverters and batteries sized for your home or shop. Free site survey, installed by our own crew.',
    buttonLabel: 'Get a free solar quote',
    buttonLink: '#quote',
    eyebrowAr: 'طاقة نظيفة',
    titleAr: 'ودّع فاتورة الكهرباء',
    subtitleAr: 'ألواح وإنفرترات وبطاريات بحجم يناسب بيتك أو محلك. كشف موقعي مجاني وتركيب بفريقنا.',
    buttonLabelAr: 'اطلب عرض سعر مجاني',
    ...HERO_DEFAULT_COLORS,
  },
  {
    image: '',
    mobileImage: '',
    eyebrow: 'Surveillance',
    title: 'Tiandy cameras, properly installed',
    subtitle: 'IP cameras, NVRs and full-site coverage from an authorised Tiandy reseller.',
    buttonLabel: 'Shop cameras',
    buttonLink: '/shop?category=tiandy-cameras',
    eyebrowAr: 'مراقبة',
    titleAr: 'كاميرات Tiandy بتركيب صحيح',
    subtitleAr: 'كاميرات IP وأجهزة NVR وتغطية كاملة من موزّع معتمد لتياندي.',
    buttonLabelAr: 'تسوّق الكاميرات',
    ...HERO_DEFAULT_COLORS,
  },
];

/** One of the smaller tiles under the main banner. */
export interface PromoTile {
  image: string;
  /** Shown in a white chip pinned to the photo's top corner. */
  logo: string;
  /** The one large card on the homepage; the rest become split rows. */
  big?: boolean;
  title: string;
  buttonLabel: string;
  buttonLink: string;
  textColor: string;
  buttonBg: string;
  buttonText: string;
  overlay: number;
}

export const DEFAULT_PROMO_TILES: PromoTile[] = [
  {
    image: '',
    logo: '',
    title: 'Computers',
    buttonLabel: 'Explore now',
    buttonLink: '/shop?category=computers',
    ...HERO_DEFAULT_COLORS,
    overlay: 25,
  },
  {
    image: '',
    logo: '',
    title: 'Solar Energy',
    buttonLabel: 'Explore now',
    buttonLink: '/shop?category=solar',
    ...HERO_DEFAULT_COLORS,
    overlay: 25,
  },
  {
    image: '',
    logo: '',
    title: 'Tiandy Cameras',
    buttonLabel: 'Explore now',
    buttonLink: '/shop?category=tiandy-cameras',
    ...HERO_DEFAULT_COLORS,
    overlay: 25,
  },
];

/** A brand shown in the homepage strip. */
export interface BrandLogo {
  name: string;
  image: string;
}

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
  /** Shop managers: the whole product catalogue, but nothing to do with
   *  solar jobs or prices. */
  shopManagerEmails: string[];
  /** Field installers: they only see the jobs assigned to them. */
  installerEmails: string[];
  /** Names the admin wrote for people: email -> display name. Wins
      everywhere a person is shown. */
  staffNames: Record<string, string>;
  /** Installer team leads: leader email -> the installers under them. */
  installerLeaders: Record<string, string[]>;
  /** Who may open the CRM's solar contacts book. Admins always can. */
  crmSolarEmails: string[];
  /** Who may open the CRM's computers contacts book. Admins always can. */
  crmComputerEmails: string[];
  heroImage: string;
  solarBannerImage: string;
  logoImage: string;
  tiandyLogo: string;
  /** Logo shown on each homepage category tile, keyed by category slug. */
  categoryLogos: Record<string, string>;
  /** SolarMax logo shown in the homepage solar section. */
  solarLogo: string;
  /** Logos of the brands we deal with, keyed by brand slug. */
  brandLogos: Record<string, string>;
  /** Full-width banners at the top of the homepage. */
  heroSlides: HeroSlide[];
  /** The smaller tiles under the main banner. */
  promoTiles: PromoTile[];
  /** Brands in the homepage strip — added and removed here, in this order.
   *  Empty means fall back to the built-in list (see data/brands.ts). */
  brands: BrandLogo[];
  /** Sub-categories staff can pick from, keyed by main category slug. */
  subcategories: Record<string, string[]>;
  solarPriceColumns: PriceColumn[];
  /** The three About-page identity photos, keyed computers/solar/cameras. */
  aboutImages: Record<string, string>;
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
  shopManagerEmails: [],
  installerEmails: [],
  installerLeaders: {},
  crmSolarEmails: [],
  crmComputerEmails: [],
  staffNames: {},
  heroImage: '',
  solarBannerImage: '',
  logoImage: '',
  tiandyLogo: '',
  categoryLogos: {},
  solarLogo: '',
  brandLogos: {},
  subcategories: {},
  heroSlides: DEFAULT_HERO_SLIDES,
  promoTiles: DEFAULT_PROMO_TILES,
  brands: [],
  solarPriceColumns: DEFAULT_COLUMNS,
  aboutImages: {},
};

const SINGLETON_PATH = ['settings', 'site'] as const;
const LS_KEY = 'alwaidh.settings.v1';
/** Last settings seen from the server, so a reload paints the real logo and
 *  banners immediately instead of flashing the built-in defaults. */
const CACHE_KEY = 'alwaidh.settings.cache.v1';

export function cachedSettings(): SiteSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SiteSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function cache(s: SiteSettings): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* private mode — just means no head start next time */
  }
}

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
    shopManagerEmails: Array.isArray(data.shopManagerEmails)
      ? (data.shopManagerEmails as string[]).map((e) => String(e).toLowerCase())
      : DEFAULT_SETTINGS.shopManagerEmails,
    installerEmails: Array.isArray(data.installerEmails)
      ? (data.installerEmails as string[]).map((e) => String(e).toLowerCase())
      : DEFAULT_SETTINGS.installerEmails,
    crmSolarEmails: Array.isArray(data.crmSolarEmails)
      ? (data.crmSolarEmails as string[]).map((e) => String(e).toLowerCase())
      : DEFAULT_SETTINGS.crmSolarEmails,
    crmComputerEmails: Array.isArray(data.crmComputerEmails)
      ? (data.crmComputerEmails as string[]).map((e) => String(e).toLowerCase())
      : DEFAULT_SETTINGS.crmComputerEmails,
    installerLeaders:
      data.installerLeaders && typeof data.installerLeaders === 'object'
        ? Object.fromEntries(
            Object.entries(data.installerLeaders as Record<string, unknown>).map(([k, v]) => [
              k.toLowerCase(),
              Array.isArray(v) ? v.map((e) => String(e).toLowerCase()) : [],
            ]),
          )
        : DEFAULT_SETTINGS.installerLeaders,
    staffNames:
      data.staffNames && typeof data.staffNames === 'object'
        ? Object.fromEntries(
            Object.entries(data.staffNames as Record<string, unknown>).map(([k, v]) => [
              k.toLowerCase(),
              String(v ?? '').trim(),
            ]),
          )
        : DEFAULT_SETTINGS.staffNames,
    categoryLogos:
      data.categoryLogos && typeof data.categoryLogos === 'object'
        ? (data.categoryLogos as Record<string, string>)
        : DEFAULT_SETTINGS.categoryLogos,
    brandLogos:
      data.brandLogos && typeof data.brandLogos === 'object'
        ? (data.brandLogos as Record<string, string>)
        : DEFAULT_SETTINGS.brandLogos,
    subcategories:
      data.subcategories && typeof data.subcategories === 'object'
        ? (data.subcategories as Record<string, string[]>)
        : DEFAULT_SETTINGS.subcategories,
    aboutImages:
      data.aboutImages && typeof data.aboutImages === 'object'
        ? (data.aboutImages as Record<string, string>)
        : DEFAULT_SETTINGS.aboutImages,
    heroSlides: Array.isArray(data.heroSlides)
      ? (data.heroSlides as Record<string, unknown>[]).map((h) => ({
          image: String(h.image ?? ''),
          mobileImage: String(h.mobileImage ?? ''),
          eyebrow: String(h.eyebrow ?? ''),
          title: String(h.title ?? ''),
          subtitle: String(h.subtitle ?? ''),
          buttonLabel: String(h.buttonLabel ?? ''),
          buttonLink: String(h.buttonLink ?? ''),
          eyebrowAr: String(h.eyebrowAr ?? ''),
          titleAr: String(h.titleAr ?? ''),
          subtitleAr: String(h.subtitleAr ?? ''),
          buttonLabelAr: String(h.buttonLabelAr ?? ''),
          textColor: String(h.textColor ?? HERO_DEFAULT_COLORS.textColor),
          buttonBg: String(h.buttonBg ?? HERO_DEFAULT_COLORS.buttonBg),
          buttonText: String(h.buttonText ?? HERO_DEFAULT_COLORS.buttonText),
          overlay: Number.isFinite(Number(h.overlay))
            ? Number(h.overlay)
            : HERO_DEFAULT_COLORS.overlay,
        }))
      : DEFAULT_SETTINGS.heroSlides,
    promoTiles: Array.isArray(data.promoTiles)
      ? (data.promoTiles as Record<string, unknown>[]).map((tile) => ({
          image: String(tile.image ?? ''),
          logo: String(tile.logo ?? ''),
          big: Boolean(tile.big ?? false),
          title: String(tile.title ?? ''),
          buttonLabel: String(tile.buttonLabel ?? ''),
          buttonLink: String(tile.buttonLink ?? ''),
          textColor: String(tile.textColor ?? HERO_DEFAULT_COLORS.textColor),
          buttonBg: String(tile.buttonBg ?? HERO_DEFAULT_COLORS.buttonBg),
          buttonText: String(tile.buttonText ?? HERO_DEFAULT_COLORS.buttonText),
          overlay: Number.isFinite(Number(tile.overlay)) ? Number(tile.overlay) : 25,
        }))
      : DEFAULT_SETTINGS.promoTiles,
    brands: Array.isArray(data.brands)
      ? (data.brands as Record<string, unknown>[])
          .map((b) => ({ name: String(b.name ?? ''), image: String(b.image ?? '') }))
          .filter((b) => b.name || b.image)
      : DEFAULT_SETTINGS.brands,
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
      const next = snap.exists() ? normalize(snap.data() as Record<string, unknown>) : DEFAULT_SETTINGS;
      cache(next);
      cb(next);
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
    shopManagerEmails: cleanEmails(s.shopManagerEmails),
    installerEmails: cleanEmails(s.installerEmails),
    crmSolarEmails: cleanEmails(s.crmSolarEmails ?? []),
    crmComputerEmails: cleanEmails(s.crmComputerEmails ?? []),
    installerLeaders: Object.fromEntries(
      Object.entries(s.installerLeaders ?? {})
        .map(([k, v]) => [k.trim().toLowerCase(), cleanEmails(v)] as [string, string[]])
        .filter(([, v]) => v.length > 0),
    ),
    staffNames: Object.fromEntries(
      Object.entries(s.staffNames ?? {})
        .map(([k, v]) => [k.trim().toLowerCase(), String(v).trim()] as [string, string])
        .filter(([k, v]) => k && v),
    ),
  };
  if (database) {
    await setDoc(doc(database, SINGLETON_PATH[0], SINGLETON_PATH[1]), normalized, { merge: true });
    return;
  }
  writeLocal(normalized);
}
