import { deleteObject, getDownloadURL, listAll, ref } from 'firebase/storage';
import { storage } from '../firebase';

export interface MediaItem {
  path: string;
  url: string;
  name: string;
}

// Top-level folders we store images in.
const ROOTS = ['products', 'site', 'projects'];

async function listFolder(prefix: string): Promise<MediaItem[]> {
  if (!storage) return [];
  const res = await listAll(ref(storage, prefix));
  const items: MediaItem[] = [];
  for (const item of res.items) {
    try {
      const url = await getDownloadURL(item);
      items.push({ path: item.fullPath, url, name: item.name });
    } catch {
      /* skip unreadable item */
    }
  }
  for (const sub of res.prefixes) {
    items.push(...(await listFolder(sub.fullPath)));
  }
  return items;
}

export async function listAllMedia(): Promise<MediaItem[]> {
  if (!storage) return [];
  const all = (await Promise.all(ROOTS.map((r) => listFolder(r).catch(() => [])))).flat();
  // Newest first — our upload paths are prefixed with a timestamp.
  return all.sort((a, b) => b.name.localeCompare(a.name));
}

export async function deleteMedia(path: string): Promise<void> {
  if (!storage) return;
  await deleteObject(ref(storage, path));
}
