import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, firebaseReady, googleProvider, isAdminEmail } from '../firebase';
import { recordUserLogin } from '../lib/userStore';
import { subscribeSettings, type SiteSettings } from '../lib/settingsStore';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  configured: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(auth));
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => subscribeSettings(setSettings), []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u && u.email) {
        recordUserLogin({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
        }).catch(() => {
          /* non-fatal */
        });
      }
    });
    return () => unsub();
  }, []);

  const isAdmin = useMemo(() => {
    const email = user?.email ?? null;
    if (isAdminEmail(email)) return true;
    if (!email) return false;
    return (settings?.extraAdminEmails ?? []).includes(email.toLowerCase());
  }, [user, settings]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin,
      configured: firebaseReady && auth !== null,
      async signInWithGoogle() {
        if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to your .env.');
        await signInWithPopup(auth, googleProvider);
      },
      async signInWithEmail(email: string, password: string) {
        if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to your .env.');
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signUpWithEmail(email: string, password: string, displayName?: string) {
        if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to your .env.');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName && cred.user) {
          await updateProfile(cred.user, { displayName });
        }
      },
      async sendPasswordReset(email: string) {
        if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to your .env.');
        await sendPasswordResetEmail(auth, email);
      },
      async signOut() {
        if (!auth) return;
        await fbSignOut(auth);
      },
    }),
    [user, loading, isAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
