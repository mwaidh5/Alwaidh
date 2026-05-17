import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loading, configured, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleGoogle() {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate(redirectTo, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="container-page py-16">
      <div className="mx-auto max-w-sm card p-7">
        <h1 className="text-2xl font-extrabold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use your Google account to access Alwaidh.
        </p>

        {!configured && (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Firebase is not configured. Add your <code>VITE_FIREBASE_*</code> values to{' '}
            <code>.env</code> and reload to enable Google sign-in.
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={!configured || submitting || loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          {submitting ? 'Signing in…' : 'Continue with Google'}
        </button>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          By signing in you agree to our terms.{' '}
          <Link to="/" className="text-brand-700 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </section>
  );
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
