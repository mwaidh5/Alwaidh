import { sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

export type AccountEmailKind = 'verify' | 'reset';

/**
 * Ask the server for a confirmation or password-reset email.
 *
 * The link inside is Firebase's own, minted by the Cloud Function with
 * admin credentials — the same one Firebase would have emailed. What we
 * gain is the envelope: our design, and noreply@alwaidh.com instead of an
 * address at firebaseapp.com that spam filters have no reason to trust.
 *
 * If our sending is unavailable — the mail server is down, or the function
 * isn't deployed yet — this falls back to Firebase's own plain email.
 * Someone locked out of their account needs a link far more than they need
 * a pretty one.
 */
export async function sendAccountEmail(kind: AccountEmailKind, email: string): Promise<void> {
  try {
    const { firebaseApp } = await import('../firebase');
    if (!firebaseApp) throw new Error('Firebase is not configured.');
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const call = httpsCallable(getFunctions(firebaseApp, 'me-central1'), 'sendAccountEmail');
    await call({ kind, email });
    return;
  } catch (e) {
    console.warn('Falling back to Firebase for the account email:', e);
  }

  if (!auth) throw new Error('Firebase is not configured.');
  if (kind === 'reset') {
    await sendPasswordResetEmail(auth, email);
    return;
  }
  if (!auth.currentUser) throw new Error('Sign in first.');
  await sendEmailVerification(auth.currentUser);
}
