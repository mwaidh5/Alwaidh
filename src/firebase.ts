/**
 * Firebase client init.
 *
 * Fill in `.env` (see `.env.example`) with your Firebase config from the
 * Firebase Console > Project Settings > Web app. The values are exposed
 * to the browser via Vite's `import.meta.env.VITE_*` convention.
 *
 * Firestore and Auth imports below are commented out — uncomment when you
 * are ready to wire them up to your UI.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
// import { getFirestore, type Firestore } from 'firebase/firestore';
// import { getAuth, type Auth } from 'firebase/auth';
// import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const firebaseApp: FirebaseApp | null = hasFirebaseConfig
  ? initializeApp(firebaseConfig)
  : null;

// export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
// export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
// export const storage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;

export const firebaseReady = hasFirebaseConfig;
