import { deleteObject, listAll, ref } from 'firebase/storage';
import { storage } from '../firebase';

export interface MediaItem {
  path: string;
  url: string;
  name: string;
}

// Top-level folders we store images in.
const ROOTS = ['products', 'site', 'projects'];

const LIST_TIMEOUT_MS = 25_000;

/**
 * Public download URL built straight from the object path. The bucket allows
 * public reads (see storage.rules), so we don't need a getDownloadURL round
 * trip per file — that used to make this page take minutes with a few
 * hundred images.
 */
function publicUrl(bucket: string, fullPath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
    fullPath,
  )}?alt=media`;
}

/**
 * Storage path behind a download URL, e.g.
 * ".../o/products%2Fabc%2F1-x.jpg?alt=media&token=…" → "products/abc/1-x.jpg".
 * Returns null for links that don't point at our bucket (e.g. Unsplash), and
 * ignores the token so links saved at different times still match.
 */
export function storagePathFromUrl(url: string): string | null {
  const match = /\/o\/([^?]+)/.exec(url ?? '');
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Collect every file under `prefix`, walking subfolders in parallel. */
async function walk(prefix: string, bucket: string, out: MediaItem[]): Promise<void> {
  if (!storage) return;
  const res = await listAll(ref(storage, prefix));
  for (const item of res.items) {
    out.push({ path: item.fullPath, url: publicUrl(bucket, item.fullPath), name: item.name });
  }
  await Promise.all(res.prefixes.map((sub) => walk(sub.fullPath, bucket, out)));
}

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function listAllMedia(): Promise<MediaItem[]> {
  if (!storage) return [];
  const bucket = ref(storage, ROOTS[0]).bucket;
  const items: MediaItem[] = [];
  const failures: unknown[] = [];

  await withTimeout(
    Promise.all(
      ROOTS.map((root) =>
        walk(root, bucket, items).catch((e) => {
          // A missing folder is normal; remember real failures instead.
          failures.push(e);
        }),
      ),
    ),
    LIST_TIMEOUT_MS,
    'Loading the media library timed out. Your network (or an antivirus/ad-blocker extension) may be blocking Firebase Storage — the images themselves still work.',
  );

  // Every root failed and nothing came back: surface the real reason rather
  // than pretending the library is empty.
  if (items.length === 0 && failures.length === ROOTS.length) {
    const first = failures[0];
    const raw = first instanceof Error ? first.message : String(first);
    throw new Error(
      /unauthorized|permission/i.test(raw)
        ? 'Not allowed to list the media library. Sign in with a verified admin account.'
        : `Could not load the media library (${raw}). An antivirus or browser extension may be blocking Firebase Storage.`,
    );
  }

  // Newest first — our upload paths are prefixed with a timestamp.
  return items.sort((a, b) => b.name.localeCompare(a.name));
}

export async function deleteMedia(path: string): Promise<void> {
  if (!storage) return;
  await deleteObject(ref(storage, path));
}
