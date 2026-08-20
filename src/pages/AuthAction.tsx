import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  applyActionCode,
  confirmPasswordReset,
  sendEmailVerification,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useLang } from '../lib/i18n';

/**
 * Where the links in account emails land — confirming an address, choosing
 * a new password, undoing an address change.
 *
 * Firebase has a page of its own for this, but it carries Google's
 * branding, the project's raw address, and one message for every failure:
 * "the link has expired or has already been used". That single sentence
 * covers two very different situations — a link that was used a moment ago
 * (in which case the account is already confirmed and there's nothing to
 * do) and one that was replaced by a newer email. Sorting those out is
 * most of what this page is for.
 */
type Mode = 'verifyEmail' | 'resetPassword' | 'recoverEmail' | 'verifyAndChangeEmail';

export default function AuthAction() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const mode = (params.get('mode') ?? '') as Mode;
  const code = params.get('oobCode') ?? '';

  const [state, setState] = useState<'working' | 'done' | 'password' | 'failed'>('working');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  // A password reset needs a form, so the code is checked first and spent
  // only when the new password is submitted.
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [resent, setResent] = useState('');

  // React runs effects twice in development; spending a one-time code twice
  // would report failure on a link that had just worked.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!auth || !code) {
      setError(t('This link is missing something. Open the newest email and try again.'));
      setState('failed');
      return;
    }
    (async () => {
      try {
        if (mode === 'resetPassword') {
          setEmail(await verifyPasswordResetCode(auth, code));
          setState('password');
          return;
        }
        if (mode === 'verifyEmail' || mode === 'recoverEmail' || mode === 'verifyAndChangeEmail') {
          await applyActionCode(auth, code);
          // The signed-in session still carries the old, unverified claim
          // until its token is renewed.
          await auth.currentUser?.reload().catch(() => undefined);
          await auth.currentUser?.getIdToken(true).catch(() => undefined);
          setState('done');
          return;
        }
        setError(t("This link isn't one we recognise."));
        setState('failed');
      } catch (e) {
        setError(messageFor(e, t));
        setState('failed');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!auth) return;
    if (password.length < 6) {
      setError(t('Use at least 6 characters.'));
      return;
    }
    if (password !== confirm) {
      setError(t('The two passwords are different.'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await confirmPasswordReset(auth, code, password);
      setState('done');
    } catch (e) {
      setError(messageFor(e, t));
      setState('failed');
    } finally {
      setSaving(false);
    }
  }

  /** Send a fresh confirmation email — only possible while signed in. */
  async function resend() {
    if (!auth?.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setResent(t('Sent. Open the newest email — older ones no longer work.'));
    } catch {
      setResent(t('Could not send another email just now. Try again in a minute.'));
    }
  }

  const heading =
    state === 'password'
      ? t('Choose a new password')
      : state === 'done'
        ? mode === 'resetPassword'
          ? t('Password changed')
          : t('Email confirmed')
        : state === 'failed'
          ? t('This link no longer works')
          : t('One moment…');

  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-md p-7 text-center">
        <div className="text-4xl" aria-hidden>
          {state === 'done' ? '✅' : state === 'failed' ? '⚠️' : '🔑'}
        </div>
        <h1 className="mt-3 text-xl font-extrabold text-slate-900">{heading}</h1>

        {state === 'working' && (
          <p className="mt-2 text-sm text-slate-600">{t('Checking your link…')}</p>
        )}

        {state === 'done' && (
          <>
            <p className="mt-2 text-sm text-slate-600">
              {mode === 'resetPassword'
                ? t('You can sign in with your new password now.')
                : t('Your email address is confirmed. Everything is ready to use.')}
            </p>
            <Link to="/login" className="btn-primary mt-5 inline-block">
              {t('Sign in')}
            </Link>
          </>
        )}

        {state === 'password' && (
          <form onSubmit={handleNewPassword} className="mt-4 space-y-3 text-start">
            {email && (
              <p className="text-center text-sm text-slate-600">
                {t('For')} <span className="font-semibold text-slate-800">{email}</span>
              </p>
            )}
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">{t('New password')}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="input mt-1 w-full"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">{t('Repeat it')}</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="input mt-1 w-full"
                required
              />
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-60">
              {saving ? t('Saving…') : t('Save new password')}
            </button>
          </form>
        )}

        {state === 'failed' && (
          <>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            {/* The commonest reason by far, and the one people never guess. */}
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-start text-xs leading-relaxed text-slate-600">
              {t(
                'Each link works once. Asking for another email cancels the one before it, so only the newest email opens — and a link already opened once will say this the second time, even though it worked.',
              )}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link to="/login" className="btn-primary">
                {t('Try signing in')}
              </Link>
              {auth?.currentUser && !auth.currentUser.emailVerified && (
                <button type="button" onClick={resend} className="btn-secondary">
                  {t('Send me a new link')}
                </button>
              )}
            </div>
            {resent && <p className="mt-3 text-sm font-semibold text-green-700">{resent}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/** Firebase's codes, said plainly. */
function messageFor(e: unknown, t: (s: string) => string): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
    return t('This link has already been used, or a newer email replaced it.');
  }
  if (code === 'auth/user-disabled') return t('This account has been turned off.');
  if (code === 'auth/user-not-found') return t('That account no longer exists.');
  if (code === 'auth/weak-password') return t('Use at least 6 characters.');
  const raw = e instanceof Error ? e.message.replace('Firebase: ', '') : '';
  return raw || t('Something went wrong. Please try again.');
}
