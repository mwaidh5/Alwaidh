import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser as fbDeleteUser,
  EmailAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
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
import { sendAccountEmail } from '../lib/accountEmail';
import { subscribeSettings, type SiteSettings } from '../lib/settingsStore';
import { extrasFor, permissionsFor, type Permission } from '../lib/permissions';

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
  isCrmSolar: boolean; // admin OR given the CRM's solar book
  isCrmComputers: boolean; // admin OR given the CRM's computers book
  hasAdminAccess: boolean; // any role that can open the dashboard
  /** May this person open that part of the dashboard? Role bundle plus
   *  whatever was handed to them by name on the Users page. */
  can: (permission: Permission) => boolean;
  /** Colleague whose view is being previewed, or null. */
  viewAs: string | null;
  /** True when this account is really an admin, preview or not. */
  realIsAdmin: boolean;
  setViewAsEmail: (email: string | null) => void;
  signInWithGoogle: () => Promise<void>;
  /** Apple's own sign-in — required by App Review beside Google, and the
   *  one that lets a person hide their real address. */
  signInWithApple: () => Promise<void>;
  /**
   * Erase this account for good: the person's record, then the sign-in
   * itself. `password` is only needed when Firebase asks for a fresh
   * proof of identity and the account signs in with one.
   */
  deleteAccount: (password?: string) => Promise<void>;
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
      if (!u) {
        // Signed out — including a sign-out from before this tidy-up
        // existed, which left the topics behind. Wait first: a sign-in
        // resolves through this same listener, and unsubscribing on the
        // way past would strip the subscriptions it is about to make.
        window.setTimeout(() => {
          if (auth?.currentUser) return;
          import('../lib/push')
            .then(({ unsubscribeAll, lastSubscriber }) => unsubscribeAll(lastSubscriber()))
            .catch(() => undefined);
        }, 4000);
      }
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

  const isCrmSolar = useMemo(
    () => isAdmin || listed(settings?.crmSolarEmails),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, shownEmail, settings],
  );

  const isCrmComputers = useMemo(
    () => isAdmin || listed(settings?.crmComputerEmails),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, shownEmail, settings],
  );

  // Role bundle + the extras this person was given by name.
  const allowed = useMemo(
    () =>
      permissionsFor(
        { isAdmin, isComputerStaff, isSolarStaff, isShopManager, isInstaller, isCrmSolar, isCrmComputers },
        extrasFor(settings?.permissions, shownEmail),
        extrasFor(settings?.permissionsOff, shownEmail),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, isComputerStaff, isSolarStaff, isShopManager, isInstaller, isCrmSolar, isCrmComputers, shownEmail, settings],
  );
  const can = (permission: Permission) => allowed.has(permission);

  // The real admin never loses their way back out of a preview.
  const hasAdminAccess =
    realIsAdmin ||
    isComputerStaff ||
    isSolarStaff ||
    isShopManager ||
    isInstaller ||
    isCrmSolar ||
    isCrmComputers;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin,
      isComputerStaff,
      isSolarStaff,
      isShopManager,
      isInstaller,
      isCrmSolar,
      isCrmComputers,
      hasAdminAccess,
      can,
      viewAs,
      realIsAdmin,
      setViewAsEmail,
      configured: firebaseReady && auth !== null,
      async signInWithApple() {
        if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to your .env.');
        if (isNativeApp()) {
          // On the phone this is the system sheet, so Face ID and "Hide My
          // Email" work the way people expect.
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
          const idToken = result.credential?.idToken;
          if (!idToken) throw new Error('Apple sign-in did not return a credential. Please try again.');
          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({
            idToken,
            rawNonce: result.credential?.nonce,
          });
          const signedIn = await signInWithCredential(auth, credential);
          // Apple hands over the name once, on the very first sign-in.
          // Apple's plugin carries the name on the credential; the web
          // SDK's type doesn't know about it, so read it loosely.
          const named = result.credential as { givenName?: string; familyName?: string } | undefined;
          const given = [named?.givenName, named?.familyName].filter(Boolean).join(' ').trim();
          if (given && !signedIn.user.displayName) {
            await updateProfile(signedIn.user, { displayName: given });
          }
          return;
        }
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        try {
          await signInWithPopup(auth, provider);
        } catch (e) {
          const code = (e as { code?: string })?.code ?? '';
          if (
            code === 'auth/popup-blocked' ||
            code === 'auth/cancelled-popup-request' ||
            code === 'auth/popup-closed-by-user' ||
            code === 'auth/operation-not-supported-in-this-environment'
          ) {
            await signInWithRedirect(auth, provider);
            return;
          }
          throw e;
        }
      },
      async deleteAccount(password?: string) {
        if (!auth?.currentUser) throw new Error('You are not signed in.');
        const current = auth.currentUser;

        /** Firebase refuses to erase an account signed in a while ago. */
        const proveItIsYou = async () => {
          const providers = current.providerData.map((p) => p.providerId);
          if (providers.includes('password')) {
            if (!password) {
              const err = new Error('password-needed');
              err.name = 'PasswordNeeded';
              throw err;
            }
            const cred = EmailAuthProvider.credential(current.email ?? '', password);
            await reauthenticateWithCredential(current, cred);
            return;
          }
          if (isNativeApp()) {
            // The sheet proves who they are to the native SDK; the delete
            // happens on the JavaScript side, so the credential has to be
            // handed over here too — signing in natively alone leaves this
            // session just as stale as it was.
            const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
            if (providers.includes('apple.com')) {
              const res = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
              const idToken = res.credential?.idToken;
              if (!idToken) throw new Error('Apple sign-in did not return a credential.');
              const cred = new OAuthProvider('apple.com').credential({
                idToken,
                rawNonce: res.credential?.nonce,
              });
              await reauthenticateWithCredential(current, cred);
              return;
            }
            const res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
            const idToken = res.credential?.idToken;
            if (!idToken) throw new Error('Google sign-in did not return a credential.');
            const cred = GoogleAuthProvider.credential(idToken, res.credential?.nonce);
            await reauthenticateWithCredential(current, cred);
            return;
          }
          const provider = providers.includes('apple.com')
            ? new OAuthProvider('apple.com')
            : googleProvider;
          await reauthenticateWithPopup(current, provider);
        };

        const erase = async () => {
          // The person's own record goes first: once the sign-in is gone
          // the rules would refuse the write.
          try {
            const { deleteUser: deleteUserRecord } = await import('../lib/userStore');
            await deleteUserRecord(current.uid);
          } catch {
            /* no record to remove, or the rules said no — the account still goes */
          }
          await fbDeleteUser(current);
        };

        try {
          await erase();
        } catch (e) {
          const code = (e as { code?: string })?.code ?? '';
          if (code !== 'auth/requires-recent-login') throw e;
          await proveItIsYou();
          await erase();
        }
      },
      async signInWithGoogle() {
        if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to your .env.');
        // Native app: Google blocks OAuth inside embedded webviews, so use the
        // OS-level Google sign-in and hand its credential to Firebase.
        if (isNativeApp()) {
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          // Android's Credential Manager is the modern picker, but it can
          // only offer accounts the phone already has: on a device with no
          // Google account saved it fails outright with "no credentials
          // available", and the person has no way forward. The older picker
          // can add an account, so fall back to it rather than dead-end.
          let result;
          try {
            result = await FirebaseAuthentication.signInWithGoogle();
          } catch (e) {
            const raw = e instanceof Error ? e.message : String(e);
            // Only when there was nothing to choose from. Someone who
            // closed the sheet meant to close it — a second dialog would
            // be a fight, not a fallback.
            if (!/no credential/i.test(raw)) throw e;
            result = await FirebaseAuthentication.signInWithGoogle({
              useCredentialManager: false,
            });
          }
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
        if (cred.user?.email) {
          // Best-effort: let new password accounts verify right away.
          await sendAccountEmail('verify', cred.user.email).catch(() => undefined);
        }
      },
      async sendPasswordReset(email: string) {
        if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to your .env.');
        await sendAccountEmail('reset', email);
      },
      async signOut() {
        if (!auth) return;
        // Leave every topic first: after fbSignOut there is no email to
        // unsubscribe with, and the device would go on buzzing for work
        // that is no longer theirs.
        try {
          const { unsubscribeAll } = await import('../lib/push');
          await unsubscribeAll(auth.currentUser?.email ?? null);
        } catch {
          /* the sign-out matters more than the tidy-up */
        }
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
      isCrmSolar,
      isCrmComputers,
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
