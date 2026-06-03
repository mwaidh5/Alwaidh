import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Mode = 'signin' | 'signup' | 'reset';

export default function Login() {
  const { user, loading, configured, signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } =
    useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleGoogle() {
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate(redirectTo, { replace: true });
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password, name.trim() || undefined);
        navigate(redirectTo, { replace: true });
      } else if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
        navigate(redirectTo, { replace: true });
      } else {
        await sendPasswordReset(email.trim());
        setInfo('Password reset email sent. Check your inbox.');
        setMode('signin');
      }
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in';

  return (
    <section className="container-page py-16">
      <div className="mx-auto max-w-sm card p-7">
        <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === 'reset'
            ? 'Enter your email and we’ll send you a reset link.'
            : 'Sign in to your Alwaidh account.'}
        </p>

        {!configured && (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Firebase is not configured. Add your <code>VITE_FIREBASE_*</code> values and reload.
          </div>
        )}

        {info && (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {info}
          </p>
        )}

        <form onSubmit={handleEmailSubmit} className="mt-5 space-y-3">
          {mode === 'signup' && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="input"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className="input"
          />
          {mode !== 'reset' && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              className="input"
            />
          )}
          <button
            type="submit"
            disabled={!configured || submitting}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'reset'
                  ? 'Send reset link'
                  : 'Sign in'}
          </button>
        </form>

        {mode === 'signin' && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setError('');
                setInfo('');
              }}
              className="text-brand-700 hover:underline"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setInfo('');
              }}
              className="text-brand-700 hover:underline"
            >
              Create account
            </button>
          </div>
        )}
        {mode !== 'signin' && (
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError('');
              setInfo('');
            }}
            className="mt-3 text-sm text-brand-700 hover:underline"
          >
            ← Back to sign in
          </button>
        )}

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          OR
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={!configured || submitting || loading}
          className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/" className="text-brand-700 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : 'Something went wrong.';
  // Friendlier text for the most common Firebase auth errors.
  if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password'))
    return 'Incorrect email or password.';
  if (raw.includes('auth/user-not-found')) return 'No account found with that email.';
  if (raw.includes('auth/email-already-in-use')) return 'An account with that email already exists.';
  if (raw.includes('auth/weak-password')) return 'Password should be at least 6 characters.';
  if (raw.includes('auth/invalid-email')) return 'That email address looks invalid.';
  if (raw.includes('auth/operation-not-allowed'))
    return 'Email/password sign-in is not enabled in Firebase yet.';
  return raw.replace('Firebase: ', '');
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.1 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.3 2.8l5.7-5.7C33.9 6.7 29.2 5 24 5 13.5 5 5 13.5 5 24s8.5 19 19 19 19-8.5 19-19c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.3 1 7.3 2.8l5.7-5.7C33.9 6.7 29.2 5 24 5 16.3 5 9.6 9.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43c5.1 0 9.8-2 13.3-5.2l-6.1-5.2C29.2 34 26.7 35 24 35c-5.3 0-9.7-2.9-11.3-7l-6.5 5C9.4 38.6 16.1 43 24 43z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.1 5.2c-.4.4 6.8-5 6.8-14.6 0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
