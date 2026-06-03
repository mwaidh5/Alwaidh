import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Firebase web config. These keys are public by design (they ship in the
// client bundle), so committing them is safe; security is enforced by the
// Firestore/Storage rules and the admin-email gate below. Env vars override
// these defaults when present (e.g. for a separate staging project).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAvnrI9n3-3Rhx9omxO3W9YF-IHPJWrIKM',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'alwaidh-baeb5.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'alwaidh-baeb5',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'alwaidh-baeb5.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '387647473445',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:387647473445:web:2dfbddbf6b5b97de063ccc',
};

const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const firebaseApp: FirebaseApp | null = hasFirebaseConfig
  ? initializeApp(firebaseConfig)
  : null;

export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const storage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;
export const googleProvider = new GoogleAuthProvider();

export const firebaseReady = hasFirebaseConfig;

export const ADMIN_EMAILS: string[] = ['mwaidh5@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
