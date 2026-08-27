import { useEffect, useMemo, useRef, useState } from 'react';
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
} from '@dnd-kit/core';
import {
  CRM_STATUSES,
  CRM_TAGS,
  addContactNote,
  createContact,
  deleteContact,
  setContactStatus,
  subscribeContacts,
  telLink,
  upsertContact,
  waLink,
  type CrmContact,
  type CrmSection,
  type CrmStatus,
} from '../../lib/crmStore';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../lib/i18n';
import { useStaffName } from '../../lib/staffDirectory';
import { useScrollLock } from '../../lib/useScrollLock';

/**
 * The CRM board: leads move left to right until they are customers. Two
 * books — solar and computers — with per-person access assigned from the
 * Users page; admins see both. Cards work like the solar jobs board:
 * drag between columns on a computer, pick a status from a list on a
 * phone, tap a card for the full story.
 */

type FormState = CrmContact;

const EMPTY: FormState = {
  id: '',
  section: 'solar',
  name: '',
  phone: '',
  city: '',
  tag: 'Facebook',
  interest: '',
  status: 'new',
  notes: [],
  order: 0,
  createdBy: '',
  createdAtMs: null,
  updatedBy: '',
  updatedAtMs: null,
};

const STATUS_STYLES: Record<CrmStatus, { over: string; header: string; dot: string }> = {
  new: { over: 'bg-blue-50', header: 'text-blue-700', dot: 'bg-blue-500' },
  contacted: { over: 'bg-amber-50', header: 'text-amber-700', dot: 'bg-amber-500' },
  interested: { over: 'bg-violet-50', header: 'text-violet-700', dot: 'bg-violet-500' },
  quoted: { over: 'bg-cyan-50', header: 'text-cyan-700', dot: 'bg-cyan-500' },
  won: { over: 'bg-green-50', header: 'text-green-700', dot: 'bg-green-500' },
  lost: { over: 'bg-rose-50', header: 'text-rose-700', dot: 'bg-rose-500' },
};

const TAG_STYLES: Record<string, string> = {
  Facebook: 'bg-blue-100 text-blue-800',
  Instagram: 'bg-pink-100 text-pink-800',
  WhatsApp: 'bg-green-100 text-green-800',
  'Phone call': 'bg-amber-100 text-amber-800',
  'Walk-in': 'bg-slate-200 text-slate-700',
  Referral: 'bg-violet-100 text-violet-800',
  Website: 'bg-cyan-100 text-cyan-800',
  Other: 'bg-slate-100 text-slate-600',
};

function tagChip(tag: string): string {
  return TAG_STYLES[tag] ?? TAG_STYLES.Other;
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
  return new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminCrm() {
  const { t } = useLang();
  const { isAdmin, isCrmSolar, isCrmComputers } = useAuth();
  const sections = useMemo(
    () =>
      (
        [
          { key: 'solar', label: 'Solar', icon: '☀️', allowed: isCrmSolar },
          { key: 'computers', label: 'Computers', icon: '💻', allowed: isCrmComputers },
        ] as { key: CrmSection; label: string; icon: string; allowed: boolean }[]
      ).filter((s) => s.allowed),
    [isCrmSolar, isCrmComputers],
  );
  const [section, setSection] = useState<CrmSection>(sections[0]?.key ?? 'solar');
  // Access can arrive after first render (settings load) — snap to the
  // first allowed book if the current one isn't ours.
  useEffect(() => {
    if (sections.length && !sections.some((s) => s.key === section)) setSection(sections[0].key);
  }, [sections, section]);

  const [contacts, setContacts] = useState<CrmContact[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!sections.length) return;
    setContacts(null);
    setError('');
    return subscribeContacts(section, setContacts, (message) =>
      setError(
        message.includes('insufficient permissions')
          ? 'Access to these contacts was denied. Ask the admin to give you this book from the Users page.'
          : `Could not load contacts: ${message}`,
      ),
    );
  }, [section, sections.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const filtered = useMemo(() => {
    let list = contacts ?? [];
    if (tagFilter !== 'all') list = list.filter((c) => c.tag === tagFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.name, c.phone, c.city, c.interest, ...c.notes.map((n) => n.text)].some((v) =>
          v.toLowerCase().includes(q),
        ),
      );
    }
    return list;
  }, [contacts, tagFilter, query]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(CRM_STATUSES.map((s) => [s.key, [] as CrmContact[]])) as Record<
      CrmStatus,
      CrmContact[]
    >;
    for (const c of filtered) map[c.status]?.push(c);
    return map;
  }, [filtered]);

  const totals = useMemo(() => {
    const map = Object.fromEntries(CRM_STATUSES.map((s) => [s.key, 0])) as Record<CrmStatus, number>;
    for (const c of contacts ?? []) map[c.status] += 1;
    return map;
  }, [contacts]);

  // The details panel follows the live card, so a note someone else adds
  // appears while you are looking.
  const viewing = viewingId ? ((contacts ?? []).find((c) => c.id === viewingId) ?? null) : null;
  const activeContact = (contacts ?? []).find((c) => c.id === activeId) ?? null;

  // The board pans with the mouse wheel and by grabbing empty space,
  // same as the jobs board.
  const boardRef = useRef<HTMLDivElement>(null);
  const boardReady = contacts !== null;
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [boardReady]);

  function moveContact(contact: CrmContact, status: CrmStatus) {
    if (contact.status === status) return;
    setContactStatus(contact.id, status, Date.now()).catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not move the card.'),
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const contact = (contacts ?? []).find((c) => c.id === active.id);
    if (contact) moveContact(contact, over.id as CrmStatus);
  }

  async function handleSave() {
    if (!editing) return;
    setError('');
    setBusy(true);
    try {
      const payload = {
        section: editing.section,
        name: editing.name.trim(),
        phone: editing.phone.trim(),
        city: editing.city.trim(),
        tag: editing.tag,
        interest: editing.interest.trim(),
        status: editing.status,
        order: editing.order || Date.now(),
      };
      if (!payload.name) throw new Error('The customer needs a name.');
      if (editing.id) await upsertContact({ ...editing, ...payload });
      else await createContact(payload);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(contact: CrmContact) {
    if (!confirm(`Delete ${contact.name || 'this contact'} from the CRM? This cannot be undone.`))
      return;
    try {
      await deleteContact(contact.id);
      setViewingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  if (!sections.length) {
    return (
      <p className="card p-10 text-center text-sm text-slate-500">
        {t('The CRM has not been opened for your account yet — ask the admin.')}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('CRM')}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {t('Leads and customers — drag a card as the conversation moves.')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setEditing({ ...EMPTY, section, order: Date.now() });
          }}
          className="btn-primary"
        >
          + {t('Add contact')}
        </button>
      </header>

      {sections.length > 1 && (
        <div className="flex w-fit rounded-lg border border-slate-200 bg-white p-0.5 text-sm font-semibold">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={`rounded-md px-4 py-1.5 transition ${
                section === s.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s.icon} {t(s.label)}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search name, phone, notes…')}
            className="input w-64 ps-8"
          />
          <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
        </div>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="input w-auto">
          <option value="all">{t('All sources')}</option>
          {CRM_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {t(tag)}
            </option>
          ))}
        </select>
        {(query || tagFilter !== 'all') && (
          <p className="text-sm text-slate-500">
            {t('Showing')} {filtered.length} {t('of')} {contacts?.length ?? 0}
          </p>
        )}
      </div>

      {contacts === null ? (
        <p className="text-center text-sm text-slate-500">{t('Loading…')}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {/* Phone: status chips + a readable list, no dragging. */}
          <MobileCrm
            byStatus={byStatus}
            totals={totals}
            onView={(c) => setViewingId(c.id)}
            onMove={moveContact}
          />

          {/* Computer: the board. */}
          <div
            ref={boardRef}
            onMouseDown={(e) => {
              const el = boardRef.current;
              if (!el || e.button !== 0) return;
              const target = e.target as HTMLElement;
              if (target.closest('button, a, input, textarea, select, [aria-roledescription]')) return;
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
            {CRM_STATUSES.map((col) => (
              <div key={col.key} className="w-[280px] flex-none snap-start">
                <Column
                  status={col.key}
                  label={t(col.label)}
                  contacts={byStatus[col.key]}
                  onView={(c) => setViewingId(c.id)}
                />
              </div>
            ))}
          </div>

          <DragOverlay>
            {activeContact ? (
              <div className="rotate-2 opacity-95">
                <CardBody contact={activeContact} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {editing && (
        <ContactDialog
          state={editing}
          setState={setEditing}
          canPickSection={isAdmin && sections.length > 1}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {viewing && (
        <ContactDetails
          contact={viewing}
          canDelete={isAdmin}
          onClose={() => setViewingId(null)}
          onEdit={() => {
            setError('');
            setEditing({ ...viewing });
            setViewingId(null);
          }}
          onMove={(status) => moveContact(viewing, status)}
          onDelete={() => handleDelete(viewing)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The board                                                          */
/* ------------------------------------------------------------------ */

function Column({
  status,
  label,
  contacts,
  onView,
}: {
  status: CrmStatus;
  label: string;
  contacts: CrmContact[];
  onView: (c: CrmContact) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const style = STATUS_STYLES[status];
  return (
    <div
      ref={setNodeRef}
      className={`flex max-h-[72vh] min-h-[16rem] flex-col rounded-2xl border border-slate-200 bg-slate-50/80 transition ${
        isOver ? style.over : ''
      }`}
    >
      <div className="flex items-center gap-2 px-3.5 pb-2 pt-3">
        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        <span className={`text-sm font-extrabold ${style.header}`}>{label}</span>
        <span className="ms-auto rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
          {contacts.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2.5 pb-3">
        {contacts.map((c) => (
          <DraggableCard key={c.id} contact={c} onView={onView} />
        ))}
        {contacts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
            —
          </p>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ contact, onView }: { contact: CrmContact; onView: (c: CrmContact) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: contact.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-40' : ''}
    >
      <CardBody contact={contact} onView={onView} />
    </div>
  );
}

function CardBody({ contact, onView }: { contact: CrmContact; onView?: (c: CrmContact) => void }) {
  const lastNote = contact.notes[contact.notes.length - 1];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onView?.(contact)}
          className="min-w-0 flex-1 text-start"
        >
          <p className="truncate text-sm font-bold text-slate-900">{contact.name}</p>
          {contact.interest && (
            <p className="mt-0.5 truncate text-xs text-slate-600">{contact.interest}</p>
          )}
        </button>
        <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${tagChip(contact.tag)}`}>
          {contact.tag}
        </span>
      </div>

      {contact.phone && (
        <div className="mt-2 flex items-center gap-1.5" dir="ltr">
          <a
            href={telLink(contact.phone)}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
          >
            📞 <span className="truncate">{contact.phone}</span>
          </a>
          <a
            href={waLink(contact.phone)}
            target="_blank"
            rel="noreferrer"
            title="WhatsApp"
            className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-green-50 text-sm ring-1 ring-inset ring-green-200 hover:bg-green-100"
          >
            💬
          </a>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
        {contact.notes.length > 0 && <span>🗒 {contact.notes.length}</span>}
        {lastNote && <span className="min-w-0 flex-1 truncate">{lastNote.text}</span>}
        <span className="ms-auto flex-none">{fmtShort(contact.updatedAtMs ?? contact.createdAtMs)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The phone list                                                     */
/* ------------------------------------------------------------------ */

function MobileCrm({
  byStatus,
  totals,
  onView,
  onMove,
}: {
  byStatus: Record<CrmStatus, CrmContact[]>;
  totals: Record<CrmStatus, number>;
  onView: (c: CrmContact) => void;
  onMove: (c: CrmContact, status: CrmStatus) => void;
}) {
  const { t } = useLang();
  const [only, setOnly] = useState<CrmStatus | 'all'>('all');
  const shown = CRM_STATUSES.filter((s) => only === 'all' || s.key === only);
  const allCount = CRM_STATUSES.reduce((n, s) => n + totals[s.key], 0);

  return (
    <div className="sm:hidden">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3">
        <button
          type="button"
          onClick={() => setOnly('all')}
          className={`flex-none rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${
            only === 'all'
              ? 'bg-slate-900 text-white ring-slate-900'
              : 'bg-white text-slate-600 ring-slate-200'
          }`}
        >
          {t('All')} {allCount}
        </button>
        {CRM_STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setOnly(s.key)}
            className={`flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${
              only === s.key
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-white text-slate-600 ring-slate-200'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[s.key].dot}`} />
            {t(s.label)} {totals[s.key]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((s) =>
          byStatus[s.key].map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => onView(c)} className="min-w-0 flex-1 text-start">
                  <p className="truncate text-base font-bold text-slate-900">{c.name}</p>
                  {c.interest && <p className="mt-0.5 truncate text-sm text-slate-600">{c.interest}</p>}
                </button>
                <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${tagChip(c.tag)}`}>
                  {c.tag}
                </span>
              </div>
              {c.phone && (
                <div className="mt-2.5 flex items-center gap-2" dir="ltr">
                  <a
                    href={telLink(c.phone)}
                    className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white"
                  >
                    📞 {t('Call')}
                  </a>
                  <a
                    href={waLink(c.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white"
                  >
                    💬 WhatsApp
                  </a>
                </div>
              )}
              <label className="mt-2.5 block">
                <span className="sr-only">{t('Status')}</span>
                <select
                  value={c.status}
                  onChange={(e) => onMove(c, e.target.value as CrmStatus)}
                  className="input py-1.5 text-sm"
                >
                  {CRM_STATUSES.map((st) => (
                    <option key={st.key} value={st.key}>
                      {t(st.label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )),
        )}
        {shown.every((s) => byStatus[s.key].length === 0) && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            {t('No contacts here yet.')}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add / edit                                                         */
/* ------------------------------------------------------------------ */

function ContactDialog({
  state,
  setState,
  canPickSection,
  busy,
  onCancel,
  onSave,
}: {
  state: FormState;
  setState: (s: FormState) => void;
  canPickSection: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  useScrollLock();
  const { t } = useLang();
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState({ ...state, [key]: value });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="font-bold text-slate-900">
            {state.id ? t('Edit contact') : t('Add contact')}
          </h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="space-y-3.5 p-5">
          {canPickSection && (
            <Field label={t('Book')}>
              <div className="flex gap-2">
                {(
                  [
                    { key: 'solar', label: '☀️ Solar' },
                    { key: 'computers', label: '💻 Computers' },
                  ] as { key: CrmSection; label: string }[]
                ).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => set('section', s.key)}
                    className={`rounded-lg px-3.5 py-2 text-sm font-semibold ring-1 ring-inset ${
                      state.section === s.key
                        ? 'bg-slate-900 text-white ring-slate-900'
                        : 'bg-white text-slate-600 ring-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Field label={t('Name')}>
            <input
              value={state.name}
              onChange={(e) => set('name', e.target.value)}
              className="input"
              placeholder={t('Customer name')}
              autoFocus
            />
          </Field>
          <Field label={t('Phone')}>
            <input
              value={state.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="input"
              placeholder="07xx xxx xxxx"
              dir="ltr"
              inputMode="tel"
            />
          </Field>
          <Field label={t('Area / address')}>
            <input
              value={state.city}
              onChange={(e) => set('city', e.target.value)}
              className="input"
              placeholder={t('e.g. Baghdad, Mansour')}
            />
          </Field>
          <Field label={t('Source')}>
            <select
              value={state.tag}
              onChange={(e) => set('tag', e.target.value)}
              className="input"
            >
              {CRM_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {t(tag)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Interested in')}>
            <input
              value={state.interest}
              onChange={(e) => set('interest', e.target.value)}
              className="input"
              placeholder={t('e.g. 8kW hybrid system')}
            />
          </Field>
          <Field label={t('Status')}>
            <select
              value={state.status}
              onChange={(e) => set('status', e.target.value as CrmStatus)}
              className="input"
            >
              {CRM_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {t(s.label)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
            {t('Cancel')}
          </button>
          <button type="button" onClick={onSave} disabled={busy} className="btn-primary">
            {busy ? t('Saving…') : t('Save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Details + notes                                                    */
/* ------------------------------------------------------------------ */

function ContactDetails({
  contact,
  canDelete,
  onClose,
  onEdit,
  onMove,
  onDelete,
}: {
  contact: CrmContact;
  /** Only admins may erase a lead; the rules refuse everyone else anyway. */
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMove: (status: CrmStatus) => void;
  onDelete: () => void;
}) {
  useScrollLock();
  const { t } = useLang();
  const staffName = useStaffName();
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);
  const notesEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    notesEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [contact.notes.length]);

  async function postNote() {
    const text = note.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await addContactNote(contact.id, text);
      setNote('');
    } finally {
      setPosting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">{contact.name}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tagChip(contact.tag)}`}>
                {contact.tag}
              </span>
            </div>
            {contact.interest && <p className="mt-0.5 text-sm text-slate-600">{contact.interest}</p>}
            {contact.city && <p className="mt-0.5 text-xs text-slate-500">📍 {contact.city}</p>}
          </div>
          <button type="button" onClick={onClose} className="flex-none text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {contact.phone && (
            <div className="flex gap-2" dir="ltr">
              <a
                href={telLink(contact.phone)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
              >
                📞 {contact.phone}
              </a>
              <a
                href={waLink(contact.phone)}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700"
              >
                💬 WhatsApp
              </a>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t('Status')}
            </span>
            <select
              value={contact.status}
              onChange={(e) => onMove(e.target.value as CrmStatus)}
              className="input"
            >
              {CRM_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {t(s.label)}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              {t('Notes')}
            </p>
            {contact.notes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                {t('Nothing written yet — the first call goes here.')}
              </p>
            ) : (
              <div className="space-y-2">
                {contact.notes.map((n) => (
                  <div key={n.id || `${n.atMs}`} className="rounded-xl bg-slate-50 p-3">
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{n.text}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {staffName(n.by)} · {fmtWhen(n.atMs)}
                    </p>
                  </div>
                ))}
                <div ref={notesEnd} />
              </div>
            )}
            <div className="mt-2 flex items-end gap-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    postNote();
                  }
                }}
                rows={2}
                placeholder={t('Write what happened…')}
                className="input flex-1 resize-none text-sm"
              />
              <button
                type="button"
                onClick={postNote}
                disabled={posting || !note.trim()}
                className="btn-primary flex-none disabled:opacity-50"
              >
                {posting ? '…' : t('Add')}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            {t('Added')} {fmtWhen(contact.createdAtMs)}
            {contact.createdBy ? ` · ${staffName(contact.createdBy)}` : ''}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          {canDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-sm font-semibold text-red-700 hover:underline"
            >
              {t('Delete')}
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onEdit} className="btn-secondary">
            ✏️ {t('Edit')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
