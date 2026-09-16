import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../lib/i18n';
import { saveFile } from '../../lib/savePdf';
import {
  deleteRegistration,
  saveEventConfig,
  setArrived,
  subscribeEventConfig,
  subscribeEventRegistrations,
  type EventConfig,
  type EventRegistration,
} from '../../lib/eventStore';

/**
 * The event, from the office side: the details the sign-up page shows,
 * the link to send out, who has registered, a tick at the door, and the
 * printed list in Tiandy's green for the day.
 */
const GREEN = '#3cc63c';
const DEEP = '#0f5a1f';
const LINK = 'https://alwaidh.com/tiandy-event';
const ROWS_PER_PAGE = 26;

export default function AdminEvent() {
  const { t } = useLang();
  const { isAdmin } = useAuth();
  const [cfg, setCfg] = useState<EventConfig | null>(null);
  const [draft, setDraft] = useState<EventConfig | null>(null);
  const [list, setList] = useState<EventRegistration[] | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(
    () =>
      subscribeEventConfig((c) => {
        setCfg(c);
        setDraft((d) => d ?? c);
      }),
    [],
  );
  useEffect(
    () =>
      subscribeEventRegistrations(setList, (e) =>
        setError(e instanceof Error ? e.message : 'Could not load the list.'),
      ),
    [],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list ?? [];
    return (list ?? []).filter((r) => `${r.name} ${r.company} ${r.phone}`.toLowerCase().includes(q));
  }, [list, query]);
  const coming = (list ?? []).reduce((n, r) => n + r.people, 0);
  const arrived = (list ?? []).filter((r) => r.arrived).length;

  async function saveDetails() {
    if (!draft) return;
    setBusy(true);
    setMsg('');
    try {
      await saveEventConfig(draft);
      setMsg('Saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(LINK);
      setMsg('Link copied.');
      setTimeout(() => setMsg(''), 1500);
    } catch {
      /* the link is on screen to copy by hand */
    }
  }

  /** The printed list: A4 pages in Tiandy's green, a tick box per name. */
  async function printList() {
    if (!list?.length || printing) return;
    setPrinting(true);
    setError('');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const pages = Array.from(document.querySelectorAll<HTMLElement>('[data-event-page]'));
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
      }
      const result = await saveFile(pdf.output('blob'), 'tiandy-event-guests.pdf');
      if (result === 'failed') setError('Could not save the file on this device.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare the file.');
    } finally {
      setPrinting(false);
    }
  }

  const when = (ms: number) =>
    ms ? new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Tiandy event</h1>
          <p className="mt-1 text-sm text-slate-600">
            {list ? `${list.length} registered · ${coming} coming · ${arrived} arrived` : t('Loading…')}
          </p>
        </div>
        <button
          type="button"
          onClick={printList}
          disabled={printing || !list?.length}
          className="rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          style={{ background: DEEP }}
        >
          {printing ? 'Preparing…' : '🖨️ Print list (PDF)'}
        </button>
      </header>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {/* The link that goes out, and the details the page shows. */}
      <div className="card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sign-up link</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800" dir="ltr">{LINK}</code>
          <button type="button" onClick={copyLink} className="btn-secondary">Copy link</button>
          <a href={LINK} target="_blank" rel="noreferrer" className="btn-secondary">Open</a>
          {draft && (
            <label className="ms-auto flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={draft.open}
                disabled={!isAdmin}
                onChange={(e) => {
                  const next = { ...draft, open: e.target.checked };
                  setDraft(next);
                  saveEventConfig(next).catch(() => undefined);
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              Registration open
            </label>
          )}
        </div>

        {draft && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Event title</span>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} dir="auto" disabled={!isAdmin} className="input mt-1 w-full" placeholder="فعالية Tiandy — عرض المنتجات الجديدة" />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Date & time</span>
              <input value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} dir="auto" disabled={!isAdmin} className="input mt-1 w-full" placeholder="الخميس 25 أيلول — الساعة 6 مساءً" />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Place</span>
              <input value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} dir="auto" disabled={!isAdmin} className="input mt-1 w-full" placeholder="شركة الواعظ — شارع الصناعة، بغداد" />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Note (optional)</span>
              <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} dir="auto" disabled={!isAdmin} className="input mt-1 w-full" placeholder="عرض حي للكاميرات الجديدة، مع ضيافة" />
            </label>
            {isAdmin && (
              <div className="flex items-center gap-3 sm:col-span-2">
                <button type="button" onClick={saveDetails} disabled={busy} className="btn-primary disabled:opacity-60">
                  {busy ? t('Saving…') : t('Save')}
                </button>
                {msg && <span className="text-sm text-green-700">{msg}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* The list. */}
      <div className="card p-4">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, company or phone…" className="input w-full sm:max-w-sm" />
        {list === null ? (
          <p className="py-10 text-center text-sm text-slate-500">{t('Loading…')}</p>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{list.length ? 'No match.' : 'Nobody has registered yet — send the link out.'}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 text-start">#</th>
                  <th className="px-2 py-2 text-start">Name</th>
                  <th className="px-2 py-2 text-start">Company</th>
                  <th className="px-2 py-2 text-start">Phone</th>
                  <th className="px-2 py-2 text-start">People</th>
                  <th className="px-2 py-2 text-start">Registered</th>
                  <th className="px-2 py-2 text-start">Arrived</th>
                  {isAdmin && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((r) => (
                  <tr key={r.id} className={r.arrived ? 'bg-green-50/60' : ''}>
                    <td className="px-2 py-2 text-slate-400">{(list.indexOf(r) + 1)}</td>
                    <td className="px-2 py-2 font-semibold text-slate-900" dir="auto">{r.name}</td>
                    <td className="px-2 py-2 text-slate-700" dir="auto">{r.company || '—'}</td>
                    <td className="px-2 py-2" dir="ltr"><a href={`tel:${r.phone}`} className="font-semibold text-brand-700 hover:underline">{r.phone}</a></td>
                    <td className="px-2 py-2 text-slate-700">{r.people}</td>
                    <td className="px-2 py-2 text-xs text-slate-500">{when(r.createdAtMs)}</td>
                    <td className="px-2 py-2">
                      <input type="checkbox" checked={r.arrived} onChange={(e) => setArrived(r.id, e.target.checked).catch(() => undefined)} className="h-5 w-5 rounded border-slate-300" style={{ accentColor: GREEN }} />
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-2 text-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remove ${r.name}?`)) deleteRegistration(r.id).catch(() => undefined);
                          }}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          {t('Remove')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* The printed pages, drawn off-screen and photographed into the PDF. */}
      {list && list.length > 0 && (
        <div aria-hidden className="pointer-events-none fixed -left-[3000px] top-0">
          {chunk(list, ROWS_PER_PAGE).map((rows, p, all) => (
            <PrintPage key={p} rows={rows} first={p * ROWS_PER_PAGE} page={p + 1} pages={all.length} cfg={cfg} total={list.length} coming={coming} />
          ))}
        </div>
      )}
    </div>
  );
}

function chunk<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** One A4 page at 96 dpi (794 × 1123), in Tiandy's green. */
function PrintPage({
  rows,
  first,
  page,
  pages,
  cfg,
  total,
  coming,
}: {
  rows: EventRegistration[];
  first: number;
  page: number;
  pages: number;
  cfg: EventConfig | null;
  total: number;
  coming: number;
}) {
  return (
    <div data-event-page dir="rtl" className="flex flex-col bg-white" style={{ width: 794, height: 1123, fontFamily: 'inherit' }}>
      <div className="flex items-center justify-between px-10 pb-5 pt-8 text-white" style={{ background: `linear-gradient(135deg, ${DEEP} 0%, #157a2a 60%, ${GREEN} 100%)` }}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/75">قائمة الحضور</p>
          <h1 className="mt-1 text-2xl font-extrabold">{cfg?.title || 'فعالية Tiandy'}</h1>
          <p className="mt-1 text-sm font-semibold text-white/90">
            {[cfg?.date, cfg?.place].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="rounded-xl bg-white px-4 py-2.5">
          <img src="/brands/tiandy-logo.png" alt="Tiandy" className="h-9 w-auto" />
        </div>
      </div>
      <div className="flex items-center justify-between px-10 py-3 text-xs font-semibold text-slate-500">
        <span>{total} مسجّل · {coming} شخص متوقع</span>
        <span>صفحة {page} من {pages}</span>
      </div>
      <table className="mx-10 border-collapse text-[13px]">
        <thead>
          <tr className="text-white" style={{ background: DEEP }}>
            <th className="w-10 px-2 py-2 text-center font-bold">#</th>
            <th className="w-12 px-2 py-2 text-center font-bold">حضر</th>
            <th className="px-3 py-2 text-start font-bold">الاسم</th>
            <th className="px-3 py-2 text-start font-bold">الشركة / المحل</th>
            <th className="w-36 px-3 py-2 text-start font-bold">الهاتف</th>
            <th className="w-14 px-2 py-2 text-center font-bold">العدد</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{ background: i % 2 ? '#f3faf3' : '#fff', borderBottom: '1px solid #dbe7db' }}>
              <td className="px-2 py-2 text-center text-slate-500">{first + i + 1}</td>
              <td className="px-2 py-2 text-center">
                <span className="inline-block h-5 w-5 rounded-md border-2 align-middle" style={{ borderColor: GREEN, background: r.arrived ? GREEN : '#fff' }} />
              </td>
              <td className="px-3 py-2 font-bold text-slate-900">{r.name}</td>
              <td className="px-3 py-2 text-slate-700">{r.company}</td>
              <td className="px-3 py-2 text-slate-800" dir="ltr">{r.phone}</td>
              <td className="px-2 py-2 text-center text-slate-700">{r.people}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-auto flex items-center justify-between px-10 pb-8 text-[11px] font-semibold text-slate-400">
        <span>شركة تقنية الواعظ — الوكيل المعتمد لـ Tiandy في بغداد</span>
        <span dir="ltr">alwaidh.com · 0774 420 5582</span>
      </div>
    </div>
  );
}
