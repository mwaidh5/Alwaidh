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

export interface SolarProject {
  id: string;
  title: string;
  location: string;
  size: string;
  blurb: string;
  image: string;
  order: number;
}

const COLLECTION = 'solarProjects';
const LS_KEY = 'alwaidh.solarProjects.v1';
const LS_SEEDED = 'alwaidh.solarProjects.seeded.v1';

const SEED: Omit<SolarProject, 'id'>[] = [
  {
    title: 'Rooftop Home Solar',
    location: 'Residential villa',
    size: '6 kW · 12 panels',
    blurb:
      'A grid-tied rooftop system that covers most of a family home’s daytime usage and cuts the monthly bill significantly.',
    image:
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1000&q=80',
    order: 0,
  },
  {
    title: 'Off-Grid Battery System',
    location: 'Remote site',
    size: '10 kW · 20 kWh storage',
    blurb:
      'Panels paired with a LiFePO4 battery bank to keep a site running around the clock with no mains connection.',
    image:
      'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1000&q=80',
    order: 1,
  },
  {
    title: 'Commercial Solar Array',
    location: 'Warehouse roof',
    size: '50 kW · 96 panels',
    blurb:
      'A large rooftop array that offsets daytime industrial load and pays back through lower running costs.',
    image:
      'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1000&q=80',
    order: 2,
  },
  {
    title: 'Hybrid Inverter Upgrade',
    location: 'Small business',
    size: '5 kW hybrid inverter',
    blurb:
      'An existing system upgraded with a hybrid inverter and battery so power continues through outages.',
    image:
      'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=1000&q=80',
    order: 3,
  },
];

/** Sample projects with ids — used as a fallback before the collection is seeded. */
export const SEED_PROJECTS: SolarProject[] = SEED.map((p, i) => ({ ...p, id: `sample-${i}` }));

function readLocal(): SolarProject[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SolarProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: SolarProject[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY }));
  } catch {
    /* ignore */
  }
}

function normalize(data: Record<string, unknown>, id: string): SolarProject {
  return {
    id,
    title: String(data.title ?? ''),
    location: String(data.location ?? ''),
    size: String(data.size ?? ''),
    blurb: String(data.blurb ?? ''),
    image: String(data.image ?? ''),
    order: Number(data.order ?? 0),
  };
}

function sortProjects(list: SolarProject[]): SolarProject[] {
  return list.slice().sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
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

export async function listSolarProjects(): Promise<SolarProject[]> {
  const database = db;
  await seedIfEmpty(database);
  if (database) {
    const snap = await getDocs(query(collection(database, COLLECTION), orderBy('order', 'asc')));
    return snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id));
  }
  return sortProjects(readLocal());
}

export function subscribeSolarProjects(cb: (list: SolarProject[]) => void): () => void {
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
  listSolarProjects().then(cb);
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) listSolarProjects().then(cb);
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export async function createSolarProject(input: Omit<SolarProject, 'id'>): Promise<void> {
  const database = db;
  if (database) {
    await addDoc(collection(database, COLLECTION), { ...input, createdAt: serverTimestamp() });
    return;
  }
  const list = readLocal();
  list.push({ ...input, id: `local-${Date.now()}` });
  writeLocal(list);
}

export async function upsertSolarProject(project: SolarProject): Promise<void> {
  const database = db;
  if (database) {
    await setDoc(doc(database, COLLECTION, project.id), { ...project, updatedAt: serverTimestamp() });
    return;
  }
  const list = readLocal();
  const idx = list.findIndex((p) => p.id === project.id);
  if (idx >= 0) list[idx] = project;
  else list.push(project);
  writeLocal(list);
}

export async function deleteSolarProject(id: string): Promise<void> {
  const database = db;
  if (database) {
    await deleteDoc(doc(database, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((p) => p.id !== id));
}
