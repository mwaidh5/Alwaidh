import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  destroyJob,
  restoreJob,
  setJobStatus,
  subscribeDeletedJobs,
  subscribeJobs,
  upsertJob,
  wazeFromGoogleMaps,
  type Job,
  type JobStatus,
  type JobType,
} from '../../lib/jobsStore';
import { uploadInvoice } from '../../lib/imageUpload';
import { useLang } from '../../lib/i18n';
import { useStaffName } from '../../lib/staffDirectory';
import { useScrollLock } from '../../lib/useScrollLock';
import { changedAt, markJobSeen, useSeenJobs } from '../../lib/seenJobs';
import { useAuth } from '../../context/AuthContext';
import { subscribeSettings } from '../../lib/settingsStore';
import { listUsers } from '../../lib/userStore';
import JobActivity from '../../components/JobActivity';

type FormState = Job;

const EMPTY: FormState = {
  id: '',
  customer: '',
  phone: '',
  address: '',
  mapUrl: '',
  type: 'install',
  system: '',
  installer: '',
  installerEmails: [],
  notes: '',
  invoiceUrl: '',
  invoiceName: '',
  status: 'new',
  order: 0,
  createdBy: '',
  createdAtMs: null,
  updatedBy: '',
  updatedAtMs: null,
  deletedAtMs: null,
  deletedBy: '',
};

/** "ahmed.ali@gmail.com" → "Ahmed Ali", for accounts with no name on file. */
function prettyHandle(email: string): string {
  const handle = (email.split('@')[0] ?? '').replace(/[._-]+/g, ' ').trim();
  if (!handle) return email;
  return handle.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtShort(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(thisYear ? {} : { year: '2-digit' }),
  });
}

function fmtWhen(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_STYLES: Record<
  JobStatus,
  { over: string; header: string; dot: string; badge: string }
> = {
  new: {
    over: 'bg-blue-50',
    header: 'text-blue-700',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
  scheduled: {
    over: 'bg-amber-50',
    header: 'text-amber-700',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  in_progress: {
    over: 'bg-violet-50',
    header: 'text-violet-700',
    dot: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700',
  },
  done: {
    over: 'bg-green-50',
    header: 'text-green-700',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700',
  },
  cancelled: {
    over: 'bg-rose-50',
    header: 'text-rose-700',
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700',
  },
};

export default function AdminJobs() {
  const { t } = useLang();
  const { user, isSolarStaff } = useAuth();
  // Which jobs have changed since this device last opened them.
  const seen = useSeenJobs(user?.email ?? null);
  const [installerEmails, setInstallerEmails] = useState<string[] | null>(null);
  const [installerLeaders, setInstallerLeaders] = useState<Record<string, string[]>>({});
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  // A field installer sees only the jobs assigned to them. They can work
  // those jobs fully — edit, move, comment — but adding, reassigning and
  // deleting stay with the office. Read the list here rather than from the
  // auth context so the flag and the query are decided together.
  const myEmail = user?.email?.toLowerCase() ?? '';
  const installerOnly = !isSolarStaff && !!myEmail && (installerEmails ?? []).includes(myEmail);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [viewing, setViewing] = useState<Job | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // The mouse wheel pans the board sideways. A native listener, because
  // React attaches wheel handlers passively and preventDefault would be
  // ignored — the page would scroll as well.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (el.scrollWidth - el.clientWidth <= 0) return;
      const before = el.scrollLeft;
      el.scrollLeft += e.deltaY;
      if (el.scrollLeft !== before) e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);

  // Phones render iframe PDFs zoomed to actual size, so open the native
  // viewer there instead of the modal.
  function previewInvoice(url: string) {
    if (window.matchMedia('(max-width: 640px)').matches) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    setInvoicePreview(url);
  }
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | JobType>('all');
  const [trashOpen, setTrashOpen] = useState(false);

  useEffect(
    () =>
      subscribeSettings((s) => {
        setInstallerEmails(s.installerEmails ?? []);
        setInstallerLeaders(s.installerLeaders ?? {});
        setStaffNames(s.staffNames ?? {});
      }),
    [],
  );
  // A field installer who leads a crew may put that crew on their own
  // jobs (and take them off) — nobody else, and never themselves off.
  const myCrew = myEmail ? (installerLeaders[myEmail] ?? []) : [];
  const leaderPool =
    installerOnly && myCrew.length > 0 ? [...new Set([myEmail, ...myCrew])] : null;

  // Real names for the installer picker. Only admins may list the user
  // accounts, so this is best-effort: without it the picker falls back to
  // the name built from the email address.
  const [installerNames, setInstallerNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    listUsers()
      .then((list) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const u of list) {
          const name = (u.displayName ?? '').trim();
          if (u.email && name) map[u.email.toLowerCase()] = name;
        }
        setInstallerNames(map);
      })
      .catch(() => {
        /* not allowed to read the user list — email-based names it is */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const installerName = (email: string) =>
    staffNames[email] || installerNames[email] || prettyHandle(email);
  const onlyMine = installerOnly ? myEmail : '';
  const rolesReady = installerEmails !== null;
  useEffect(() => {
    // Wait for the role lists: an unfiltered read would be rejected for an
    // installer, and the failed attempt would flash an access error.
    if (!rolesReady) return;
    setError('');
    return subscribeJobs(
      setJobs,
      (message) =>
        setError(
          message.includes('insufficient permissions')
            ? 'Access to jobs was denied. Make sure you are signed in with Google using an email listed under Solar staff (or Admin).'
            : `Could not load jobs: ${message}`,
        ),
      onlyMine || undefined,
    );
  }, [onlyMine, rolesReady]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // A job stores the installer's name as text frozen at assignment time,
  // so a rename on the Users page never reached old cards. Re-resolve the
  // label from the assigned emails on every render; the stored text only
  // survives for ancient jobs that carry no emails.
  const named = useMemo(
    () =>
      (jobs ?? []).map((j) =>
        j.installerEmails.length
          ? { ...j, installer: j.installerEmails.map(installerName).join(', ') }
          : j,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobs, staffNames, installerNames],
  );

  const filtered = useMemo(() => {
    let list = named;
    if (typeFilter !== 'all') list = list.filter((j) => j.type === typeFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((j) =>
        [j.customer, j.installer, j.address, j.phone, j.system].some((v) =>
          v.toLowerCase().includes(q),
        ),
      );
    }
    // Newest job at the top of its column. `order` is a timestamp taken
    // when the card was added or last moved, so sorting on it descending
    // puts the most recent work first; createdAt breaks any tie.
    return [...list].sort(
      (a, b) => b.order - a.order || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0),
    );
  }, [named, typeFilter, query]);

  const byStatus = useMemo(() => {
    const map: Record<JobStatus, Job[]> = {
      new: [],
      scheduled: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const j of filtered) map[j.status]?.push(j);
    return map;
  }, [filtered]);

  // Stat tiles always show the full board, regardless of search/filter.
  const totals = useMemo(() => {
    const map: Record<JobStatus, number> = {
      new: 0,
      scheduled: 0,
      in_progress: 0,
      done: 0,
      cancelled: 0,
    };
    for (const j of jobs ?? []) map[j.status] += 1;
    return map;
  }, [jobs]);

  const activeJob = (jobs ?? []).find((j) => j.id === activeId) ?? null;

  /** Move a job between columns without dragging — how the phone does it. */
  function moveJob(job: Job, status: JobStatus) {
    if (job.status === status) return;
    setJobStatus(job.id, status, Date.now()).catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not move the job.'),
    );
  }

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
        mapUrl: editing.mapUrl.trim(),
        type: editing.type,
        system: editing.system.trim(),
        installer: editing.installer.trim(),
        installerEmails: editing.installerEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
        notes: editing.notes.trim(),
        invoiceUrl: editing.invoiceUrl,
        invoiceName: editing.invoiceName,
        status: editing.status,
        order: editing.order || Date.now(),
      };
      if (!payload.customer) throw new Error('Customer name is required.');
      if (editing.id) await upsertJob({ ...editing, ...payload });
      else await createJob(payload);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(job: Job) {
    if (!confirm(`Move the job for ${job.customer || 'this customer'} to the Trash?`)) return;
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
          <h1 className="text-2xl font-extrabold text-slate-900">{t('Solar Jobs')}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {installerOnly
              ? t('The installations assigned to you.')
              : t('Track installs and repairs. Drag a card between columns to update its status.')}
          </p>
        </div>
        <div className="flex gap-2">
          {!installerOnly && (
            <button
              type="button"
              onClick={() => setTrashOpen(true)}
              className="btn-secondary"
              title={t('Deleted jobs')}
            >
              🗑️ {t('Trash')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setError('');
              setEditing({
                ...EMPTY,
                order: Date.now(),
                // An installer's own job: they're on it from the start, so
                // it stays visible to them once saved.
                ...(installerOnly
                  ? { installerEmails: [myEmail], installer: installerName(myEmail) }
                  : {}),
              });
            }}
            className="btn-primary"
          >
            {t('+ New job')}
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      {/* Status summary */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-3 xl:grid-cols-5">
        {JOB_STATUSES.map((s) => {
          const style = STATUS_STYLES[s.key];
          return (
            <div key={s.key} className="card flex items-center gap-3 p-4">
              <span className={`grid h-9 w-9 flex-none place-items-center rounded-full ${style.badge}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-extrabold leading-none text-slate-900">
                  {totals[s.key]}
                </p>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{t(s.label)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search customer, installer, address…')}
            className="input w-72 max-w-full pl-8"
          />
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm font-semibold">
          {/* Named `f`, not `t` — shadowing the translate function here is
              what left these three buttons in English. */}
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'install', label: 'Installs' },
              { key: 'repair', label: 'Repairs' },
            ] as { key: 'all' | JobType; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              className={`rounded-md px-3 py-1.5 transition ${
                typeFilter === f.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
        {(query || typeFilter !== 'all') && (
          <p className="text-sm text-slate-500">
            {t('Showing')} {filtered.length} {t('of')} {jobs?.length ?? 0} {t('jobs')}
          </p>
        )}
      </div>

      {jobs === null ? (
        <p className="text-center text-sm text-slate-500">{t('Loading…')}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {/* Phones get a plain list: a sideways-scrolling board on a 6-inch
              screen shows one column at a time, which is the opposite of an
              overview, and dragging a card inside a scrolling strip fights
              the scroll. */}
          <MobileJobs
            byStatus={byStatus}
            totals={totals}
            installerOnly={installerOnly}
            isNew={seen.isNew}
            onEdit={(j) => {
              setError('');
              markJobSeen(j.id, changedAt(j));
              setEditing({ ...j });
            }}
            onView={(j) => {
              markJobSeen(j.id, changedAt(j));
              setViewing(j);
            }}
            onDelete={handleDelete}
            onMove={moveJob}
          />

          {/* Trello-style board: columns keep a readable width and the board
              scrolls sideways instead of squeezing the cards. The mouse
              wheel pans it sideways, and empty board space drags like a
              hand tool — nobody should have to hunt the scrollbar. */}
          <div
            ref={boardRef}
            onMouseDown={(e) => {
              const el = boardRef.current;
              if (!el || e.button !== 0) return;
              // Dragging a card, button or link must keep meaning that.
              const t = e.target as HTMLElement;
              if (t.closest('button, a, input, textarea, select, [draggable="true"]')) return;
              const startX = e.clientX;
              const startLeft = el.scrollLeft;
              let moved = false;
              const onMove = (ev: MouseEvent) => {
                const dx = ev.clientX - startX;
                if (Math.abs(dx) > 4) moved = true;
                if (moved) {
                  el.scrollLeft = startLeft - dx;
                  el.style.cursor = 'grabbing';
                  el.style.userSelect = 'none';
                }
              };
              const onUp = () => {
                el.style.cursor = '';
                el.style.userSelect = '';
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            className="-mx-1 hidden gap-4 overflow-x-auto px-1 pb-3 sm:flex"
          >
            {JOB_STATUSES.map((col) => (
              <div
                key={col.key}
                className="w-[290px] flex-none snap-start 2xl:w-auto 2xl:min-w-[280px] 2xl:flex-1"
              >
                <Column
                  status={col.key}
                  label={col.label}
                  jobs={byStatus[col.key]}
                  installerOnly={installerOnly}
                  isNew={seen.isNew}
                  onEdit={(j) => {
                    setError('');
                    markJobSeen(j.id, changedAt(j));
                    setEditing({ ...j });
                  }}
                  onView={(j) => {
                    markJobSeen(j.id, changedAt(j));
                    setViewing(j);
                  }}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
          <DragOverlay>{activeJob ? <JobCardView job={activeJob} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      {editing && (
        <JobDialog
          state={editing}
          setState={setEditing}
          installerEmails={installerEmails ?? []}
          installerNames={{ ...installerNames, ...staffNames }}
          canAssign={!installerOnly}
          assignPool={leaderPool}
          assignLocked={
            leaderPool && editing
              ? [
                  ...new Set([
                    myEmail,
                    ...editing.installerEmails.filter((e) => !leaderPool.includes(e)),
                  ]),
                ]
              : []
          }
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
          onPreview={previewInvoice}
        />
      )}

      {viewing && (
        <JobDetailsModal
          job={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setError('');
            setEditing({ ...viewing });
            setViewing(null);
          }}
          onPreviewInvoice={previewInvoice}
        />
      )}

      {invoicePreview && (
        <PdfPreviewModal url={invoicePreview} onClose={() => setInvoicePreview(null)} />
      )}

      {trashOpen && <JobsTrashModal onClose={() => setTrashOpen(false)} />}
    </div>
  );
}

/** Deleted jobs: put one back on the board, or let it go for good. */
function JobsTrashModal({ onClose }: { onClose: () => void }) {
  useScrollLock();
  const { t } = useLang();
  const staffName = useStaffName();
  const whoOn = (j: Job) =>
    j.installerEmails.length ? j.installerEmails.map(staffName).join(', ') : j.installer;
  // Restoring is safe, and anyone who can see the Trash may do it. Deleting
  // for good is the admin's alone — the database enforces that either way,
  // so this is about not offering a button that would be refused.
  const { isAdmin } = useAuth();
  const [deleted, setDeleted] = useState<Job[] | null>(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => subscribeDeletedJobs(setDeleted), []);

  async function act(job: Job, fn: (id: string) => Promise<void>) {
    setError('');
    setBusyId(job.id);
    try {
      await fn(job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusyId('');
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="font-bold text-slate-900">🗑️ {t('Trash')}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="space-y-3 p-5">
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
              {error}
            </p>
          )}
          {deleted === null ? (
            <p className="text-center text-sm text-slate-500">{t('Loading…')}</p>
          ) : deleted.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {t('The trash is empty.')}
            </p>
          ) : (
            deleted.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {job.customer || 'Unnamed'}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {[job.system, whoOn(job)].filter(Boolean).join(' — ') || t('No details')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {t('Deleted')}
                    {job.deletedBy ? ` ${t('by')} ${job.deletedBy}` : ''}
                    {job.deletedAtMs ? ` — ${fmtWhen(job.deletedAtMs)}` : ''}
                  </p>
                </div>
                <div className="flex flex-none gap-2">
                  <button
                    type="button"
                    disabled={busyId === job.id}
                    onClick={() => act(job, restoreJob)}
                    className="rounded-md border border-green-300 bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-800 hover:bg-green-100 disabled:opacity-50"
                  >
                    ♻️ {t('Restore')}
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={busyId === job.id}
                      onClick={() => {
                        if (
                          confirm(
                            `${t('Delete forever?')} ${job.customer || ''}\n${t('This cannot be undone.')}`,
                          )
                        )
                          act(job, destroyJob);
                      }}
                      className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                    >
                      {t('Delete forever')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  , document.body);
}

/**
 * The jobs board on a phone.
 *
 * The desktop board is five columns you drag cards between. Neither half of
 * that works on a small screen: only one column fits at a time, so there is
 * no overview, and dragging inside a horizontally scrolling strip fights
 * the scroll. Here the columns become filter chips and each job is a
 * full-width row you can actually read, with a menu to move it rather than
 * a drag.
 */
function MobileJobs({
  byStatus,
  totals,
  installerOnly,
  isNew,
  onEdit,
  onView,
  onDelete,
  onMove,
}: {
  byStatus: Record<JobStatus, Job[]>;
  totals: Record<JobStatus, number>;
  installerOnly: boolean;
  isNew: (job: Job) => boolean;
  onEdit: (j: Job) => void;
  onView: (j: Job) => void;
  onDelete: (j: Job) => void;
  onMove: (j: Job, status: JobStatus) => void;
}) {
  const { t } = useLang();
  const [only, setOnly] = useState<JobStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<Partial<Record<JobStatus, boolean>>>({});

  const shown = JOB_STATUSES.filter((s) => only === 'all' || s.key === only);
  const count = shown.reduce((n, s) => n + byStatus[s.key].length, 0);
  const allCount = JOB_STATUSES.reduce((n, s) => n + totals[s.key], 0);

  return (
    <div className="sm:hidden">
      {/* Which column to look at. This row scrolls sideways, but it is meant
          to — unlike the board it replaces. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3">
        <Chip active={only === 'all'} onClick={() => setOnly('all')} dot="bg-slate-400">
          {t('All')} {allCount}
        </Chip>
        {JOB_STATUSES.map((s) => (
          <Chip
            key={s.key}
            active={only === s.key}
            onClick={() => setOnly(s.key)}
            dot={STATUS_STYLES[s.key].dot}
            flag={byStatus[s.key].some(isNew)}
          >
            {t(s.label)} {totals[s.key]}
          </Chip>
        ))}
      </div>

      {count === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
          <p className="text-2xl">🛠️</p>
          <p className="mt-2 text-sm font-medium text-slate-500">{t('Nothing here.')}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {shown.map((s) =>
            byStatus[s.key].length === 0 ? null : (
              <section key={s.key}>
                {/* Only worth a heading when several columns are on screen. */}
                {only === 'all' && (
                  <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[s.key].dot}`} />
                    {t(s.label)}
                    <span className="text-slate-400">{byStatus[s.key].length}</span>
                  </h2>
                )}
                <div className="space-y-2.5">
                  {(expanded[s.key] ? byStatus[s.key] : byStatus[s.key].slice(0, 10)).map((job) => (
                    <MobileJobCard
                      key={job.id}
                      job={job}
                      installerOnly={installerOnly}
                      isNew={isNew(job)}
                      onEdit={() => onEdit(job)}
                      onView={() => onView(job)}
                      onDelete={() => onDelete(job)}
                      onMove={(status) => onMove(job, status)}
                    />
                  ))}
                  {byStatus[s.key].length > 10 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [s.key]: !e[s.key] }))}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 active:bg-slate-100"
                    >
                      {expanded[s.key]
                        ? `▲ ${t('Show less')}`
                        : `▼ ${t('Show more')} (${byStatus[s.key].length - 10})`}
                    </button>
                  )}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  dot,
  flag,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  /** Something in here changed since it was last looked at. */
  flag?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition ${
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {children}
      {flag && (
        <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
      )}
    </button>
  );
}

/** One job, sized for a thumb rather than a mouse. */
function MobileJobCard({
  job,
  installerOnly,
  isNew,
  onEdit,
  onView,
  onDelete,
  onMove,
}: {
  job: Job;
  installerOnly: boolean;
  isNew: boolean;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  onMove: (status: JobStatus) => void;
}) {
  const { t } = useLang();
  const isRepair = job.type === 'repair';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${isRepair ? 'bg-amber-400' : 'bg-brand-500'}`}
        aria-hidden="true"
      />
      <div className="p-3.5 ps-5">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              isRepair ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'
            }`}
          >
            {isRepair ? `🔧 ${t('Repair')}` : `⚡ ${t('Install')}`}
          </span>
          {job.invoiceUrl && <span title={t('Has an invoice')}>📄</span>}
          {isNew && (
            <span
              title={t('Changed since you last opened it')}
              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
              {t('New')}
            </span>
          )}
          {job.createdAtMs && (
            <span className="ms-auto text-xs text-slate-400">{fmtShort(job.createdAtMs)}</span>
          )}
        </div>

        <button type="button" onClick={onView} className="mt-2 block w-full text-start">
          <p className="truncate text-base font-bold leading-snug text-slate-900">
            {job.customer || t('Unnamed')}
          </p>
          {job.system && <p className="mt-0.5 truncate text-sm text-slate-600">{job.system}</p>}
          <p className="mt-1 truncate text-sm text-slate-500">
            👷 {job.installer || t('Unassigned')}
          </p>
          {job.address && <p className="mt-0.5 truncate text-sm text-slate-500">📍 {job.address}</p>}
        </button>

        {/* Moving a job is a menu here: dragging inside a scrolling page is a
            fight on a touchscreen. */}
        <label className="mt-3 block">
          <span className="sr-only">{t('Status')}</span>
          <select
            value={job.status}
            onChange={(e) => onMove(e.target.value as JobStatus)}
            className="input w-full py-2.5 text-sm font-semibold"
          >
            {JOB_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {t(s.label)}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onView}
            className="flex-1 rounded-lg border border-brand-200 bg-brand-50 py-2.5 text-sm font-bold text-brand-700"
          >
            👁 {t('Details')}
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('Edit')}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600"
          >
            ✏️
          </button>
          {!installerOnly && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={t('Delete')}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-500"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Column({
  status,
  label,
  jobs,
  installerOnly,
  isNew,
  onEdit,
  onView,
  onDelete,
}: {
  status: JobStatus;
  label: string;
  jobs: Job[];
  installerOnly: boolean;
  isNew: (job: Job) => boolean;
  onEdit: (j: Job) => void;
  onView: (j: Job) => void;
  onDelete: (j: Job) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { t } = useLang();
  const style = STATUS_STYLES[status];
  // Ten cards tell the story of a column; a hundred bury it. The rest
  // sit behind "Show more" — collapsing again when the column changes.
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (jobs.length <= 10) setShowAll(false);
  }, [jobs.length]);
  const visible = showAll ? jobs : jobs.slice(0, 10);
  return (
    <div
      ref={setNodeRef}
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition ${
        isOver ? 'ring-2 ring-brand-300' : ''
      }`}
    >
      <div className={`h-1.5 w-full ${style.dot}`} />
      <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
        <h2 className={`flex items-center gap-2 text-sm font-bold ${style.header}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
          {t(label)}
        </h2>
        <span className="flex items-center gap-1.5">
          {jobs.some(isNew) && (
            <span
              title={t('Something here changed since you last looked')}
              className="h-2 w-2 rounded-full bg-red-600"
            />
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>
            {jobs.length}
          </span>
        </span>
      </div>
      <div
        className={`min-h-[140px] flex-1 space-y-2.5 p-2.5 transition ${
          isOver ? style.over : 'bg-slate-50/60'
        }`}
      >
        {visible.map((j) => (
          <JobCard
            key={j.id}
            job={j}
            installerOnly={installerOnly}
            isNew={isNew(j)}
            onEdit={() => onEdit(j)}
            onView={() => onView(j)}
            onDelete={() => onDelete(j)}
          />
        ))}
        {jobs.length > 10 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            {showAll
              ? `▲ ${t('Show less')}`
              : `▼ ${t('Show more')} (${jobs.length - 10})`}
          </button>
        )}
        {jobs.length === 0 && (
          <div className="flex h-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
            <span className="text-lg">🛠️</span>
            <p className="mt-1 text-xs font-medium">{t('Drag jobs here')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({
  job,
  installerOnly,
  isNew,
  onEdit,
  onView,
  onDelete,
}: {
  job: Job;
  installerOnly: boolean;
  isNew: boolean;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-40' : ''}>
      <JobCardView
        job={job}
        installerOnly={installerOnly}
        isNew={isNew}
        dragListeners={listeners}
        dragAttributes={attributes}
        onEdit={onEdit}
        onView={onView}
        onDelete={onDelete}
      />
    </div>
  );
}

function JobCardView({
  job,
  installerOnly,
  isNew,
  dragListeners,
  dragAttributes,
  onEdit,
  onView,
  onDelete,
  overlay,
}: {
  job: Job;
  installerOnly?: boolean;
  isNew?: boolean;
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: DraggableAttributes;
  onEdit?: () => void;
  onView?: () => void;
  onDelete?: () => void;
  overlay?: boolean;
}) {
  const { t } = useLang();
  const isRepair = job.type === 'repair';
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white pl-1 transition ${
        overlay ? 'rotate-2 shadow-xl ring-2 ring-brand-200' : 'shadow-sm hover:shadow-md'
      }`}
    >
      {/* Type accent bar */}
      <span
        className={`absolute inset-y-0 left-0 w-1 ${isRepair ? 'bg-amber-400' : 'bg-brand-500'}`}
        aria-hidden="true"
      />
      {/* Compact by design: just who and what. Everything else — address,
          phone, notes, invoice, history — lives behind the Details button. */}
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1.5">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
              isRepair ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'
            }`}
          >
            {isRepair ? '🔧 repair' : '⚡ install'}
          </span>
          {isNew && (
            <span
              title={t('Changed since you last opened it')}
              className="h-2 w-2 flex-none rounded-full bg-red-600"
              aria-label={t('New')}
            />
          )}
          {job.createdAtMs && (
            <span
              className="ml-auto flex-none text-[10px] font-medium text-slate-400"
              title={`${t('Added')}: ${fmtWhen(job.createdAtMs)}${
                job.createdBy ? ` — ${job.createdBy}` : ''
              }`}
            >
              {fmtShort(job.createdAtMs)}
            </span>
          )}
          <button
            type="button"
            aria-label="Drag"
            className="-m-1 cursor-grab touch-none rounded p-1 text-[11px] leading-none text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
            {...dragListeners}
            {...dragAttributes}
          >
            ⠿
          </button>
        </div>

        <p className="mt-1 truncate text-sm font-bold leading-snug text-slate-900">
          {job.customer || 'Unnamed'}
        </p>
        {job.system && <p className="truncate text-[11px] text-slate-500">{job.system}</p>}

        <div className="mt-2 flex items-center justify-between gap-1.5 border-t border-slate-100 pt-2">
          <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
            {job.installer || 'Unassigned'}
            {job.invoiceUrl && <span title="Has an invoice"> · 📄</span>}
          </span>
          {!overlay && (
            <div className="flex flex-none items-center gap-1">
              <button
                type="button"
                onClick={onView}
                title="View all details"
                className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700 transition hover:bg-brand-100"
              >
                👁 {t('Details')}
              </button>
              <button
                type="button"
                onClick={onEdit}
                title="Edit job"
                className="rounded p-1 text-[11px] leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✏️
              </button>
              {/* Deleting stays with the office. */}
              {!installerOnly && (
                <button
                  type="button"
                  onClick={onDelete}
                  title="Delete job"
                  className="rounded p-1 text-[11px] leading-none text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  🗑️
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobDetailsModal({
  job,
  onClose,
  onEdit,
  onPreviewInvoice,
}: {
  job: Job;
  onClose: () => void;
  onEdit: () => void;
  onPreviewInvoice: (url: string) => void;
}) {
  useScrollLock();
  const { t } = useLang();
  const isRepair = job.type === 'repair';
  const statusMeta = JOB_STATUSES.find((s) => s.key === job.status);
  const style = STATUS_STYLES[job.status];
  const waze = wazeFromGoogleMaps(job.mapUrl, job.address);
  // Only the link someone actually saved: a search built from the written
  // address sends drivers wherever Google guesses, which isn't navigation.
  const gmaps = job.mapUrl.trim();
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="font-bold text-slate-900">{t('Job details')}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                isRepair ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'
              }`}
            >
              {isRepair ? `🔧 ${t('Repair')}` : `⚡ ${t('Install')}`}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${style.badge}`}>
              {t(statusMeta?.label ?? job.status)}
            </span>
          </div>

          <div>
            <p className="text-lg font-extrabold text-slate-900">{job.customer || t('Unnamed')}</p>
            {job.system && <p className="text-sm text-slate-600">{job.system}</p>}
          </div>

          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
            <DetailRow label="Phone">
              {job.phone ? (
                <a href={`tel:${job.phone}`} className="font-semibold text-brand-700 hover:underline">
                  {job.phone}
                </a>
              ) : (
                '—'
              )}
            </DetailRow>
            <DetailRow label="Address">{job.address || '—'}</DetailRow>
            <DetailRow label={job.installerEmails.length > 1 ? 'Installers' : 'Installer'}>
              {job.installer || t('Unassigned')}
              {job.installerEmails.length > 0 && (
                <span className="block text-xs text-slate-500">
                  {job.installerEmails.join(', ')}
                </span>
              )}
            </DetailRow>
            <DetailRow label="Notes">
              {job.notes ? <span className="whitespace-pre-wrap">{job.notes}</span> : '—'}
            </DetailRow>

          </dl>

          {(gmaps || waze || job.invoiceUrl) && (
            <div className="flex flex-wrap gap-2">
              {gmaps && (
                <a
                  href={gmaps}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary inline-flex items-center gap-1.5"
                >
                  🗺️ {t('Google Maps')}
                </a>
              )}
              {waze && (
                <a
                  href={waze}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary inline-flex items-center gap-1.5"
                >
                  🚗 {t('Waze')}
                </a>
              )}
              {job.invoiceUrl && (
                <button
                  type="button"
                  onClick={() => onPreviewInvoice(job.invoiceUrl)}
                  className="btn-secondary inline-flex items-center gap-1.5"
                >
                  📄 {t('Invoice')}
                </button>
              )}
            </div>
          )}

          <div className="border-t border-slate-200 pt-4">
            <JobActivity job={job} />
          </div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('Close')}
          </button>
          <button type="button" onClick={onEdit} className="btn-primary">
            {t('Edit job')}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useLang();
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-2.5">
      <dt className="text-slate-500">{t(label)}</dt>
      <dd className="col-span-2 text-slate-900">{children}</dd>
    </div>
  );
}

function JobDialog({
  state,
  setState,
  installerEmails,
  installerNames,
  canAssign,
  assignPool,
  assignLocked,
  busy,
  onCancel,
  onSave,
  onPreview,
}: {
  state: FormState;
  setState: (s: FormState) => void;
  installerEmails: string[];
  installerNames: Record<string, string>;
  /** Installers may edit their job but not hand it to someone else. */
  canAssign: boolean;
  /** A crew-leader installer may still assign from this pool. */
  assignPool?: string[] | null;
  /** Shown but untogglable — people this editor may not remove. */
  assignLocked?: string[];
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  onPreview: (url: string) => void;
}) {
  useScrollLock();
  const { t } = useLang();
  const installerName = (email: string) => installerNames[email] || prettyHandle(email);
  // Keep whoever is on the job listed even if their role was changed later,
  // so saving doesn't quietly unassign them.
  const pool = canAssign ? installerEmails : (assignPool ?? []);
  const options = [...pool, ...state.installerEmails.filter((e) => !pool.includes(e))];
  const locked = canAssign ? [] : (assignLocked ?? []);
  const keepsOldName = !state.installerEmails.length && !!state.installer.trim();

  /** Tick or untick one installer; the card's name line follows along. */
  function toggleInstaller(email: string) {
    if (locked.includes(email)) return;
    const next = state.installerEmails.includes(email)
      ? state.installerEmails.filter((e) => e !== email)
      : [...state.installerEmails, email];
    setState({ ...state, installerEmails: next, installer: next.map(installerName).join(', ') });
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="font-bold text-slate-900">{state.id ? t('Edit job') : t('New job')}</h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          {state.id && (state.createdBy || state.createdAtMs || state.updatedBy) && (
            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {(state.createdBy || state.createdAtMs) && (
                <p>
                  ➕ Added by <span className="font-semibold">{state.createdBy || 'unknown'}</span>
                  {state.createdAtMs ? ` on ${fmtWhen(state.createdAtMs)}` : ''}
                </p>
              )}
              {state.updatedBy && (
                <p className="mt-0.5">
                  ✏️ Last edited by <span className="font-semibold">{state.updatedBy}</span>
                  {state.updatedAtMs ? ` on ${fmtWhen(state.updatedAtMs)}` : ''}
                </p>
              )}
            </div>
          )}
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
                <option value="install">{t('Install')}</option>
                <option value="repair">{t('Repair')}</option>
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
          <Field label="Map link (Google Maps)">
            <input
              className="input"
              value={state.mapUrl}
              onChange={(e) => setState({ ...state, mapUrl: e.target.value })}
              placeholder={t('Paste a Google Maps link — Waze link is made automatically')}
            />
            {state.mapUrl.trim() &&
              (wazeFromGoogleMaps(state.mapUrl, state.address) ? (
                <p className="mt-1 text-xs font-medium text-green-700">
                  ✅ {t('Waze link will be created automatically from this')}
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-700">
                  {t("Couldn't read a location from this link — the Waze button will be hidden")}
                </p>
              ))}
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
            <Field label="Installers">
              {!canAssign && !assignPool ? (
                <p className="input bg-slate-50 text-slate-600">
                  {state.installer || 'Unassigned'}
                </p>
              ) : options.length > 0 ? (
                <InstallerPicker
                  options={options}
                  selected={state.installerEmails}
                  nameOf={installerName}
                  locked={locked}
                  onToggle={toggleInstaller}
                />
              ) : (
                <p className="rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                  {t('No installers yet — add one under Users, with the role “Installer”.')}
                </p>
              )}
              {/* A name typed in before installers had accounts: keep showing
                  it until someone is ticked, so saving doesn't wipe it. */}
              {keepsOldName && (
                <p className="mt-1 text-xs text-slate-500">
                  {t('Currently written down as')}{' '}
                  <span className="font-semibold">{state.installer}</span>
                </p>
              )}
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
                  {t(s.label)}
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
          <InvoiceField state={state} setState={setState} onPreview={onPreview} />
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
            {t('Cancel')}
          </button>
          <button type="button" onClick={onSave} className="btn-primary" disabled={busy}>
            {busy ? t('Saving…') : t('Save')}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

/**
 * Dropdown that picks any number of installers. It expands in place rather
 * than floating, so it can't get clipped by the dialog's own scrolling.
 */
function InstallerPicker({
  options,
  selected,
  nameOf,
  onToggle,
  locked = [],
}: {
  options: string[];
  selected: string[];
  nameOf: (email: string) => string;
  onToggle: (email: string) => void;
  /** Shown but not togglable — people this editor may not remove. */
  locked?: string[];
}) {
  const [open, setOpen] = useState(false);
  const label = selected.length ? selected.map(nameOf).join(', ') : 'Unassigned';
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${selected.length ? '' : 'text-slate-400'}`}>{label}</span>
        <span className="flex-none text-slate-400">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="mt-1 max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm">
          {options.map((email) => (
            <label
              key={email}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                locked.includes(email) ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(email)}
                disabled={locked.includes(email)}
                onChange={() => onToggle(email)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <span className="truncate">{nameOf(email)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceField({
  state,
  setState,
  onPreview,
}: {
  state: FormState;
  setState: (s: FormState) => void;
  onPreview: (url: string) => void;
}) {
  const { t } = useLang();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState('');

  async function handleFile(file: File) {
    setErr('');
    setUploading(true);
    try {
      const { url } = await uploadInvoice(file, state.id || undefined);
      setState({ ...state, invoiceUrl: url, invoiceName: file.name });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t('Invoice (PDF)')}
      </label>
      {state.invoiceUrl ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <span className="text-2xl">📄</span>
          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
            {state.invoiceName || 'invoice.pdf'}
          </span>
          <button
            type="button"
            onClick={() => onPreview(state.invoiceUrl)}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            {t('Preview')}
          </button>
          <button
            type="button"
            onClick={() => setState({ ...state, invoiceUrl: '', invoiceName: '' })}
            className="text-sm font-semibold text-red-700 hover:underline"
          >
            {t('Remove')}
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => fileInput.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center text-sm transition ${
            dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:bg-slate-50'
          }`}
        >
          {uploading ? (
            <span className="text-slate-600">{t('Uploading…')}</span>
          ) : (
            <>
              <span className="text-2xl">📄</span>
              <span className="mt-1 text-slate-600">
                {t('Drag & drop a PDF invoice here, or click to choose')}
              </span>
            </>
          )}
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
    </div>
  );
}

function PdfPreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  useScrollLock();
  const { t } = useLang();
  return createPortal(
    <div className="fixed inset-0 z-50 flex bg-slate-900/80 p-4" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <span className="text-sm font-semibold text-slate-800">{t('Invoice preview')}</span>
          <div className="flex gap-4 text-sm">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-700 hover:underline"
            >
              {t('Open in new tab')}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="font-semibold text-slate-600 hover:underline"
            >
              {t('Close')}
            </button>
          </div>
        </div>
        <iframe
          src={url.includes('#') ? url : `${url}#view=FitH`}
          title="Invoice preview"
          className="h-full w-full flex-1"
        />
      </div>
    </div>
  , document.body);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {useLang().t(label)}
      </label>
      {children}
    </div>
  );
}
