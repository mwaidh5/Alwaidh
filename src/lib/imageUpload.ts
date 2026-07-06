import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';
import type { FirebaseStorage } from 'firebase/storage';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export interface UploadResult {
  url: string;
  path: string;
}

function validate(file: File): FirebaseStorage {
  if (!storage) {
    throw new Error('Firebase Storage is not configured. Add VITE_FIREBASE_* values to your .env.');
  }
  if (!ALLOWED.includes(file.type)) {
    throw new Error(`Unsupported file type (${file.type || 'unknown'}). Use JPG, PNG, WEBP, AVIF, or GIF.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
  }
  return storage;
}

/** Upload an image into an arbitrary folder (e.g. "site", "projects"). */
export async function uploadImage(file: File, folder = 'site'): Promise<UploadResult> {
  const store = validate(file);
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60);
  const path = `${folder.replace(/\/+$/, '')}/${Date.now()}-${safe}`;
  const objectRef = ref(store, path);
  await uploadBytes(objectRef, file, { contentType: file.type });
  const url = await getDownloadURL(objectRef);
  return { url, path };
}

export async function uploadProductImage(
  file: File,
  productId?: string,
): Promise<UploadResult> {
  const folder = productId ? `products/${productId}` : `products/_drafts/${crypto.randomUUID()}`;
  return uploadImage(file, folder);
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Upload a PDF invoice for a job. */
export async function uploadInvoice(file: File, jobId?: string): Promise<UploadResult> {
  if (!storage) {
    throw new Error('Firebase Storage is not configured. Add VITE_FIREBASE_* values to your .env.');
  }
  if (file.type !== 'application/pdf') {
    throw new Error('Please choose a PDF file.');
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
  }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);
  const folder = jobId ? `jobs/${jobId}` : `jobs/_drafts/${crypto.randomUUID()}`;
  const path = `${folder}/${Date.now()}-${safe}`;
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, file, { contentType: 'application/pdf' });
  const url = await getDownloadURL(objectRef);
  return { url, path };
}
