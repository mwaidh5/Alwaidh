import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';
import type { FirebaseStorage } from 'firebase/storage';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export interface UploadResult {
  url: string;
  path: string;
  /** The (normalized) file that was actually stored — lets callers reuse the
   *  bytes without re-downloading, e.g. for background removal. */
  file?: File;
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

const MAX_DIMENSION = 1600;
const COMPRESS_OVER_BYTES = 1_500_000;

function jpgName(original: string): string {
  return `${original.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
}

function isHeic(file: File): boolean {
  return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/**
 * Convert any photo (including iPhone HEIC/HEIF) to a resized JPEG so
 * uploads are small, fast, and always an accepted type. HEIC is decoded
 * with a bundled decoder — no reliance on the device's browser supporting
 * it — then everything large is resized via canvas. Images that are
 * already an allowed type and small pass through untouched.
 */
export async function normalizeImage(file: File): Promise<File> {
  let working: Blob = file;
  let workingType = file.type;

  if (isHeic(file)) {
    try {
      // Loaded on demand — only HEIC uploads pay for the decoder.
      const { default: heic2any } = await import('heic2any');
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      working = Array.isArray(out) ? out[0] : out;
      workingType = 'image/jpeg';
    } catch {
      // Fall through — some browsers (iOS Safari) can decode HEIC natively
      // in the <img> path below.
    }
  }

  if (ALLOWED.includes(workingType) && working.size <= COMPRESS_OVER_BYTES) {
    return working === file
      ? file
      : new File([working], jpgName(file.name), { type: 'image/jpeg' });
  }

  const objectUrl = URL.createObjectURL(working);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () =>
        reject(
          new Error(
            `This device could not read the image (${file.type || 'unknown type'}). Try a JPG or PNG.`,
          ),
        );
      i.src = objectUrl;
    });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process the image on this device.');
    ctx.drawImage(img, 0, 0, w, h);
    // JPEG has no transparency — re-encoding a cut-out (or any PNG/WEBP/GIF)
    // to JPEG would paint its transparent pixels black. Keep those as PNG.
    const keepAlpha = workingType !== 'image/jpeg';
    const outType = keepAlpha ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, keepAlpha ? undefined : 0.85),
    );
    if (!blob) throw new Error('Could not convert the image — try a JPG or PNG.');
    // PNG can't trade quality for size, so a very detailed cut-out may still
    // exceed the upload cap — shrink harder rather than reject it.
    let finalBlob = blob;
    if (keepAlpha && finalBlob.size > MAX_BYTES) {
      const s2 = Math.min(1, 1000 / Math.max(w, h));
      const c2 = document.createElement('canvas');
      c2.width = Math.max(1, Math.round(w * s2));
      c2.height = Math.max(1, Math.round(h * s2));
      const ctx2 = c2.getContext('2d');
      if (ctx2) {
        ctx2.drawImage(img, 0, 0, c2.width, c2.height);
        const smaller = await new Promise<Blob | null>((resolve) =>
          c2.toBlob(resolve, 'image/png'),
        );
        if (smaller && smaller.size < finalBlob.size) finalBlob = smaller;
      }
    }
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([finalBlob], `${base}.${keepAlpha ? 'png' : 'jpg'}`, { type: outType });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Turn opaque network failures ("Load failed") into actionable messages. */
function friendlyUploadError(e: unknown): Error {
  const raw = e instanceof Error ? e.message : String(e);
  if (/load failed|failed to fetch|network|retry-limit/i.test(raw)) {
    return new Error('Upload failed — network problem. Check your internet connection and try again.');
  }
  if (/unauthorized|permission/i.test(raw)) {
    return new Error('Upload was blocked by permissions. Make sure you are signed in with a verified staff/admin account.');
  }
  return e instanceof Error ? e : new Error(raw);
}

/** Upload an image into an arbitrary folder (e.g. "site", "projects"). */
export async function uploadImage(file: File, folder = 'site'): Promise<UploadResult> {
  const prepared = await normalizeImage(file);
  const store = validate(prepared);
  const safe = prepared.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60);
  const path = `${folder.replace(/\/+$/, '')}/${Date.now()}-${safe}`;
  const objectRef = ref(store, path);
  try {
    await uploadBytes(objectRef, prepared, { contentType: prepared.type });
    const url = await getDownloadURL(objectRef);
    return { url, path, file: prepared };
  } catch (e) {
    throw friendlyUploadError(e);
  }
}

export async function uploadProductImage(
  file: File,
  productId?: string,
): Promise<UploadResult> {
  const folder = productId ? `products/${productId}` : `products/_drafts/${crypto.randomUUID()}`;
  return uploadImage(file, folder);
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Upload a product document (datasheet or manual). PDFs always allowed;
 *  images too when `allowImages` is set (datasheets are often JPG scans). */
export async function uploadProductDoc(
  file: File,
  productId: string | undefined,
  allowImages: boolean,
): Promise<UploadResult> {
  if (!storage) {
    throw new Error('Firebase Storage is not configured. Add VITE_FIREBASE_* values to your .env.');
  }
  const isPdf = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !(allowImages && isImage)) {
    throw new Error(allowImages ? 'Please choose a PDF or an image.' : 'Please choose a PDF file.');
  }
  // Images go through the usual compressor; PDFs upload as-is.
  const folder = productId ? `products/${productId}` : `products/_drafts/${crypto.randomUUID()}`;
  if (isImage) return uploadImage(file, folder);
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
  }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);
  const path = `${folder}/${Date.now()}-${safe}`;
  const objectRef = ref(storage, path);
  try {
    await uploadBytes(objectRef, file, { contentType: 'application/pdf' });
    const url = await getDownloadURL(objectRef);
    return { url, path };
  } catch (e) {
    throw friendlyUploadError(e);
  }
}

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
