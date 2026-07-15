import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uploadImage } from '../lib/imageUpload';
import { recordUserLogin } from '../lib/userStore';
import { listOrdersForUser, type Order, type OrderStatus } from '../lib/orderStore';
import { formatPrice } from '../lib/format';

const STATUS_BADGES: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-blue-100 text-blue-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function Account() {
  const { user, loading, sendPasswordReset } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="container-page py-16 text-center text-slate-500">Loading…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="bg-slate-50">
      <div className="container-page py-10">
        <h1 className="text-2xl font-extrabold text-slate-900">My Account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your profile, security, and see your orders.
        </p>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[360px,1fr]">
          <div className="space-y-6">
            <ProfileCard />
            <SecurityCard onSendReset={sendPasswordReset} />
          </div>
          <OrdersCard uid={user.uid} />
        </div>
      </div>
    </div>
  );
}

function ProfileCard() {
  const { user, signOut } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.displayName ?? '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  if (!user) return null;

  async function syncUserDoc(displayName: string, photo: string) {
    if (!user?.email) return;
    await recordUserLogin({
      uid: user.uid,
      email: user.email,
      displayName,
      photoURL: photo,
    }).catch(() => {
      /* non-fatal */
    });
  }

  async function handlePhoto(file: File) {
    if (!auth?.currentUser) return;
    setError('');
    setMsg('');
    setUploading(true);
    try {
      const { url } = await uploadImage(file, `uploads/${auth.currentUser.uid}`);
      await updateProfile(auth.currentUser, { photoURL: url });
      setPhotoURL(url);
      await syncUserDoc(name.trim() || user?.displayName || '', url);
      setMsg('Profile photo updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleSaveName() {
    if (!auth?.currentUser) return;
    setError('');
    setMsg('');
    setBusy(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
      await syncUserDoc(name.trim(), photoURL);
      setMsg('Profile updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-bold text-slate-900">Profile</h2>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative">
          {photoURL ? (
            <img
              src={photoURL}
              alt=""
              referrerPolicy="no-referrer"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-200"
            />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-600 text-2xl font-bold text-white">
              {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="btn-secondary px-4 py-2 text-sm"
          >
            {uploading ? 'Uploading…' : 'Change photo'}
          </button>
          <p className="mt-1 text-xs text-slate-500">JPG or PNG · max 5 MB</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhoto(f);
            }}
          />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Display name
          </label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Email
          </label>
          <input className="input bg-slate-50 text-slate-500" value={user.email ?? ''} readOnly />
        </div>
        <button
          type="button"
          onClick={handleSaveName}
          disabled={busy}
          className="btn-primary w-full"
        >
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </div>

      {msg && (
        <p className="mt-3 rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800">
          {msg}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => signOut()}
        className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Sign out
      </button>
    </div>
  );
}

function SecurityCard({ onSendReset }: { onSendReset: (email: string) => Promise<void> }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  if (!user) return null;
  const hasPassword = user.providerData.some((p) => p.providerId === 'password');

  async function handleSendVerification() {
    if (!auth?.currentUser) return;
    setError('');
    setMsg('');
    setBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setMsg('Verification email sent — click the link in it, then sign out and back in.');
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      setError(
        raw.includes('too-many-requests')
          ? 'Too many attempts — wait a few minutes, then try again.'
          : raw.replace('Firebase: ', '') || 'Could not send the email.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!auth?.currentUser || !user?.email) return;
    setError('');
    setMsg('');
    setBusy(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, next);
      setCurrent('');
      setNext('');
      setMsg('Password changed.');
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
        setError('Current password is incorrect.');
      } else if (raw.includes('auth/weak-password')) {
        setError('New password should be at least 6 characters.');
      } else {
        setError(raw.replace('Firebase: ', '') || 'Could not change password.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!user?.email) return;
    setError('');
    setMsg('');
    try {
      await onSendReset(user.email);
      setMsg('Password reset email sent — check your inbox.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send reset email.');
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-bold text-slate-900">Security</h2>

      {user.emailVerified ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
          ✅ Email verified
        </p>
      ) : (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">⚠️ Your email isn't verified yet.</p>
          <p className="mt-1 text-xs">
            Some features (like staff access) only work with a verified email.
          </p>
          <button
            type="button"
            onClick={handleSendVerification}
            disabled={busy}
            className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            {busy ? 'Sending…' : 'Verify now — send email'}
          </button>
        </div>
      )}

      {hasPassword ? (
        <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
          <input
            type="password"
            className="input"
            placeholder="Current password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <input
            type="password"
            className="input"
            placeholder="New password (min 6 characters)"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Changing…' : 'Change password'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full text-center text-sm text-brand-700 hover:underline"
          >
            Forgot it? Email me a reset link
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          You sign in with <span className="font-semibold">Google</span>, so your password is
          managed by your Google account — there's no separate password for this site.
        </p>
      )}
      {msg && (
        <p className="mt-3 rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800">
          {msg}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

function OrdersCard({ uid }: { uid: string }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    listOrdersForUser(uid)
      .then((list) => {
        if (!cancelled) setOrders(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load orders.');
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900">My orders</h2>
        {orders && orders.length > 0 && (
          <span className="text-sm text-slate-500">{orders.length} total</span>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {orders === null && !error ? (
        <p className="mt-6 text-center text-sm text-slate-500">Loading…</p>
      ) : orders && orders.length === 0 ? (
        <div className="mt-6 py-8 text-center">
          <p className="text-3xl">🛒</p>
          <p className="mt-2 text-sm text-slate-600">No orders yet.</p>
          <p className="text-xs text-slate-500">
            Orders you place while signed in will show up here.
          </p>
          <Link to="/shop" className="btn-primary mt-4 inline-flex px-5 py-2 text-sm">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {(orders ?? []).map((o) => (
            <div key={o.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Order <span className="font-mono text-slate-600">#{o.id.slice(0, 8)}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(o.createdAt).toLocaleDateString()} ·{' '}
                    {o.lines.reduce((n, l) => n + l.quantity, 0)} item(s)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS_BADGES[o.status]}`}
                  >
                    {o.status}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {formatPrice(o.subtotal, o.currency)}
                  </span>
                </div>
              </div>
              <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
                {o.lines.map((l) => (
                  <li key={l.productId} className="flex justify-between gap-3">
                    <span className="truncate">
                      {l.quantity} × {l.name}
                    </span>
                    <span className="flex-none font-semibold">
                      {formatPrice(l.price * l.quantity, o.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
