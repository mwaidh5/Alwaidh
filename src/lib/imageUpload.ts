import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export interface UploadResult {
  url: string;
  path: string;
}

export async function uploadProductImage(
  file: File,
  productId?: string,
): Promise<UploadResult> {
  if (!storage) {
    throw new Error('Firebase Storage is not configured. Add VITE_FIREBASE_* values to your .env.');
  }
  if (!ALLOWED.includes(file.type)) {
    throw new Error(`Unsupported file type (${file.type || 'unknown'}). Use JPG, PNG, WEBP, AVIF, or GIF.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
  }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60);
  const folder = productId ? `products/${productId}` : `products/_drafts/${crypto.randomUUID()}`;
  const path = `${folder}/${Date.now()}-${safe}`;
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, file, { contentType: file.type });
  const url = await getDownloadURL(objectRef);
  return { url, path };
}
