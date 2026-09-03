import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * The blog: articles written for people searching in Arabic for solar
 * power in Iraq (and in English too). Bodies are lightweight text — blank
 * lines split paragraphs, lines starting "## " become headings, lines
 * starting "- " become list items — rendered by BlogPost, so no markdown
 * dependency rides along.
 */
export type BlogTopic = 'solar' | 'cameras' | 'computers';
export const BLOG_TOPICS: BlogTopic[] = ['solar', 'cameras', 'computers'];

/** Older articles carry no topic; their slug and title say what they
 *  are about. */
export function guessTopic(slug: string, title: string): BlogTopic {
  const text = `${slug} ${title}`;
  if (/camera|cctv|nvr|tiandy|thermal|surveill/i.test(text)) return 'cameras';
  if (/laptop|lenovo|computer|desktop|printer/i.test(text)) return 'computers';
  return 'solar';
}

export interface BlogPost {
  id: string;
  /** The address: /blog/<slug>. Lowercase, dashes. */
  slug: string;
  title: string;
  titleAr: string;
  excerpt: string;
  excerptAr: string;
  body: string;
  bodyAr: string;
  cover: string;
  /** What the article is about - picks the call-to-action beneath it. */
  topic: BlogTopic;
  published: boolean;
  createdAtMs: number;
}

const COLLECTION = 'blogPosts';

function toMillis(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v instanceof Timestamp) return v.toMillis();
  return Date.now();
}

function normalize(data: Record<string, unknown>, id: string): BlogPost {
  return {
    id,
    slug: String(data.slug ?? id),
    title: String(data.title ?? ''),
    titleAr: String(data.titleAr ?? ''),
    excerpt: String(data.excerpt ?? ''),
    excerptAr: String(data.excerptAr ?? ''),
    body: String(data.body ?? ''),
    bodyAr: String(data.bodyAr ?? ''),
    cover: String(data.cover ?? ''),
    topic: BLOG_TOPICS.includes(data.topic as BlogTopic)
      ? (data.topic as BlogTopic)
      : guessTopic(String(data.slug ?? id), String(data.title ?? '')),
    published: Boolean(data.published ?? false),
    createdAtMs: toMillis(data.createdAt),
  };
}

/** Published articles, newest first — the public list. */
export async function listPublishedPosts(): Promise<BlogPost[]> {
  const database = db;
  if (!database) return [];
  const snap = await getDocs(
    query(collection(database, COLLECTION), where('published', '==', true)),
  );
  return snap.docs
    .map((d) => normalize(d.data() as Record<string, unknown>, d.id))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/** One article by its address. */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const database = db;
  if (!database) return null;
  const snap = await getDocs(
    query(
      collection(database, COLLECTION),
      where('published', '==', true),
      where('slug', '==', slug),
    ),
  );
  const d = snap.docs[0];
  return d ? normalize(d.data() as Record<string, unknown>, d.id) : null;
}

/** Everything, drafts included — the dashboard's live list. */
export function subscribeAllPosts(cb: (list: BlogPost[]) => void): () => void {
  const database = db;
  if (!database) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(database, COLLECTION), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id))),
    () => cb([]),
  );
}

export async function upsertPost(post: Omit<BlogPost, 'createdAtMs'> & { createdAtMs?: number }): Promise<void> {
  const database = db;
  if (!database) throw new Error('The blog needs a database connection.');
  const { id, createdAtMs, ...rest } = post;
  await setDoc(
    doc(database, COLLECTION, id),
    {
      ...rest,
      slug: rest.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
      ...(createdAtMs ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deletePost(id: string): Promise<void> {
  const database = db;
  if (!database) return;
  await deleteDoc(doc(database, COLLECTION, id));
}
