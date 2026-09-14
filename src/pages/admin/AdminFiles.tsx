import { useEffect, useMemo, useRef, useState } from 'react';
import { brandedFileUrl } from '../../lib/brandedFiles';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../lib/i18n';
import { useScrollLock } from '../../lib/useScrollLock';
import {
  deleteLibraryFile,
  formatFileSize,
  renameLibraryFile,
  isPdf,
  subscribeLibrary,
  uploadLibraryFile,
  type LibraryFile,
} from '../../lib/libraryStore';
import { useStaffName } from '../../lib/staffDirectory';
import PdfView from '../../components/PdfView';

/**
 * The team's shelf of documents. Anyone who works here can open what's on
 * it and add to it; only an admin removes anything. PDFs open in a viewer
 * here rather than sending people off to another tab.
 */
export default function AdminFiles() {
  const { t } = useLang();
  const staffName = useStaffName();
  const { isAdmin } = useAuth();
  const [files, setFiles] = useState<LibraryFile[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<LibraryFile | null>(null);
  const [copied, setCopied] = useState('');
  // The file being renamed, and the words in its two boxes.
  const [renaming, setRenaming] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  function startRename(item: LibraryFile) {
    setRenaming(item.id);
    setNameDraft(item.name);
    setNoteDraft(item.note);
  }

  async function saveRename() {
    if (!renaming || savingName) return;
    setSavingName(true);
    try {
      await renameLibraryFile(renaming, nameDraft, noteDraft);
      setRenaming('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not rename the file.'));
    } finally {
      setSavingName(false);
    }
  }

  useEffect(
    () =>
      subscribeLibrary(
        (list) => {
          setFiles(list);
          setError('');
        },
        (message) => {
          setFiles([]);
          setError(message);
        },
      ),
    [],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files ?? [];
    return (files ?? []).filter((f) =>
      `${f.name} ${f.fileName} ${f.note} ${f.by}`.toLowerCase().includes(q),
    );
  }, [files, search]);

  async function handleDelete(item: LibraryFile) {
    if (!confirm(t('Remove this file for everyone?'))) return;
    try {
      await deleteLibraryFile(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not remove the file.'));
    }
  }

  async function copyLink(item: LibraryFile) {
    try {
      await navigator.clipboard.writeText(brandedFileUrl(item.url));
      setCopied(item.id);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard unavailable — the Open button still works */
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">{t('Files')}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t('Catalogues, price lists and other documents — shared with everyone who works here.')}
        </p>
      </header>

      <UploadBox onError={setError} />

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="card p-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Search files…')}
          className="input w-full sm:max-w-sm"
        />

        {files === null ? (
          <p className="py-10 text-center text-sm text-slate-500">{t('Loading…')}</p>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            {files.length === 0
              ? t('Nothing here yet — upload a catalogue to get started.')
              : t('No files match that search.')}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {shown.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <span className="text-2xl" aria-hidden>
                  {isPdf(f) ? '📕' : f.contentType.startsWith('image/') ? '🖼️' : '📄'}
                </span>
                {/* The name takes the rest of its own line on phones —
                    sharing a row with four buttons squeezed it to a
                    single character. */}
                <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-0">
                  {renaming === f.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveRename();
                      }}
                      className="space-y-1.5"
                    >
                      <input
                        autoFocus
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setRenaming('')}
                        placeholder={t('Name')}
                        className="input w-full py-1.5 text-sm font-semibold"
                      />
                      <input
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setRenaming('')}
                        placeholder={t('Note (optional)')}
                        className="input w-full py-1.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={savingName || !nameDraft.trim()}
                          className="btn-primary px-3 py-1 text-xs disabled:opacity-50"
                        >
                          {t('Save')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenaming('')}
                          className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          {t('Cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreview(f)}
                        className="block max-w-full break-words text-start font-semibold text-slate-900 hover:text-brand-700 hover:underline sm:truncate"
                      >
                        {f.name}
                      </button>
                      {f.note && <p className="break-words text-sm text-slate-600 sm:truncate">{f.note}</p>}
                    </>
                  )}
                  <p className="text-xs text-slate-500">
                    {[
                      formatFileSize(f.size),
                      f.by ? `${t('Added by')} ${staffName(f.by)}` : '',
                      new Date(f.createdAt).toLocaleDateString('en-GB'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <button type="button" onClick={() => setPreview(f)} className="btn-secondary">
                    {t('View')}
                  </button>
                  <a
                    href={brandedFileUrl(f.url)}
                    target="_blank"
                    rel="noreferrer"
                    download={f.fileName || f.name}
                    className="btn-secondary"
                  >
                    {t('Download')}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyLink(f)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copied === f.id ? t('Copied ✓') : t('Copy link')}
                  </button>
                  {renaming !== f.id && (
                    <button
                      type="button"
                      onClick={() => startRename(f)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      ✏️ {t('Rename')}
                    </button>
                  )}
                  {/* Only an admin takes a file off the shelf — everyone
                      else relies on it being there. */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(f)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      {t('Remove')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {preview && <FilePreview item={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/**
 * Add files: drop a handful (or pick them), give any of them a better
 * name, and one Upload puts them all on the shelf in turn. A note typed
 * here goes on every file in the batch.
 */
function UploadBox({ onError }: { onError: (message: string) => void }) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  // What is waiting to go up, each with the name it will carry.
  const [pending, setPending] = useState<{ file: File; name: string }[]>([]);
  const [note, setNote] = useState('');
  // How many of the batch are already up, while it runs; -1 when idle.
  const [progress, setProgress] = useState(-1);
  const [over, setOver] = useState(false);
  const [done, setDone] = useState(0);

  function choose(list: FileList | File[] | null) {
    const files = [...(list ?? [])];
    if (!files.length) return;
    setDone(0);
    setPending((cur) => [
      ...cur,
      ...files
        // The same file twice is one file.
        .filter((f) => !cur.some((x) => x.file.name === f.name && x.file.size === f.size))
        .map((file) => ({ file, name: file.name.replace(/\.[^.]+$/, '') })),
    ]);
  }

  async function handleUpload() {
    if (!pending.length) return;
    onError('');
    const batch = pending;
    let sent = 0;
    try {
      for (const item of batch) {
        setProgress(sent);
        await uploadLibraryFile({ file: item.file, name: item.name, note });
        sent += 1;
        // What is up is off the list, so a failure half-way leaves only
        // the rest to retry.
        setPending((cur) => cur.filter((x) => x !== item));
      }
      setNote('');
      setDone(sent);
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      onError(e instanceof Error ? e.message : t('Upload failed.'));
    } finally {
      setProgress(-1);
    }
  }

  const busy = progress >= 0;
  const total = pending.reduce((n, x) => n + x.file.size, 0);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        choose(e.dataTransfer.files);
      }}
      className={`card border-2 border-dashed p-4 transition ${
        over ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          onChange={(e) => choose(e.target.files)}
          className="text-sm"
        />
        <p className="text-sm text-slate-500">
          {t('or drop files here — up to 25 MB each')}
        </p>
      </div>

      {pending.length > 0 && (
        <div className="mt-3 space-y-3">
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {pending.map((item, i) => (
              <li key={`${item.file.name}-${item.file.size}`} className="flex items-center gap-2 p-2">
                <span className="text-lg" aria-hidden>
                  {item.file.type === 'application/pdf' ? '📕' : item.file.type.startsWith('image/') ? '🖼️' : '📄'}
                </span>
                <input
                  value={item.name}
                  onChange={(e) =>
                    setPending((cur) => cur.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))
                  }
                  placeholder={item.file.name}
                  disabled={busy}
                  className="input min-w-0 flex-1 py-1.5 text-sm"
                />
                <span className="flex-none text-xs text-slate-500">{formatFileSize(item.file.size)}</span>
                {!busy && (
                  <button
                    type="button"
                    onClick={() => setPending((cur) => cur.filter((_, n) => n !== i))}
                    title={t('Remove')}
                    className="flex-none px-1 text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">{t('Note (optional)')}</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('e.g. 2026 price list')}
                disabled={busy}
                className="input mt-1 w-full"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleUpload}
                disabled={busy}
                className="btn-primary disabled:opacity-60"
              >
                {busy
                  ? `${t('Uploading…')} ${progress + 1} / ${pending.length + progress}`
                  : `${t('Upload')} ${pending.length > 1 ? pending.length : ''} — ${formatFileSize(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {done > 0 && pending.length === 0 && (
        <p className="mt-3 text-sm font-semibold text-green-700">
          {done > 1 ? `${t('Uploaded ✓')} (${done})` : t('Uploaded ✓')}
        </p>
      )}
    </div>
  );
}

/** Opens a file where you are, instead of sending you to another tab. */
function FilePreview({ item, onClose }: { item: LibraryFile; onClose: () => void }) {
  useScrollLock();
  const { t } = useLang();
  const pdf = isPdf(item);
  const image = item.contentType.startsWith('image/');
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/85 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="min-w-0 flex-1 break-words font-bold text-slate-900 sm:truncate">{item.name}</h2>
          <a
            href={brandedFileUrl(item.url)}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            {t('Open in new tab ↗')}
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-lg text-slate-700 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>
        <div className="p-3">
          {pdf ? (
            <PdfView url={item.url} className="max-h-[75vh] overflow-y-auto" />
          ) : image ? (
            <img src={item.url} alt={item.name} className="mx-auto max-h-[75vh] w-auto" />
          ) : (
            <p className="p-8 text-center text-sm text-slate-600">
              {t('This file type opens outside the dashboard — use Download.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
