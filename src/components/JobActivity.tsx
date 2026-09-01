import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addJobComment,
  setJobReaction,
  subscribeJobActivity,
  type Job,
  type JobAttachment,
  type JobEvent,
} from '../lib/jobsStore';
import { uploadJobCommentFile } from '../lib/imageUpload';
import Reactions from './Reactions';
import { useSettings } from '../lib/useSettings';
import { useLang } from '../lib/i18n';
import { useStaffName } from '../lib/staffDirectory';
import { ADMIN_EMAILS } from '../firebase';

/**
 * Photos posted with a comment, shown as thumbnails; PDFs as a chip.
 * Tapping a photo pops it up right here — no leaving the page — with
 * ‹ › arrows when the comment holds several.
 */
function AttachmentList({ items }: { items: JobAttachment[] }) {
  const { t } = useLang();
  // Index of the photo open in the pop-up, or null.
  const [open, setOpen] = useState<number | null>(null);
  const photos = items.filter((a) => a.kind === 'image');

  function step(dir: 1 | -1) {
    setOpen((cur) => {
      if (cur === null || photos.length < 2) return cur;
      return (cur + dir + photos.length) % photos.length;
    });
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {items.map((a, i) =>
        a.kind === 'image' ? (
          <button
            key={`${a.url}-${i}`}
            type="button"
            onClick={() => setOpen(photos.findIndex((p) => p.url === a.url))}
            title={a.name}
          >
            <img
              src={a.url}
              alt={a.name}
              loading="lazy"
              className="h-20 w-20 rounded-lg border border-slate-200 object-cover transition hover:opacity-90"
            />
          </button>
        ) : (
          <a
            key={`${a.url}-${i}`}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            📄 <span className="truncate">{a.name}</span>
          </a>
        ),
      )}

      {open !== null && photos[open] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 p-4"
          onClick={() => setOpen(null)}
        >
          <img
            src={photos[open].url}
            alt={photos[open].name}
            className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label={t('Close')}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-slate-900/70 text-lg text-white hover:bg-slate-900"
          >
            ✕
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label={t('Previous photo')}
                className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-slate-900/70 text-xl text-white hover:bg-slate-900"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label={t('Next photo')}
                className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-slate-900/70 text-xl text-white hover:bg-slate-900"
              >
                ›
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold text-white">
                {open + 1} / {photos.length}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** "mahmood" from "mahmood@gmail.com" — how people are shown and tagged. */
function handleOf(email: string): string {
  return (email.split('@')[0] || email).toLowerCase();
}

function whenText(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ICON: Record<JobEvent['kind'], string> = {
  created: '➕',
  edited: '✏️',
  status: '🔄',
  comment: '💬',
};

/**
 * A job's history and discussion in one thread: who created it, every edit
 * and status move, plus comments where colleagues can be tagged with @.
 */
export default function JobActivity({ job }: { job: Job }) {
  const { t } = useLang();
  const staffName = useStaffName();
  const settings = useSettings();
  const [events, setEvents] = useState<JobEvent[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [files, setFiles] = useState<JobAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeJobActivity(job.id, setEvents), [job.id]);

  /** Everyone who can be tagged: admins, solar staff and installers. */
  const staff = useMemo(() => {
    const all = [
      ...ADMIN_EMAILS,
      ...(settings.extraAdminEmails ?? []),
      ...(settings.solarStaffEmails ?? []),
      ...(settings.installerEmails ?? []),
    ];
    return [...new Set(all.map((e) => e.toLowerCase()).filter(Boolean))].sort();
  }, [settings]);

  // The word being typed after an "@", used to filter the tag list.
  const mentionQuery = (() => {
    const match = /@([\w.-]*)$/.exec(draft);
    return match ? match[1].toLowerCase() : null;
  })();
  const suggestions = staff.filter(
    (e) =>
      mentionQuery !== null &&
      (handleOf(e).includes(mentionQuery) ||
        staffName(e).toLowerCase().includes(mentionQuery)),
  );

  function insertMention(email: string) {
    setDraft((d) => d.replace(/@([\w.-]*)$/, `@${handleOf(email)} `));
    setMentionOpen(false);
    boxRef.current?.focus();
  }

  /** Upload dropped or chosen files and hold them until the comment is posted. */
  async function attach(list: FileList | File[]) {
    const chosen = [...list];
    if (!chosen.length) return;
    setError('');
    setUploading((n) => n + chosen.length);
    for (const file of chosen) {
      try {
        const up = await uploadJobCommentFile(file, job.id);
        setFiles((f) => [...f, { url: up.url, name: file.name, kind: up.kind }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Could not upload ${file.name}.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function post() {
    const text = draft.trim();
    if (!text && !files.length) return;
    // Empty the box first — the comment is already in the list, greyed
    // until it reaches the server.
    const sentFiles = files;
    setDraft('');
    setFiles([]);
    setBusy(true);
    setError('');
    try {
      // Tag anyone whose handle appears as @name in the text.
      const mentions = staff.filter((e) =>
        new RegExp(`@${handleOf(e)}\\b`, 'i').test(text),
      );
      await addJobComment(job.id, text, mentions, sentFiles);
    } catch (e) {
      setDraft((d) => d || text);
      setFiles(sentFiles);
      setError(e instanceof Error ? e.message : 'Could not post the comment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {t('Activity')}
      </h3>

      <ol className="mt-3 space-y-3">
        {/* Creation is shown from the job itself, so it appears even for jobs
            that pre-date this history log. */}
        {(job.createdBy || job.createdAtMs) && (
          <li className="flex gap-2.5 text-sm">
            <span aria-hidden className="mt-0.5">
              ➕
            </span>
            <div className="min-w-0">
              <p className="text-slate-800">
                <span className="font-semibold">{handleOf(job.createdBy) || 'someone'}</span>{' '}
                {t('created this job')}
              </p>
              <p className="text-xs text-slate-400">{whenText(job.createdAtMs)}</p>
            </div>
          </li>
        )}

        {events === null ? (
          <li className="text-sm text-slate-400">{t('Loading…')}</li>
        ) : (
          events
            // The stored "created" line would duplicate the one above.
            .filter((e) => e.kind !== 'created')
            .map((e) => (
              <li
                key={e.id}
                className={`flex gap-2.5 text-sm transition-opacity ${
                  e.atMs === null ? 'opacity-60' : 'opacity-100'
                }`}
              >
                <span aria-hidden className="mt-0.5">
                  {ICON[e.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-800">
                    <span className="font-semibold">{staffName(e.by) || 'someone'}</span>{' '}
                    {e.kind === 'comment' ? (
                      <span className="whitespace-pre-wrap">
                        {e.text.split(/(@[\w.-]+)/).map((part, i) =>
                          part.startsWith('@') ? (
                            <span key={i} className="font-semibold text-brand-700">
                              {part}
                            </span>
                          ) : (
                            part
                          ),
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-600">{t(e.text)}</span>
                    )}
                  </p>
                  {e.attachments.length > 0 && <AttachmentList items={e.attachments} />}
                  {e.kind === 'comment' && (
                    <Reactions
                      reactions={e.reactions}
                      onToggle={(emoji) => setJobReaction(job.id, e.id, emoji)}
                    />
                  )}
                  <p className="text-xs text-slate-400">{whenText(e.atMs)}</p>
                </div>
              </li>
            ))
        )}
      </ol>

      <div
        className="relative mt-4"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) attach(e.dataTransfer.files);
        }}
      >
        <textarea
          ref={boxRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setMentionOpen(/@([\w.-]*)$/.test(e.target.value));
          }}
          onPaste={(e) => {
            // Screenshots pasted straight from the clipboard.
            const pasted = [...e.clipboardData.files];
            if (pasted.length) {
              e.preventDefault();
              attach(pasted);
            }
          }}
          placeholder={t('Write a comment… use @ to tag someone')}
          className={`input min-h-[70px] ${dragOver ? 'border-brand-500 bg-brand-50' : ''}`}
        />
        {dragOver && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm font-semibold text-brand-700">
            {t('Drop photos or PDFs here')}
          </p>
        )}
        {mentionOpen && suggestions.length > 0 && (
          <ul className="absolute bottom-full z-10 mb-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {suggestions.map((email) => (
              <li key={email}>
                <button
                  type="button"
                  onClick={() => insertMention(email)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-semibold text-slate-800">{staffName(email)}</span>{' '}
                  <span className="text-xs text-slate-400">@{handleOf(email)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {(files.length > 0 || uploading > 0) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div
                key={`${f.url}-${i}`}
                className="relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 pr-6 text-xs"
              >
                {f.kind === 'image' ? (
                  <img src={f.url} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded bg-slate-100">📄</span>
                )}
                <span className="max-w-[9rem] truncate text-slate-600">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((list) => list.filter((_, n) => n !== i))}
                  title={t('Remove')}
                  className="absolute right-1 top-1 text-slate-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
            {uploading > 0 && (
              <span className="self-center text-xs text-slate-500">{t('Uploading…')}</span>
            )}
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            📎 {t('Attach')}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) attach(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={post}
            disabled={busy || uploading > 0 || (!draft.trim() && !files.length)}
            className="btn-primary py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? t('Posting…') : t('Post comment')}
          </button>
        </div>
      </div>
    </section>
  );
}
