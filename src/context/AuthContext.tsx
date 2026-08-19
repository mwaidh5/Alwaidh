import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, firebaseReady, googleProvider, isAdminEmail } from '../firebase';

/** True when running inside the Capacitor native app. */
function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}
import { recordUserLogin } from '../lib/userStore';
import { subscribeSettings, type SiteSettings } from '../lib/settingsStore';

/** Where the "view as" preview is remembered — this tab only. */
const VIEW_AS_KEY = 'alwaidh.viewAs.v1';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isComputerStaff: boolean; // admin OR listed as computer staff
  isSolarStaff: boolean; // admin OR listed as solar staff
  isShopManager: boolean; // the whole shop catalogue, but no solar jobs
  isInstaller: boolean; // field installer: only their assigned jobs
  hasAdminAccess: boolean; // any role that can open the dashboard
  /** Colleague whose view is being previewed, or null. */
  viewAs: string | null;
  /** True when this account is really an admin, preview or not. */
  realIsAdmin: boolean;
  setViewAsEmail: (email: string | null) => void;
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
    // Complete any pending redirect sign-in (used when popups are blocked).
    getRedirectResult(auth).catch(() => {
      /* no pending redirect, or it failed — onAuthStateChanged still governs */
    });
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Firebase caches the ID token for up to an hour, so a user who just
        // verified their email still carries email_verified:false in the token
        // the security rules read. Refresh profile + token on every load so the
        // claims match reality.
        try {
          await u.reload();
          await u.getIdToken(true);
        } catch {
          /* offline or token revoked — fall through with what we have */
        }
      }
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

  const email = user?.email?.toLowerCase() ?? null;

  const realIsAdmin = useMemo(() => {
    if (isAdminEmail(email)) return true;
    if (!email) return false;
    return (settings?.extraAdminEmails ?? []).includes(email);
  }, [email, settings]);

  // "View as": an admin can preview the dashboard through a colleague's
  // eyes. It only changes what this screen shows — every write is still
  // made, and recorded, as the admin themselves.
  const [viewAsEmail, setViewAs] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(VIEW_AS_KEY);
    } catch {
      return null;
    }
  });
  const viewAs = realIsAdmin ? viewAsEmail : null;

  const setViewAsEmail = (next: string | null) => {
    try {
      if (next) sessionStorage.setItem(VIEW_AS_KEY, next.toLowerCase());
      else sessionStorage.removeItem(VIEW_AS_KEY);
    } catch {
      /* private mode — the preview just won't survive a reload */
    }
    setViewAs(next ? next.toLowerCase() : null);
  };

  /** Whose roles the dashboard should reflect right now. */
  const shownEmail = viewAs ?? email;
  const listed = (list: string[] | undefined) => !!shownEmail && (list ?? []).includes(shownEmail);

  const isAdmin = viewAs
    ? isAdminEmail(shownEmail) || listed(settings?.extraAdminEmails)
    : realIsAdmin;

  const isComputerStaff = useMemo(
    () => isAdmin || listed(settings?.computerStaffEmails),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, shownEmail, settings],
  );

  const isSolarStaff = useMemo(
    () => isAdmin || listed(settings?.solarStaffEmails),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, shownEmail, settings],
  );

  // Shop manager: every product category, and nothing from the solar side.
  const isShopManager = useMemo(
    () => isAdmin || listed(settings?.shopManagerEmails),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, shownEmail, settings],
  );

  const isInstaller = useMemo(
    () => listed(settings?.installerEmails),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shownEmail, settings],
  );

  // The real admin never loses their way back out of a preview.
  const hasAdminAccess =
    realIsAdmin || isComputerStaff || isSolarStaff || isShopManager || isInstaller;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin,
      isComputerStaff,
      isSolarStaff,
      isShopManager,
      isInstaller,
      hasAdminAccess,
      viewAs,
      realIsAdmin,
      setViewAsEmail,
      configured: firebaseReady && auth !== null,
      async signInWithGoogle() {
        if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to your .env.');
        // Native app: Google blocks OAuth inside embedded webviews, so use the
        // OS-level Google sign-in and hand its credential to Firebase.
        if (isNativeApp()) {
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          const result = await FirebaseAuthentication.signInWithGoogle();
          const idToken = result.credential?.idToken;
          if (!idToken) throw new Error('Google sign-in did not return a credential. Please try again.');
          const credential = GoogleAuthProvider.credential(idToken, result.credential?.nonce);
          await signInWithCredential(auth, credential);
          return;
        }
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (e) {
          // Some browsers block popups — fall back to a full-page redirect,
          // which onAuthStateChanged completes on return.
          const code = (e as { code?: string })?.code ?? '';
          if (
            code === 'auth/popup-blocked' ||
            code === 'auth/cancelled-popup-request' ||
            code === 'auth/popup-closed-by-user' ||
            code === 'auth/operation-not-supported-in-this-environment'
          ) {
            await signInWithRedirect(auth, googleProvider);
            return;
          }
          throw e;
        }
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
        if (cred.user) {
          // Best-effort: let new password accounts verify right away.
          await sendEmailVerification(cred.user).catch(() => undefined);
        }
      },
      async sendPasswordReset(email: string) {
        if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to your .env.');
        await sendPasswordResetEmail(auth, email);
      },
      async signOut() {
        if (!auth) return;
        if (isNativeApp()) {
          // Also clear the OS-level Google session so the account picker
          // shows again on the next sign-in.
          try {
            const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
            await FirebaseAuthentication.signOut();
          } catch {
            /* native layer unavailable — web sign-out below still applies */
          }
        }
        await fbSignOut(auth);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      user,
      loading,
      isAdmin,
      isComputerStaff,
      isSolarStaff,
      isShopManager,
      isInstaller,
      hasAdminAccess,
      viewAs,
      realIsAdmin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
