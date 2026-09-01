import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createTeamChat,
  addTeamMembers,
  renameTeamChat,
  deleteTeamChat,
  hasUnread,
  markTeamRead,
  deleteTeamMessage,
  editTeamMessage,
  sendTeamMessage,
  subscribeTeamChats,
  subscribeTeamMessages,
  type TeamChat,
  type TeamJobCard,
  type TeamMessage,
  setTeamReaction,
} from '../../lib/teamChatStore';
import { handleOf, prettyHandle, useStaffDirectory, useStaffName } from '../../lib/staffDirectory';
import { subscribeJobs, type Job } from '../../lib/jobsStore';
import { useProducts } from '../../lib/useProducts';
import { formatPrice } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../lib/i18n';
import ChatProductCard from '../../components/ChatProductCard';
import Reactions from '../../components/Reactions';
import type { ChatProductCard as ProductCard } from '../../lib/chatStore';

function timeText(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function whenText(ms: number | null): string {
  if (!ms) return '';
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Staff messaging: one-to-one chats and groups, with products and jobs. */
export default function AdminTeam() {
  const { t } = useLang();
  const { user, isAdmin } = useAuth();
  const me = user?.email?.toLowerCase() ?? '';
  const staff = useStaffDirectory();
  const nameOf = (email: string) =>
    staff.find((p) => p.email === email)?.name || prettyHandle(email);

  const [chats, setChats] = useState<TeamChat[] | null>(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [productPicker, setProductPicker] = useState(false);
  const [jobPicker, setJobPicker] = useState(false);
  const [attachedProduct, setAttachedProduct] = useState<ProductCard | null>(null);
  const [attachedJob, setAttachedJob] = useState<TeamJobCard | null>(null);
  // Fixing your own words, briefly: which message is being rewritten.
  const [editingMsg, setEditingMsg] = useState<{ id: string; text: string } | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const [mentionOpen, setMentionOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(
    () =>
      subscribeTeamChats(setChats, (message) =>
        setError(
          message.includes('insufficient permissions')
            ? 'Access denied. Make sure you are signed in with a staff account.'
            : `Could not load conversations: ${message}`,
        ),
      ),
    [],
  );
  useEffect(() => subscribeTeamMessages(activeId, setMessages), [activeId]);

  const active = useMemo(
    () => (chats ?? []).find((c) => c.id === activeId) ?? null,
    [chats, activeId],
  );

  useEffect(() => {
    if (active && hasUnread(active, me)) markTeamRead(active.id);
  }, [active, me]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  /** A chat's display name: the group's, or the other person's. */
  function titleOf(c: TeamChat): string {
    if (c.name) return c.name;
    if (c.isGroup) return c.members.map(nameOf).join(', ');
    return nameOf(c.members.find((m) => m !== me) ?? c.members[0] ?? '');
  }

  // @mention autocomplete, limited to the people in this conversation.
  const mentionQuery = (() => {
    const match = /@([\w.-]*)$/.exec(draft);
    return match ? match[1].toLowerCase() : null;
  })();
  const suggestions = (active?.members ?? [])
    .filter((m) => m !== me)
    .filter(
      (m) =>
        mentionQuery !== null &&
        (handleOf(m).includes(mentionQuery) ||
          nameOf(m).toLowerCase().includes(mentionQuery)),
    );

  function insertMention(email: string) {
    setDraft((d) => d.replace(/@([\w.-]*)$/, `@${handleOf(email)} `));
    setMentionOpen(false);
    box.current?.focus();
  }

  async function send() {
    const text = draft.trim();
    if ((!text && !attachedProduct && !attachedJob) || !activeId || busy) return;
    // Empty the box first; the message is already in the thread, greyed
    // until the server has it.
    const sentProduct = attachedProduct;
    const sentJob = attachedJob;
    setDraft('');
    setAttachedProduct(null);
    setAttachedJob(null);
    setBusy(true);
    setError('');
    try {
      // Tag anyone in this chat whose handle appears as @name.
      const mentions = (active?.members ?? []).filter((m) =>
        new RegExp(`@${handleOf(m)}\\b`, 'i').test(text),
      );
      await sendTeamMessage(activeId, text, {
        mentions,
        product: sentProduct,
        job: sentJob,
      });
    } catch (e) {
      setDraft((d) => d || text);
      setAttachedProduct(sentProduct);
      setAttachedJob(sentJob);
      setError(e instanceof Error ? e.message : 'Could not send the message.');
    } finally {
      setBusy(false);
    }
  }

  async function removeChat(c: TeamChat) {
    if (!confirm(`Delete "${titleOf(c)}" for everyone? This cannot be undone.`)) return;
    try {
      await deleteTeamChat(c.id);
      if (activeId === c.id) setActiveId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('Team chat')}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {t('Message colleagues, start a group, and point at a job or a product.')}
          </p>
        </div>
        <button type="button" onClick={() => setNewOpen(true)} className="btn-primary">
          {t('+ New chat')}
        </button>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px),1fr]">
        <div className={`card overflow-hidden ${activeId ? 'hidden lg:block' : ''}`}>
          {chats === null ? (
            <p className="p-6 text-center text-sm text-slate-500">{t('Loading…')}</p>
          ) : chats.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              {t('No conversations yet. Start one with “+ New chat”.')}
            </p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto lg:max-h-[calc(100dvh-14rem)]">
              {chats.map((c) => {
                const unread = hasUnread(c, me);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className={`flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition hover:bg-slate-50 ${
                        activeId === c.id ? 'bg-brand-50' : ''
                      }`}
                    >
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                        {c.isGroup ? '👥' : titleOf(c).charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-bold text-slate-900">
                            {titleOf(c)}
                          </span>
                          <span className="flex-none text-[10px] text-slate-400">
                            {whenText(c.lastAtMs)}
                          </span>
                        </span>
                        <span
                          className={`block truncate text-xs ${
                            unread ? 'font-semibold text-slate-800' : 'text-slate-500'
                          }`}
                        >
                          {c.lastBy === me ? `${t('You')}: ` : c.isGroup && c.lastBy ? `${nameOf(c.lastBy).split(' ')[0]}: ` : ''}
                          {c.lastText || t('No messages yet')}
                        </span>
                      </span>
                      {unread && (
                        <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-red-600" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={`card flex h-[calc(100dvh-23rem)] min-h-[22rem] flex-col overflow-hidden lg:h-[calc(100dvh-14rem)] ${activeId ? '' : 'hidden lg:flex'}`}>
          {!active ? (
            <p className="m-auto p-10 text-center text-sm text-slate-500">
              {t('Pick a conversation, or start a new one.')}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveId('')}
                    className="btn-secondary px-2 py-1 text-sm lg:hidden"
                  >
                    ←
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{titleOf(active)}</p>
                    <p className="truncate text-xs text-slate-500">
                      {active.members.length} {t('people')}
                      {active.isGroup ? ` · ${active.members.map(nameOf).join(', ')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    title={t('Add people')}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    ➕👤
                  </button>
                  {active.isGroup && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = prompt(t('Group name'), active.name);
                        if (next !== null && next.trim()) {
                          renameTeamChat(active.id, next).catch((e) =>
                            setError(e instanceof Error ? e.message : 'Could not rename.'),
                          );
                        }
                      }}
                      title={t('Rename group')}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      ✏️
                    </button>
                  )}
                  {(isAdmin || active.createdBy === me) && (
                    <button
                      type="button"
                      onClick={() => removeChat(active)}
                      title={t('Delete conversation')}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
                {messages.map((m) => {
                  const mine = m.by === me;
                  const taggedMe = m.mentions.includes(me);
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm transition-opacity ${
                          m.atMs === null ? 'opacity-60' : 'opacity-100'
                        } ${
                          mine
                            ? 'rounded-br-sm bg-brand-600 text-white'
                            : `rounded-bl-sm border bg-white text-slate-800 ${
                                taggedMe ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200'
                              }`
                        }`}
                      >
                        {!mine && active.isGroup && (
                          <p className="text-[11px] font-bold text-brand-700">{nameOf(m.by)}</p>
                        )}
                        {editingMsg?.id === m.id && (
                          <div className="min-w-[220px]">
                            <textarea
                              value={editingMsg.text}
                              onChange={(e) => setEditingMsg({ id: m.id, text: e.target.value })}
                              rows={2}
                              className="w-full rounded-lg border-0 p-2 text-sm text-slate-800"
                            />
                            <div className="mt-1 flex justify-end gap-3 text-[11px] font-bold">
                              <button type="button" className={mine ? 'text-brand-100' : 'text-slate-400'} onClick={() => setEditingMsg(null)}>
                                {t('Cancel')}
                              </button>
                              <button
                                type="button"
                                className="rounded bg-white/90 px-2 py-0.5 text-brand-700 ring-1 ring-brand-200"
                                onClick={() => {
                                  const text = editingMsg.text.trim();
                                  if (!text || !active) return;
                                  editTeamMessage(active.id, m.id, text).catch(() => undefined);
                                  setEditingMsg(null);
                                }}
                              >
                                {t('Save')}
                              </button>
                            </div>
                          </div>
                        )}
                        {editingMsg?.id !== m.id && m.text && (
                          <p className="whitespace-pre-wrap break-words">
                            {m.text.split(/(@[\w.-]+)/).map((part, i) =>
                              part.startsWith('@') ? (
                                <span
                                  key={i}
                                  className={`font-bold ${mine ? 'text-white' : 'text-brand-700'}`}
                                >
                                  {part}
                                </span>
                              ) : (
                                part
                              ),
                            )}
                          </p>
                        )}
                        {m.product && <ChatProductCard product={m.product} newTab />}
                        {m.job && <JobChip job={m.job} />}
                        <Reactions
                          dark={mine}
                          reactions={m.reactions}
                          onToggle={(emoji) => setTeamReaction(active.id, m.id, emoji)}
                        />
                        <p
                          className={`mt-0.5 text-[10px] ${mine ? 'text-brand-100' : 'text-slate-400'}`}
                        >
                          {timeText(m.atMs)}
                          {m.editedMs ? ` · ${t('edited')}` : ''}
                        </p>
                        {mine &&
                          m.atMs != null &&
                          Date.now() - m.atMs < 5 * 60_000 &&
                          editingMsg?.id !== m.id && (
                            <div className="mt-1 flex justify-end gap-3 text-[10px] font-bold text-brand-100">
                              <button type="button" onClick={() => setEditingMsg({ id: m.id, text: m.text })}>
                                ✏️ {t('Edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Delete this message?') && active)
                                    deleteTeamMessage(active.id, m.id).catch(() => undefined);
                                }}
                              >
                                🗑 {t('Delete')}
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-200 p-3">
                {(attachedProduct || attachedJob) && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {attachedProduct && (
                      <span className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1.5 text-xs">
                        📦 <span className="max-w-[12rem] truncate">{attachedProduct.name}</span>
                        <button type="button" onClick={() => setAttachedProduct(null)}>
                          ✕
                        </button>
                      </span>
                    )}
                    {attachedJob && (
                      <span className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1.5 text-xs">
                        🛠️ <span className="max-w-[12rem] truncate">{attachedJob.customer}</span>
                        <button type="button" onClick={() => setAttachedJob(null)}>
                          ✕
                        </button>
                      </span>
                    )}
                  </div>
                )}
                <div className="relative flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setProductPicker(true)}
                    title={t('Send a product')}
                    className="btn-secondary flex-none px-2.5 py-2 text-sm"
                  >
                    📦
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobPicker(true)}
                    title={t('Send a job')}
                    className="btn-secondary flex-none px-2.5 py-2 text-sm"
                  >
                    🛠️
                  </button>
                  <textarea
                    ref={box}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setMentionOpen(/@([\w.-]*)$/.test(e.target.value));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    placeholder={t('Message… use @ to tag someone')}
                    className="input max-h-28 min-h-[2.5rem] flex-1 resize-none py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={busy || (!draft.trim() && !attachedProduct && !attachedJob)}
                    className="btn-primary flex-none px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {busy ? '…' : t('Send')}
                  </button>
                  {mentionOpen && suggestions.length > 0 && (
                    <ul className="absolute bottom-full left-16 z-10 mb-1 max-h-40 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {suggestions.map((email) => (
                        <li key={email}>
                          <button
                            type="button"
                            onClick={() => insertMention(email)}
                            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                          >
                            <span className="font-semibold text-slate-800">{nameOf(email)}</span>{' '}
                            <span className="text-xs text-slate-400">@{handleOf(email)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {addOpen && active && (
        <NewChatDialog
          title={t('Add people')}
          confirmLabel={t('Add to conversation')}
          staff={staff.filter((p) => p.email !== me && !active.members.includes(p.email))}
          onClose={() => setAddOpen(false)}
          onCreate={async (emails) => {
            try {
              await addTeamMembers(active.id, emails);
              setAddOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not add them.');
            }
          }}
        />
      )}
      {newOpen && (
        <NewChatDialog
          staff={staff.filter((p) => p.email !== me)}
          onClose={() => setNewOpen(false)}
          onCreate={async (emails, name) => {
            try {
              const id = await createTeamChat(emails, name, chats ?? []);
              setActiveId(id);
              setNewOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not start the chat.');
            }
          }}
        />
      )}
      {productPicker && (
        <ProductPicker
          onClose={() => setProductPicker(false)}
          onPick={(p) => {
            setAttachedProduct(p);
            setProductPicker(false);
          }}
        />
      )}
      {jobPicker && (
        <JobPicker
          onClose={() => setJobPicker(false)}
          onPick={(j) => {
            setAttachedJob(j);
            setJobPicker(false);
          }}
        />
      )}
    </div>
  );
}

/** A solar job pointed at from a message. */
function JobChip({ job }: { job: TeamJobCard }) {
  const { t } = useLang();
  return (
    <Link
      to="/admin/jobs"
      className="mt-1.5 flex w-56 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-brand-300"
    >
      <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-amber-100 text-lg">
        🛠️
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-slate-900">{job.customer}</span>
        {job.system && (
          <span className="block truncate text-[11px] text-slate-500">{job.system}</span>
        )}
        <span className="mt-0.5 block text-[11px] font-semibold text-brand-700 underline">
          {t('Open in Solar Jobs')} →
        </span>
      </span>
    </Link>
  );
}

function NewChatDialog({
  staff,
  onClose,
  onCreate,
  title,
  confirmLabel,
}: {
  staff: { email: string; name: string; role: string }[];
  onClose: () => void;
  onCreate: (emails: string[], name: string) => void;
  /** Reused as the "add people" picker: these override its words. */
  title?: string;
  confirmLabel?: string;
}) {
  const { t } = useLang();
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('');

  const toggle = (email: string) =>
    setPicked((p) => (p.includes(email) ? p.filter((e) => e !== email) : [...p, email]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">{title ?? t('New chat')}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {staff.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              {t('No colleagues yet — add staff under Users.')}
            </p>
          ) : (
            staff.map((p) => (
              <label
                key={p.email}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={picked.includes(p.email)}
                  onChange={() => toggle(p.email)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {p.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{p.role}</span>
                </span>
              </label>
            ))
          )}
        </div>
        {picked.length > 1 && !confirmLabel && (
          <div className="border-t border-slate-100 px-5 py-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Group name (optional)')}
              className="input"
            />
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={() => onCreate(picked, name)}
            disabled={picked.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            {confirmLabel ?? (picked.length > 1 ? t('Create group') : t('Start chat'))}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductPicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (p: ProductCard) => void;
}) {
  const { t } = useLang();
  const { products, loading } = useProducts();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? products.filter((p) =>
          [p.name, p.brand, p.category].some((v) => String(v).toLowerCase().includes(q)),
        )
      : products;
    return list.slice(0, 40);
  }, [products, query]);

  return (
    <PickerShell title={`📦 ${t('Send a product')}`} onClose={onClose}>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('Search by name, brand, or category')}
        className="input mb-2"
      />
      {loading ? (
        <p className="p-6 text-center text-sm text-slate-500">{t('Loading…')}</p>
      ) : results.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">{t('No products found.')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    currency: p.currency,
                    image: p.image,
                  })
                }
                className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-slate-50"
              >
                <img
                  src={p.image}
                  alt=""
                  loading="lazy"
                  className="h-11 w-11 flex-none rounded-md border border-slate-200 object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {p.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{p.brand}</span>
                </span>
                <span className="flex-none text-sm font-bold text-brand-700">
                  {formatPrice(p.price, p.currency)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PickerShell>
  );
}

function JobPicker({ onClose, onPick }: { onClose: () => void; onPick: (j: TeamJobCard) => void }) {
  const { t } = useLang();
  const staffName = useStaffName();
  const whoOn = (j: Job) =>
    j.installerEmails.length ? j.installerEmails.map(staffName).join(', ') : j.installer;
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => subscribeJobs(setJobs), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (jobs ?? []).filter((j) =>
      q ? [j.customer, j.system, j.address, j.installer].some((v) => v.toLowerCase().includes(q)) : true,
    );
    return list.slice(0, 40);
  }, [jobs, query]);

  return (
    <PickerShell title={`🛠️ ${t('Send a job')}`} onClose={onClose}>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('Search customer, installer, address…')}
        className="input mb-2"
      />
      {jobs === null ? (
        <p className="p-6 text-center text-sm text-slate-500">{t('Loading…')}</p>
      ) : results.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">{t('No jobs found.')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {results.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    id: j.id,
                    customer: j.customer || 'Unnamed',
                    system: j.system,
                    status: j.status,
                  })
                }
                className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-amber-100">
                  {j.type === 'repair' ? '🔧' : '⚡'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {j.customer || t('Unnamed')}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {[j.system, whoOn(j)].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PickerShell>
  );
}

function PickerShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}
