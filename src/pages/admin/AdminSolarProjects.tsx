import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createSolarProject,
  deleteSolarProject,
  subscribeSolarProjects,
  upsertSolarProject,
  type SolarProject,
} from '../../lib/solarProjectsStore';
import { uploadImage } from '../../lib/imageUpload';

type FormState = SolarProject;

const EMPTY: FormState = {
  id: '',
  title: '',
  location: '',
  size: '',
  blurb: '',
  image: '',
  order: 0,
};

export default function AdminSolarProjects() {
  const [projects, setProjects] = useState<SolarProject[] | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeSolarProjects(setProjects), []);

  async function handleSave() {
    if (!editing) return;
    setError('');
    setBusy(true);
    try {
      const payload = {
        title: editing.title.trim(),
        location: editing.location.trim(),
        size: editing.size.trim(),
        blurb: editing.blurb.trim(),
        image: editing.image.trim(),
        order: Number(editing.order) || 0,
      };
      if (!payload.title) throw new Error('Title is required.');
      if (editing.id) await upsertSolarProject({ id: editing.id, ...payload });
      else await createSolarProject(payload);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project?')) return;
    try {
      await deleteSolarProject(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Solar Projects</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage the showcase on the public Solar Energy Projects page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setEditing({ ...EMPTY, order: (projects?.length ?? 0) });
          }}
          className="btn-primary"
        >
          + Add project
        </button>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      {projects === null ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">No projects yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <div key={p.id} className="card flex gap-4 overflow-hidden p-4">
              <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100">
                {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{p.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {[p.location, p.size].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.blurb}</p>
                <div className="mt-2 flex gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setEditing({ ...p });
                    }}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="font-semibold text-red-700 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProjectDialog
          state={editing}
          setState={setEditing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function ProjectDialog({
  state,
  setState,
  busy,
  onCancel,
  onSave,
}: {
  state: FormState;
  setState: (s: FormState) => void;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleUpload(file: File) {
    setUploadError('');
    setUploading(true);
    try {
      const { url } = await uploadImage(file, 'projects');
      setState({ ...state, image: url });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="font-bold text-slate-900">{state.id ? 'Edit project' : 'New project'}</h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <Field label="Title">
            <input
              className="input"
              value={state.title}
              onChange={(e) => setState({ ...state, title: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location / type">
              <input
                className="input"
                value={state.location}
                onChange={(e) => setState({ ...state, location: e.target.value })}
                placeholder="e.g. Residential villa"
              />
            </Field>
            <Field label="Size / spec">
              <input
                className="input"
                value={state.size}
                onChange={(e) => setState({ ...state, size: e.target.value })}
                placeholder="e.g. 6 kW · 12 panels"
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              className="input min-h-[100px]"
              value={state.blurb}
              onChange={(e) => setState({ ...state, blurb: e.target.value })}
            />
          </Field>
          <Field label="Display order">
            <input
              type="number"
              className="input"
              value={state.order}
              onChange={(e) => setState({ ...state, order: Number(e.target.value) })}
            />
          </Field>
          <Field label="Image">
            <div className="flex flex-wrap items-start gap-3">
              <div className="h-24 w-32 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                {state.image ? (
                  <img src={state.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs text-slate-400">
                    No image
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    className="btn-secondary"
                  >
                    {uploading ? 'Uploading…' : 'Upload image'}
                  </button>
                  {state.image && (
                    <button
                      type="button"
                      onClick={() => setState({ ...state, image: '' })}
                      className="text-sm font-semibold text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
                <input
                  className="input"
                  value={state.image}
                  onChange={(e) => setState({ ...state, image: e.target.value })}
                  placeholder="…or paste an image URL"
                />
                {uploadError && <p className="text-xs text-red-700">{uploadError}</p>}
              </div>
            </div>
          </Field>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={onSave} className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
