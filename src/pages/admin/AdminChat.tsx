import { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteChat,
  markStaffRead,
  sendStaffReply,
  subscribeChatMessages,
  subscribeChats,
  type ChatMessage,
  type ChatMeta,
} from '../../lib/chatStore';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../lib/i18n';

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
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Who a conversation is with, best identity first. */
function chatTitle(c: ChatMeta): string {
  return c.name || c.email || 'Visitor';
}

/** Live chat inbox: conversations on the left, the open thread on the right. */
export default function AdminChat() {
  const { t } = useLang();
  const { isAdmin } = useAuth();
  const [chats, setChats] = useState<ChatMeta[] | null>(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
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
    if (!text || !activeId || busy) return;
    setBusy(true);
    setError('');
    try {
      await sendStaffReply(activeId, text);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reply.');
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
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">{t('Messages')}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {chats === null
            ? t('Loading…')
            : chats.length === 0
              ? t('Conversations from the chat bubble on the website appear here.')
              : `${chats.length} ${t('conversations')}${totalUnread ? ` · ${totalUnread} ${t('unread')}` : ''}`}
        </p>
      </header>

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
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
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
        <div className={`card flex min-h-[50vh] flex-col overflow-hidden ${activeId ? '' : 'hidden lg:flex'}`}>
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
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        m.from === 'staff'
                          ? 'rounded-br-sm bg-brand-600 text-white'
                          : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p
                        className={`mt-0.5 text-[10px] ${
                          m.from === 'staff' ? 'text-brand-100' : 'text-slate-400'
                        }`}
                      >
                        {m.from === 'staff' && m.by ? `${m.by.split('@')[0]} · ` : ''}
                        {timeText(m.atMs)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-2 border-t border-slate-200 p-3">
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
                  disabled={busy || !draft.trim()}
                  className="btn-primary flex-none px-4 py-2 text-sm disabled:opacity-50"
                >
                  {busy ? '…' : t('Send')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
