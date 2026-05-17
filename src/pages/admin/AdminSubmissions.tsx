import { useEffect, useState } from 'react';
import {
  deleteContactSubmission,
  listContactSubmissions,
  storageMode,
  type ContactSubmission,
} from '../../lib/contactSubmissions';

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<ContactSubmission[] | null>(null);
  const [error, setError] = useState('');
  const [refreshAt, setRefreshAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError('');
    listContactSubmissions()
      .then((list) => {
        if (!cancelled) setSubmissions(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load submissions.');
      });
    return () => {
      cancelled = true;
    };
  }, [refreshAt]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this submission?')) return;
    try {
      await deleteContactSubmission(id);
      setRefreshAt((n) => n + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  const mode = storageMode();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Contact submissions</h1>
          <p className="mt-1 text-sm text-slate-600">
            Storage:{' '}
            <span className="font-semibold">
              {mode === 'firestore' ? 'Firestore' : 'Local (this browser only)'}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshAt((n) => n + 1)}
          className="btn-secondary"
        >
          Refresh
        </button>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {submissions === null && !error && (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      )}

      {submissions && submissions.length === 0 && !error && (
        <div className="card p-10 text-center text-sm text-slate-500">
          No contact submissions yet.
        </div>
      )}

      {submissions && submissions.length > 0 && (
        <ul className="space-y-4">
          {submissions.map((s) => (
            <li key={s.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-extrabold text-slate-900">{s.name}</p>
                  <p className="text-sm text-slate-600">
                    <a href={`mailto:${s.email}`} className="text-brand-700 hover:underline">
                      {s.email}
                    </a>
                    {s.phone && (
                      <>
                        {' · '}
                        <a href={`tel:${s.phone}`} className="text-brand-700 hover:underline">
                          {s.phone}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className="mt-1 text-xs font-semibold text-red-700 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {s.subject && (
                <p className="mt-3 text-sm font-semibold text-slate-800">Subject: {s.subject}</p>
              )}
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{s.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
