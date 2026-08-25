import { useEffect, useState } from 'react';
import {
  subscribeAllPosts,
  upsertPost,
  deletePost,
  type BlogPost,
} from '../../lib/blogStore';

/**
 * Writing desk for the blog. Every article carries both languages; the
 * public page shows whichever the visitor is reading in. Body format:
 * blank line between paragraphs, "## " for a heading, "- " for a list.
 */

const EMPTY: BlogPost = {
  id: '',
  slug: '',
  title: '',
  titleAr: '',
  excerpt: '',
  excerptAr: '',
  body: '',
  bodyAr: '',
  cover: '',
  published: false,
  createdAtMs: 0,
};

export default function AdminBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => subscribeAllPosts(setPosts), []);

  async function save(publish?: boolean) {
    if (!editing) return;
    if (!editing.slug.trim() || !editing.title.trim()) {
      setError('An article needs at least a slug and an English title.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await upsertPost({
        ...editing,
        id: editing.id || editing.slug.trim().toLowerCase(),
        published: publish ?? editing.published,
        createdAtMs: editing.createdAtMs || undefined,
      });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    const set = <K extends keyof BlogPost>(key: K, value: BlogPost[K]) =>
      setEditing({ ...editing, [key]: value });
    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-slate-900">
            {editing.id ? 'Edit article' : 'New article'}
          </h1>
          <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
            Back
          </button>
        </header>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
        )}
        <div className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Address (slug)</span>
              <input
                className="input mt-1"
                dir="ltr"
                value={editing.slug}
                onChange={(e) => set('slug', e.target.value)}
                placeholder="solar-energy-iraq-guide"
                disabled={!!editing.id}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Cover image URL (optional)</span>
              <input className="input mt-1" dir="ltr" value={editing.cover} onChange={(e) => set('cover', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Title (English)</span>
              <input className="input mt-1" value={editing.title} onChange={(e) => set('title', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Title (Arabic)</span>
              <input className="input mt-1" dir="rtl" value={editing.titleAr} onChange={(e) => set('titleAr', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Excerpt (English) — shows in Google</span>
              <textarea className="input mt-1 min-h-[70px]" value={editing.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Excerpt (Arabic)</span>
              <textarea className="input mt-1 min-h-[70px]" dir="rtl" value={editing.excerptAr} onChange={(e) => set('excerptAr', e.target.value)} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Body (English)</span>
            <textarea className="input mt-1 min-h-[260px]" value={editing.body} onChange={(e) => set('body', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Body (Arabic)</span>
            <textarea className="input mt-1 min-h-[260px]" dir="rtl" value={editing.bodyAr} onChange={(e) => set('bodyAr', e.target.value)} />
          </label>
          <p className="text-xs text-slate-500">
            Blank line between paragraphs · start a line with “## ” for a heading · “- ” for list items.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => save(true)} disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : 'Publish'}
            </button>
            <button type="button" onClick={() => save(false)} disabled={busy} className="btn-secondary">
              Save as draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Blog</h1>
          <p className="mt-1 text-sm text-slate-600">
            Articles that bring solar searches to the site. Bilingual — Google reads both.
          </p>
        </div>
        <button type="button" onClick={() => setEditing({ ...EMPTY })} className="btn-primary">
          + New article
        </button>
      </header>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}
      <div className="card divide-y divide-slate-100">
        {posts.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">No articles yet — write the first one.</p>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-slate-900">{p.titleAr || p.title}</p>
                <p className="truncate text-xs text-slate-500" dir="ltr">
                  /blog/{p.slug} · {new Date(p.createdAtMs).toLocaleDateString('en-GB')}
                </p>
              </div>
              <span
                className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  p.published ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {p.published ? 'Published' : 'Draft'}
              </span>
              <a
                href={`/blog/${p.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex-none rounded p-1.5 text-slate-400 hover:bg-slate-100"
                title="Open"
              >
                ↗
              </a>
              <button
                type="button"
                onClick={() => setEditing(p)}
                className="btn-secondary flex-none px-3 py-1.5 text-xs"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${p.title}"?`)) deletePost(p.id).catch((e) => setError(String(e)));
                }}
                className="flex-none rounded p-1.5 text-red-500 hover:bg-red-50"
                title="Delete"
              >
                🗑
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
