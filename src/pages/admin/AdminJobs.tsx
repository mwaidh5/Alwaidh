import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  JOB_STATUSES,
  createJob,
  deleteJob,
  setJobStatus,
  subscribeJobs,
  upsertJob,
  type Job,
  type JobStatus,
  type JobType,
} from '../../lib/jobsStore';

type FormState = Job;

const EMPTY: FormState = {
  id: '',
  customer: '',
  phone: '',
  address: '',
  type: 'install',
  system: '',
  installer: '',
  notes: '',
  status: 'new',
  order: 0,
};

const STATUS_STYLES: Record<JobStatus, { column: string; header: string; dot: string; badge: string }> = {
  new: {
    column: 'border-blue-200 bg-blue-50',
    header: 'text-blue-700',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
  scheduled: {
    column: 'border-amber-200 bg-amber-50',
    header: 'text-amber-700',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  in_progress: {
    column: 'border-violet-200 bg-violet-50',
    header: 'text-violet-700',
    dot: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700',
  },
  done: {
    column: 'border-green-200 bg-green-50',
    header: 'text-green-700',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700',
  },
};

export default function AdminJobs() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeJobs(setJobs), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const byStatus = useMemo(() => {
    const map: Record<JobStatus, Job[]> = { new: [], scheduled: [], in_progress: [], done: [] };
    for (const j of jobs ?? []) map[j.status]?.push(j);
    return map;
  }, [jobs]);

  const activeJob = (jobs ?? []).find((j) => j.id === activeId) ?? null;

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const overStatus = over.id as JobStatus;
    const job = (jobs ?? []).find((j) => j.id === active.id);
    if (!job || job.status === overStatus) return;
    setJobStatus(job.id, overStatus, Date.now()).catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not move card.'),
    );
  }

  async function handleSave() {
    if (!editing) return;
    setError('');
    setBusy(true);
    try {
      const payload = {
        customer: editing.customer.trim(),
        phone: editing.phone.trim(),
        address: editing.address.trim(),
        type: editing.type,
        system: editing.system.trim(),
        installer: editing.installer.trim(),
        notes: editing.notes.trim(),
        status: editing.status,
        order: editing.order || Date.now(),
      };
      if (!payload.customer) throw new Error('Customer name is required.');
      if (editing.id) await upsertJob({ id: editing.id, ...payload });
      else await createJob(payload);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(job: Job) {
    if (!confirm(`Delete the job for ${job.customer || 'this customer'}?`)) return;
    try {
      await deleteJob(job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Solar Jobs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track installs and repairs. Drag a card between columns to update its status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setEditing({ ...EMPTY, order: Date.now() });
          }}
          className="btn-primary"
        >
          + New job
        </button>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      {jobs === null ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {JOB_STATUSES.map((col) => (
              <Column
                key={col.key}
                status={col.key}
                label={col.label}
                jobs={byStatus[col.key]}
                onEdit={(j) => {
                  setError('');
                  setEditing({ ...j });
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
          <DragOverlay>{activeJob ? <JobCardView job={activeJob} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      {editing && (
        <JobDialog
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

function Column({
  status,
  label,
  jobs,
  onEdit,
  onDelete,
}: {
  status: JobStatus;
  label: string;
  jobs: Job[];
  onEdit: (j: Job) => void;
  onDelete: (j: Job) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const style = STATUS_STYLES[status];
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-3 transition ${
        isOver ? 'border-brand-500 ring-2 ring-brand-200' : ''
      } ${style.column}`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className={`flex items-center gap-2 text-sm font-bold ${style.header}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
          {label}
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
          {jobs.length}
        </span>
      </div>
      <div className="min-h-[80px] space-y-3">
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} onEdit={() => onEdit(j)} onDelete={() => onDelete(j)} />
        ))}
        {jobs.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">
            Drop here
          </p>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, onEdit, onDelete }: { job: Job; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-40' : ''}>
      <JobCardView
        job={job}
        dragListeners={listeners}
        dragAttributes={attributes}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function JobCardView({
  job,
  dragListeners,
  dragAttributes,
  onEdit,
  onDelete,
  overlay,
}: {
  job: Job;
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: DraggableAttributes;
  onEdit?: () => void;
  onDelete?: () => void;
  overlay?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-3 ${
        overlay ? 'shadow-lg' : 'shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            job.type === 'repair' ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'
          }`}
        >
          {job.type}
        </span>
        <button
          type="button"
          aria-label="Drag"
          className="cursor-grab touch-none px-1 text-slate-400 hover:text-slate-600 active:cursor-grabbing"
          {...dragListeners}
          {...dragAttributes}
        >
          ⠿
        </button>
      </div>
      <p className="mt-1 font-semibold text-slate-900">{job.customer || 'Unnamed'}</p>
      {job.system && <p className="text-xs text-slate-600">{job.system}</p>}
      {job.installer && <p className="mt-1 truncate text-xs font-medium text-slate-600">👷 {job.installer}</p>}
      {job.address && <p className="mt-1 truncate text-xs text-slate-500">📍 {job.address}</p>}
      {job.phone && <p className="truncate text-xs text-slate-500">📞 {job.phone}</p>}
      {job.notes && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{job.notes}</p>}
      {!overlay && (
        <div className="mt-2 flex gap-3 text-xs">
          <button type="button" onClick={onEdit} className="font-semibold text-brand-700 hover:underline">
            Edit
          </button>
          <button type="button" onClick={onDelete} className="font-semibold text-red-700 hover:underline">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function JobDialog({
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
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="font-bold text-slate-900">{state.id ? 'Edit job' : 'New job'}</h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <Field label="Customer name">
            <input
              className="input"
              value={state.customer}
              onChange={(e) => setState({ ...state, customer: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <input
                className="input"
                value={state.phone}
                onChange={(e) => setState({ ...state, phone: e.target.value })}
              />
            </Field>
            <Field label="Job type">
              <select
                className="input"
                value={state.type}
                onChange={(e) => setState({ ...state, type: e.target.value as JobType })}
              >
                <option value="install">Install</option>
                <option value="repair">Repair</option>
              </select>
            </Field>
          </div>
          <Field label="Address">
            <input
              className="input"
              value={state.address}
              onChange={(e) => setState({ ...state, address: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="System / details">
              <input
                className="input"
                value={state.system}
                onChange={(e) => setState({ ...state, system: e.target.value })}
                placeholder="e.g. 6 kW rooftop system"
              />
            </Field>
            <Field label="Installer">
              <input
                className="input"
                value={state.installer}
                onChange={(e) => setState({ ...state, installer: e.target.value })}
                placeholder="Technician name"
              />
            </Field>
          </div>
          <Field label="Status">
            <select
              className="input"
              value={state.status}
              onChange={(e) => setState({ ...state, status: e.target.value as JobStatus })}
            >
              {JOB_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              className="input min-h-[90px]"
              value={state.notes}
              onChange={(e) => setState({ ...state, notes: e.target.value })}
            />
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
