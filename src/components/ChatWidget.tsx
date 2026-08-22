import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  chatReady,
  existingChatId,
  markGuestRead,
  sendGuestMessage,
  subscribeChatMessages,
  subscribeChatMeta,
  type ChatMessage,
} from '../lib/chatStore';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../lib/i18n';
import ChatProductCard from './ChatProductCard';

function timeText(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * The floating chat bubble visitors use to talk to the shop. Opens a small
 * panel over the page; messages arrive live. Hidden on the dashboard and for
 * staff — they answer from Admin → Messages instead.
 */
export default function ChatWidget() {
  const { t } = useLang();
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState(existingChatId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeChatMessages(chatId, setMessages), [chatId]);
  useEffect(
    () => subscribeChatMeta(chatId, (meta) => setUnread(meta?.unreadForGuest ?? 0)),
    [chatId],
  );

  // Opening the panel clears the visitor's unread badge; keep it cleared
  // while replies stream in with the panel open.
  useEffect(() => {
    if (open && chatId && unread > 0) markGuestRead(chatId);
  }, [open, chatId, unread]);

  // Follow the newest message.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, open]);

  // Everyone gets the bubble on the public site (staff too — handy for
  // checking what customers see); it only stays out of the dashboard.
  if (!chatReady() || location.pathname.startsWith('/admin')) return null;

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    try {
      const id = await sendGuestMessage(text, name);
      setChatId(id);
      setDraft('');
    } catch {
      setError(t('Could not send — check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-48 right-4 z-40 flex max-h-[70vh] md:bottom-24 w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-brand-700 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-bold">{t('Chat with us')}</p>
              <p className="text-xs text-brand-100">{t('We reply as soon as we can.')}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('Close')}
              className="rounded p-1 text-brand-100 hover:bg-brand-600 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div ref={scroller} className="min-h-[10rem] flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
            {messages.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500">
                {t('Ask us anything about products, prices, or an order — we read every message.')}
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === 'guest' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.from === 'guest'
                      ? 'rounded-br-sm bg-brand-600 text-white'
                      : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                  {m.product && (
                    <ChatProductCard product={m.product} onOpen={() => setOpen(false)} />
                  )}
                  <p
                    className={`mt-0.5 text-[10px] ${
                      m.from === 'guest' ? 'text-brand-100' : 'text-slate-400'
                    }`}
                  >
                    {m.from === 'staff' ? `${t('Support')} · ` : ''}
                    {timeText(m.atMs)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            {messages.length === 0 && !user && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Your name (optional)')}
                className="input mb-2 py-1.5 text-sm"
              />
            )}
            {error && <p className="mb-1 text-xs text-red-700">{error}</p>}
            <div className="flex items-end gap-2">
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
                placeholder={t('Type a message…')}
                className="input max-h-24 min-h-[2.5rem] flex-1 resize-none py-2 text-sm"
              />
              <button
                type="button"
                onClick={send}
                disabled={busy || !draft.trim()}
                className="btn-primary flex-none px-3 py-2 text-sm disabled:opacity-50"
              >
                {busy ? '…' : t('Send')}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('Chat with us')}
        className="fixed bottom-28 right-4 z-40 grid h-14 w-14 md:bottom-5 place-items-center rounded-full bg-brand-700 text-2xl text-white shadow-lg transition hover:scale-105 hover:bg-brand-600"
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-red-600 px-1.5 text-xs font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  );
}
