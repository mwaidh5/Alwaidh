import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  deleteChat,
  deleteStaffMessage,
  editStaffMessage,
  markStaffRead,
  sendStaffReply,
  subscribeChatMessages,
  subscribeChats,
  type ChatMessage,
  type ChatMeta,
  type ChatProductCard as ProductCard,
} from '../../lib/chatStore';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loadAssistantConfig, saveAssistantConfig } from '../../lib/assistantStore';
import { useLang } from '../../lib/i18n';
import { useSettings } from '../../lib/useSettings';
import { useScrollLock } from '../../lib/useScrollLock';
import { useProducts } from '../../lib/useProducts';
import { formatPrice } from '../../lib/format';
import ChatProductCard from '../../components/ChatProductCard';
import ChatPlaceCard from '../../components/ChatPlaceCard';
import { SHOP_LOCATION } from '../../lib/shopLocation';

function whenText(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function timeText(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Who a conversation is with, best identity first. */
function chatTitle(c: ChatMeta): string {
  return c.name || c.email || 'Visitor';
}

/** Live chat inbox: conversations on the left, the open thread on the right. */
export default function AdminChat() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Fixing your own words, briefly: which message is being rewritten.
  const [editingMsg, setEditingMsg] = useState<{ id: string; text: string } | null>(null);
  // A ticking clock so the edit buttons retire on time.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const { t } = useLang();
  const staffNames = useSettings().staffNames ?? {};
  const { isAdmin, user } = useAuth();
  const myEmail = user?.email?.toLowerCase() ?? '';
  const [chats, setChats] = useState<ChatMeta[] | null>(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  // ?c=<id> — a notification pointing at one conversation opens it.
  const search = useLocation().search;
  useEffect(() => {
    const wanted = new URLSearchParams(search).get('c');
    if (wanted) setActiveId(wanted);
  }, [search]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  // A product staged to go with the next reply, and the picker itself.
  const [attached, setAttached] = useState<ProductCard | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribeChats(setChats, (message) =>
        setError(
          message.includes('insufficient permissions')
            ? 'Access to chats was denied. Make sure you are signed in with a staff account.'
            : `Could not load chats: ${message}`,
        ),
      ),
    [],
  );

  useEffect(() => subscribeChatMessages(activeId, setMessages), [activeId]);

  const active = useMemo(
    () => (chats ?? []).find((c) => c.id === activeId) ?? null,
    [chats, activeId],
  );

  // Opening a conversation (or receiving into an open one) marks it read.
  useEffect(() => {
    if (active && active.unreadForStaff > 0) markStaffRead(active.id);
  }, [active]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  async function reply() {
    const text = draft.trim();
    if ((!text && !attached) || !activeId || busy) return;
    // Empty the box first: the reply is already in the thread, greyed
    // until the server confirms it.
    const sentAttachment = attached;
    setDraft('');
    setAttached(null);
    setBusy(true);
    setError('');
    try {
      await sendStaffReply(activeId, text, sentAttachment);
    } catch (e) {
      setDraft((d) => d || text);
      setAttached(sentAttachment);
      setError(e instanceof Error ? e.message : 'Could not send the reply.');
    } finally {
      setBusy(false);
    }
  }

  /** One tap: the shop's pin goes over as a card the customer can open in
   *  their maps app. */
  async function sendLocation() {
    if (!activeId || busy) return;
    setBusy(true);
    setError('');
    try {
      await sendStaffReply(activeId, '', null, SHOP_LOCATION);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the location.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(chat: ChatMeta) {
    if (!confirm(`Delete the conversation with ${chatTitle(chat)}? This cannot be undone.`)) return;
    try {
      await deleteChat(chat.id);
      if (activeId === chat.id) setActiveId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  const totalUnread = (chats ?? []).reduce((sum, c) => sum + c.unreadForStaff, 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{t('Messages')}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {chats === null
            ? t('Loading…')
            : chats.length === 0
              ? t('Conversations from the chat bubble on the website appear here.')
              : `${chats.length} ${t('conversations')}${totalUnread ? ` · ${totalUnread} ${t('unread')}` : ''}`}
        </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            🤖 Chat AI
          </button>
        )}
      </header>

      {assistantOpen && <AssistantModal onClose={() => setAssistantOpen(false)} />}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px),1fr]">
        {/* Conversation list — on phones it hides while a thread is open. */}
        <div className={`card overflow-hidden ${activeId ? 'hidden lg:block' : ''}`}>
          {chats === null ? (
            <p className="p-6 text-center text-sm text-slate-500">{t('Loading…')}</p>
          ) : chats.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">{t('No conversations yet.')}</p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto lg:max-h-[calc(100dvh-14rem)]">
              {chats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition hover:bg-slate-50 ${
                      activeId === c.id ? 'bg-brand-50' : ''
                    }`}
                  >
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                      {chatTitle(c).charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-bold text-slate-900">
                          {chatTitle(c)}
                        </span>
                        <span className="flex-none text-[10px] text-slate-400">
                          {whenText(c.lastAtMs)}
                        </span>
                      </span>
                      <span
                        className={`block truncate text-xs ${
                          c.unreadForStaff ? 'font-semibold text-slate-800' : 'text-slate-500'
                        }`}
                      >
                        {c.lastFrom === 'staff' ? `${t('You')}: ` : ''}
                        {c.lastText}
                      </span>
                    </span>
                    {c.unreadForStaff > 0 && (
                      <span className="mt-1 grid h-5 min-w-5 flex-none place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                        {c.unreadForStaff > 99 ? '99+' : c.unreadForStaff}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Open thread */}
        <div className={`card flex h-[calc(100dvh-23rem)] min-h-[22rem] flex-col overflow-hidden lg:h-[calc(100dvh-14rem)] ${activeId ? '' : 'hidden lg:flex'}`}>
          {!active ? (
            <p className="m-auto p-10 text-center text-sm text-slate-500">
              {t('Pick a conversation to read and reply.')}
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
                    <p className="truncate text-sm font-bold text-slate-900">{chatTitle(active)}</p>
                    {active.email && (
                      <p className="truncate text-xs text-slate-500">{active.email}</p>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => remove(active)}
                    title={t('Delete conversation')}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    🗑️
                  </button>
                )}
              </div>

              <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.from === 'staff' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm transition-opacity ${
                        m.from === 'staff'
                          ? 'rounded-br-sm bg-brand-600 text-white'
                          : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                      } ${m.atMs === null ? 'opacity-60' : 'opacity-100'}`}
                    >
                      {editingMsg?.id === m.id ? (
                        <div className="min-w-[220px]">
                          <textarea
                            value={editingMsg.text}
                            onChange={(e) => setEditingMsg({ id: m.id, text: e.target.value })}
                            rows={2}
                            className="w-full rounded-lg border-0 p-2 text-sm text-slate-800"
                          />
                          <div className="mt-1 flex justify-end gap-3 text-[11px] font-bold">
                            <button type="button" className="text-brand-100" onClick={() => setEditingMsg(null)}>
                              {t('Cancel')}
                            </button>
                            <button
                              type="button"
                              className="rounded bg-white/90 px-2 py-0.5 text-brand-700"
                              onClick={() => {
                                const text = editingMsg.text.trim();
                                if (!text) return;
                                editStaffMessage(activeId, m.id, text).catch(() => undefined);
                                setEditingMsg(null);
                              }}
                            >
                              {t('Save')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      )}
                      {m.product && <ChatProductCard product={m.product} newTab />}
                      {m.place && <ChatPlaceCard place={m.place} />}
                      <p
                        className={`mt-0.5 text-[10px] ${
                          m.from === 'staff' ? 'text-brand-100' : 'text-slate-400'
                        }`}
                      >
                        {m.from === 'staff' && (m.byName || m.by) ? `${staffNames[m.by] || m.byName || m.by.split('@')[0]} · ` : ''}
                        {timeText(m.atMs)}
                        {m.editedMs ? ` · ${t('edited')}` : ''}
                      </p>
                      {m.from === 'staff' &&
                        m.by === myEmail &&
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
                                if (confirm('Delete this message?'))
                                  deleteStaffMessage(activeId, m.id).catch(() => undefined);
                              }}
                            >
                              🗑 {t('Delete')}
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 p-3">
                {attached && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 p-2">
                    {attached.image && (
                      <img src={attached.image} alt="" className="h-10 w-10 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">{attached.name}</p>
                      <p className="text-xs text-brand-700">
                        {formatPrice(attached.price, attached.currency)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttached(null)}
                      title={t('Remove')}
                      className="flex-none px-1 text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    title={t('Send a product')}
                    className="btn-secondary flex-none px-3 py-2 text-sm"
                  >
                    📦
                  </button>
                  <button
                    type="button"
                    onClick={sendLocation}
                    disabled={busy}
                    title={t('Send our location')}
                    className="btn-secondary flex-none px-3 py-2 text-sm disabled:opacity-50"
                  >
                    📍
                  </button>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        reply();
                      }
                    }}
                    rows={1}
                    placeholder={t('Write a reply…')}
                    className="input max-h-28 min-h-[2.5rem] flex-1 resize-none py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={reply}
                    disabled={busy || (!draft.trim() && !attached)}
                    className="btn-primary flex-none px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {busy ? '…' : t('Send')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {pickerOpen && (
        <ProductPicker
          onClose={() => setPickerOpen(false)}
          onPick={(p) => {
            setAttached(p);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Search the catalogue and pick one product to send into the chat. */
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
          [p.name, p.brand, p.category, ...(p.subcategories ?? [])].some((v) =>
            String(v).toLowerCase().includes(q),
          ),
        )
      : products;
    return list.slice(0, 40);
  }, [products, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">📦 {t('Send a product')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 flex-none place-items-center rounded-full text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            ✕
          </button>
        </div>
        <div className="border-b border-slate-100 p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search by name, brand, or category')}
            className="input"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
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
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
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
        </div>
      </div>
    </div>
  );
}

/**
 * Where the owner teaches the assistant: an on/off switch and a page of
 * notes in plain language. The Teach tab is a conversation with the
 * bot itself: ask it what it knows, test it, correct it — facts the
 * owner states are saved into the same notes the customer-facing bot
 * answers from, so a correction here teaches the real thing.
 */
function AssistantModal({ onClose }: { onClose: () => void }) {
  // Registers as a modal (hides the floating tab bar, freezes the page)
  // — without it the bar sat on top of the composer.
  useScrollLock();
  const [tab, setTab] = useState<'teach' | 'notes'>('teach');
  const [enabled, setEnabled] = useState(false);
  const [knowledge, setKnowledge] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // The training conversation — this session only, never shown to customers.
  const [talk, setTalk] = useState<
    { role: 'user' | 'assistant'; content: string; learned?: string[] }[]
  >([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAssistantConfig()
      .then((cfg) => {
        setEnabled(cfg.enabled);
        setKnowledge(cfg.knowledge);
        setLoaded(true);
      })
      .catch(() => setMsg('Could not load the settings.'));
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [talk, thinking]);

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      await saveAssistantConfig({ enabled, knowledge });
      setMsg('Saved. The assistant uses the new notes on its very next reply.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEnabled(next: boolean) {
    setEnabled(next);
    try {
      await saveAssistantConfig({ enabled: next, knowledge });
    } catch {
      /* the Save button in Notes still covers it */
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || thinking) return;
    const next = [...talk, { role: 'user' as const, content: text }];
    setTalk(next);
    setDraft('');
    setThinking(true);
    setMsg('');
    try {
      const { firebaseApp } = await import('../../firebase');
      if (!firebaseApp) throw new Error('Not connected.');
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const call = httpsCallable(getFunctions(firebaseApp, 'me-central1'), 'teachAssistant');
      const res = await call({
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      const data = res.data as { reply: string; learned: string[] };
      setTalk((t) => [
        ...t,
        { role: 'assistant', content: data.reply, learned: data.learned ?? [] },
      ]);
      if (data.learned?.length) {
        // The bot wrote its own notes — show the fresh page in the other tab.
        const cfg = await loadAssistantConfig();
        setKnowledge(cfg.knowledge);
      }
    } catch (e) {
      setTalk((t) => t.slice(0, -1));
      setDraft(text);
      setMsg(e instanceof Error ? e.message : 'The assistant did not answer — try again.');
    } finally {
      setThinking(false);
    }
  }

  // A portal, not in-place: inside the page it sat under the sticky
  // header and the tab bar on phones.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-0 sm:p-4"
      onClick={onClose}
    >
      {/* A phone gets the whole screen — 88vh of dialog left the composer
          under the keyboard and nothing fit. dvh, not vh: iOS's vh ignores
          its own toolbars. */}
      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-xl sm:h-[85vh] sm:max-w-2xl sm:rounded-xl"
        // Clear of the status bar above and the home indicator below —
        // without the top inset the ✕ hid under the iPhone's clock.
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">🤖 Chat AI</h2>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => saveEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              Answer customers
            </label>
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
              ✕
            </button>
          </div>
        </div>

        <div className="flex border-b border-slate-200 text-sm font-semibold">
          {(
            [
              { key: 'teach', label: '🎓 Teach it' },
              { key: 'notes', label: '📒 Its notes' },
            ] as { key: typeof tab; label: string }[]
          ).map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setTab(x.key)}
              className={`px-4 py-2.5 transition ${
                tab === x.key
                  ? 'border-b-2 border-brand-600 text-brand-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        {tab === 'teach' ? (
          <>
            <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
              {talk.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-500">
                  <p className="font-semibold">Talk to it like a new employee.</p>
                  <p className="mt-1.5 text-xs leading-relaxed">
                    Ask: «شنو تعرف عن التوصيل؟» — test it: «شكد سعر منظومة 20 امبير؟» —
                    correct it: «لا، التوصيل داخل بغداد 5,000».
                    <br />
                    Whatever you teach it here is saved and used with real customers.
                  </p>
                </div>
              )}
              {talk.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      m.role === 'user'
                        ? 'rounded-br-sm bg-brand-600 text-white'
                        : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    {!!m.learned?.length && (
                      <div className="mt-1.5 space-y-1">
                        {m.learned.map((f, n) => (
                          <p
                            key={n}
                            className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold text-green-800"
                          >
                            📝 {f}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">
                    …
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-end gap-2 border-t border-slate-200 p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask it something, or teach it a fact…"
                className="input max-h-28 min-h-[2.5rem] flex-1 resize-none py-2 text-sm"
              />
              <button
                type="button"
                onClick={send}
                disabled={thinking || !draft.trim()}
                className="btn-primary flex-none px-4 py-2 text-sm disabled:opacity-50"
              >
                Send
              </button>
            </div>
            {msg && <p className="border-t border-slate-100 px-4 py-2 text-xs text-red-700">{msg}</p>}
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              <p className="text-xs text-slate-500">
                Everything it may claim, one fact per line — corrections from the Teach tab land
                here automatically. It also knows every product price and the solar sheets on its
                own, and never invents what isn't written.
              </p>
              <textarea
                value={knowledge}
                onChange={(e) => setKnowledge(e.target.value)}
                rows={14}
                className="input min-h-[18rem] w-full font-normal"
                disabled={!loaded}
              />
              {msg && (
                <p className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
                  {msg}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
              <p className="text-[11px] text-slate-400">
                The bot goes quiet for 10 minutes whenever a real person replies in a chat.
              </p>
              <button type="button" onClick={save} disabled={busy || !loaded} className="btn-primary">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
