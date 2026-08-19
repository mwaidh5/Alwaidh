import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { LONG_CACHE } from './imageUpload';

/**
 * The team's shelf of documents — catalogues, price lists, warranty terms.
 * The file itself lives in Storage; this record is what makes it findable,
 * and what the rules use to keep the shelf staff-only.
 */
export interface LibraryFile {
  id: string;
  name: string;        // what staff called it, not the raw filename
  fileName: string;
  url: string;
  path: string;        // Storage path, so the file can be removed with it
  size: number;
  contentType: string;
  note: string;
  by: string;          // who uploaded it
  createdAt: number;
}

const COLLECTION = 'library';
const FOLDER = 'library';
const MAX_BYTES = 25 * 1024 * 1024;

function normalize(data: Record<string, unknown>, id: string): LibraryFile {
  const c = data.createdAt;
  return {
    id,
    name: String(data.name ?? data.fileName ?? 'Untitled'),
    fileName: String(data.fileName ?? ''),
    url: String(data.url ?? ''),
    path: String(data.path ?? ''),
    size: Number(data.size ?? 0),
    contentType: String(data.contentType ?? ''),
    note: String(data.note ?? ''),
    by: String(data.by ?? ''),
    createdAt:
      c instanceof Timestamp ? c.toMillis() : typeof c === 'number' ? c : Date.now(),
  };
}

/** Live list of everything on the shelf, newest first. */
export function subscribeLibrary(
  cb: (list: LibraryFile[]) => void,
  onError?: (message: string) => void,
): () => void {
  const database = db;
  if (!database) {
    cb([]);
    return () => undefined;
  }
  return onSnapshot(
    query(collection(database, COLLECTION)),
    (snap) => {
      cb(
        snap.docs
          .map((d) => normalize(d.data() as Record<string, unknown>, d.id))
          // Sorted here rather than in the query: a brand-new upload has no
          // server timestamp yet, and ordering on it would hide the file
          // until the write comes back.
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    },
    (err) => onError?.(err instanceof Error ? err.message : 'Could not load the files.'),
  );
}

export async function uploadLibraryFile(input: {
  file: File;
  name?: string;
  note?: string;
}): Promise<void> {
  const database = db;
  if (!database || !storage) {
    throw new Error('Firebase is not configured.');
  }
  const email = auth?.currentUser?.email ?? '';
  if (!email) throw new Error('Please sign in again before uploading.');
  if (input.file.size > MAX_BYTES) {
    throw new Error(
      `File too large (${(input.file.size / 1024 / 1024).toFixed(1)} MB). Max 25 MB.`,
    );
  }
  const safe = input.file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);
  const path = `${FOLDER}/${Date.now()}-${safe}`;
  const objectRef = ref(storage, path);
  try {
    await uploadBytes(objectRef, input.file, {
      contentType: input.file.type || 'application/octet-stream',
      cacheControl: LONG_CACHE,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (/unauthorized|permission/i.test(raw)) {
      throw new Error('Upload was blocked — make sure your staff account is verified.');
    }
    if (/load failed|failed to fetch|network|retry-limit/i.test(raw)) {
      throw new Error('Upload failed — check your internet connection and try again.');
    }
    throw e instanceof Error ? e : new Error(raw);
  }
  const url = await getDownloadURL(objectRef);
  await addDoc(collection(database, COLLECTION), {
    name: (input.name ?? '').trim() || input.file.name,
    fileName: input.file.name,
    url,
    path,
    size: input.file.size,
    contentType: input.file.type || 'application/octet-stream',
    note: (input.note ?? '').trim(),
    by: email,
    createdAt: serverTimestamp(),
  });
}

/**
 * Take a file off the shelf. The record goes first: if the stored file is
 * already gone (or this account may not touch it), the entry still
 * disappears instead of being left pointing at nothing.
 */
export async function deleteLibraryFile(item: LibraryFile): Promise<void> {
  const database = db;
  if (!database) throw new Error('Firebase is not configured.');
  await deleteDoc(doc(database, COLLECTION, item.id));
  if (storage && item.path) {
    await deleteObject(ref(storage, item.path)).catch(() => undefined);
  }
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function isPdf(item: { contentType: string; fileName: string }): boolean {
  return item.contentType === 'application/pdf' || /\.pdf$/i.test(item.fileName);
}
