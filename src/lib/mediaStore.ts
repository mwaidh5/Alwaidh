import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  listAll,
  ref,
  updateMetadata,
  uploadBytes,
} from 'firebase/storage';
import { LONG_CACHE, replaceImageAt } from './imageUpload';
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
  // The untouched copy is no use once the picture itself is gone.
  await deleteObject(ref(storage, backupPathFor(path))).catch(() => undefined);
}

/**
 * Where the untouched copy of a picture is kept. Editing writes over the
 * original file — which is what keeps every product and banner pointing at
 * it — so the first edit tucks the original away here, and it stays put
 * however many times the picture is edited afterwards.
 *
 * The path is encoded whole, so it maps back exactly and can never collide
 * with another folder's file of the same name. `originals` is deliberately
 * not one of ROOTS: these copies don't belong in the library.
 */
const ORIGINALS = 'originals';

export function backupPathFor(path: string): string {
  return `${ORIGINALS}/${encodeURIComponent(path)}`;
}

/** Which pictures have an untouched copy on file — one listing, not one
 *  request per image. */
export async function listOriginalBackups(): Promise<Set<string>> {
  if (!storage) return new Set();
  try {
    const res = await listAll(ref(storage, ORIGINALS));
    return new Set(
      res.items.map((item) => {
        try {
          return decodeURIComponent(item.name);
        } catch {
          return item.name;
        }
      }),
    );
  } catch {
    // No folder yet, or listing refused — nothing to offer restoring.
    return new Set();
  }
}

/** Is there an untouched copy of this picture to go back to? */
export async function hasOriginalBackup(path: string): Promise<boolean> {
  if (!storage) return false;
  try {
    await getMetadata(ref(storage, backupPathFor(path)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Keep a copy of the picture as it stands, unless one is already kept.
 * Returns true if this call is what saved it.
 *
 * Only a genuine "it isn't there" counts as missing: if the check itself
 * fails (offline, say), we stop rather than risk overwriting a real
 * original with an already-edited version.
 */
export async function keepOriginalOnce(item: { path: string; url: string }): Promise<boolean> {
  const store = storage;
  if (!store) return false;
  const backup = ref(store, backupPathFor(item.path));
  try {
    await getMetadata(backup);
    return false; // already kept
  } catch (e) {
    if ((e as { code?: string })?.code !== 'storage/object-not-found') throw e;
  }
  const resp = await fetch(item.url, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`Could not read this image (error ${resp.status}).`);
  const blob = await resp.blob();
  await uploadBytes(backup, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: LONG_CACHE,
  });
  return true;
}

/**
 * Put the untouched copy back over the edited file. The address changes
 * (Storage mints a new token on every write), so the caller still has to
 * re-point whatever used the old one — the same as after an edit.
 */
export async function restoreOriginal(path: string): Promise<string> {
  const store = storage;
  if (!store) throw new Error('Firebase Storage is not configured.');
  const backupUrl = await getDownloadURL(ref(store, backupPathFor(path)));
  const resp = await fetch(backupUrl, { cache: 'no-store' });
  if (!resp.ok) throw new Error('Could not read the saved original.');
  const blob = await resp.blob();
  const name = path.split('/').pop() || 'original';
  const file = new File([blob], name, { type: blob.type || 'image/png' });
  const { url } = await replaceImageAt(path, file);
  return url;
}

/**
 * Give every file already in Storage the long cache life that new uploads
 * now get. Anything uploaded before that change is served as
 * `private, max-age=0`, so browsers re-fetch every picture on every page
 * view — the single biggest reason images feel slower than the rest of the
 * site. Runs over the whole library once; re-running is harmless.
 */
export async function refreshMediaCaching(
  onProgress?: (done: number, total: number) => void,
): Promise<{ updated: number; failed: number }> {
  const store = storage;
  if (!store) return { updated: 0, failed: 0 };
  const items = await listAllMedia();
  let updated = 0;
  let failed = 0;
  // A handful at a time: enough to be quick, gentle enough not to be
  // throttled halfway through a few hundred files.
  const BATCH = 8;
  for (let i = 0; i < items.length; i += BATCH) {
    await Promise.all(
      items.slice(i, i + BATCH).map(async (item) => {
        try {
          await updateMetadata(ref(store, item.path), { cacheControl: LONG_CACHE });
          updated++;
        } catch {
          failed++;
        }
      }),
    );
    onProgress?.(Math.min(i + BATCH, items.length), items.length);
  }
  return { updated, failed };
}
