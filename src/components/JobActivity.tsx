import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addJobComment,
  subscribeJobActivity,
  type Job,
  type JobEvent,
} from '../lib/jobsStore';
import { useSettings } from '../lib/useSettings';
import { useLang } from '../lib/i18n';
import { ADMIN_EMAILS } from '../firebase';

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
  const settings = useSettings();
  const [events, setEvents] = useState<JobEvent[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

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
    (e) => mentionQuery !== null && handleOf(e).includes(mentionQuery),
  );

  function insertMention(email: string) {
    setDraft((d) => d.replace(/@([\w.-]*)$/, `@${handleOf(email)} `));
    setMentionOpen(false);
    boxRef.current?.focus();
  }

  async function post() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError('');
    try {
      // Tag anyone whose handle appears as @name in the text.
      const mentions = staff.filter((e) =>
        new RegExp(`@${handleOf(e)}\\b`, 'i').test(text),
      );
      await addJobComment(job.id, text, mentions);
      setDraft('');
    } catch (e) {
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
              <li key={e.id} className="flex gap-2.5 text-sm">
                <span aria-hidden className="mt-0.5">
                  {ICON[e.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-800">
                    <span className="font-semibold">{handleOf(e.by) || 'someone'}</span>{' '}
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
                  <p className="text-xs text-slate-400">{whenText(e.atMs)}</p>
                </div>
              </li>
            ))
        )}
      </ol>

      <div className="relative mt-4">
        <textarea
          ref={boxRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setMentionOpen(/@([\w.-]*)$/.test(e.target.value));
          }}
          placeholder={t('Write a comment… use @ to tag someone')}
          className="input min-h-[70px]"
        />
        {mentionOpen && suggestions.length > 0 && (
          <ul className="absolute bottom-full z-10 mb-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {suggestions.map((email) => (
              <li key={email}>
                <button
                  type="button"
                  onClick={() => insertMention(email)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-semibold text-slate-800">@{handleOf(email)}</span>{' '}
                  <span className="text-xs text-slate-400">{email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={post}
            disabled={busy || !draft.trim()}
            className="btn-primary py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? t('Posting…') : t('Post comment')}
          </button>
        </div>
      </div>
    </section>
  );
}
