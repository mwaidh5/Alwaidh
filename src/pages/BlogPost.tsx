import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPostBySlug, type BlogPost as Post } from '../lib/blogStore';
import { useLang } from '../lib/i18n';
import { useSeo, organizationJsonLd } from '../lib/seo';
import { openChat } from '../lib/chatPanel';

/** The body's little grammar: blank lines split paragraphs, "## " starts
    a heading, consecutive "- " lines make a list. */
function renderBody(body: string): ReactNode[] {
  const blocks = body.split(/\n\s*\n/);
  return blocks.map((block, i) => {
    const lines = block.trim().split('\n');
    if (!lines[0]) return null;
    if (lines[0].startsWith('## ')) {
      return (
        <h2 key={i} className="mb-3 mt-8 text-xl font-extrabold tracking-tight text-slate-900">
          {lines[0].slice(3)}
        </h2>
      );
    }
    if (lines.every((l) => l.trim().startsWith('- '))) {
      return (
        <ul key={i} className="mb-4 list-disc space-y-1.5 ps-6 text-[15px] leading-relaxed text-slate-700">
          {lines.map((l, j) => (
            <li key={j}>{l.trim().slice(2)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="mb-4 text-[15px] leading-relaxed text-slate-700">
        {block.trim()}
      </p>
    );
  });
}

export default function BlogPost() {
  const { slug = '' } = useParams();
  const { t, lang } = useLang();
  const [post, setPost] = useState<Post | null | 'missing'>(null);

  useEffect(() => {
    let cancelled = false;
    setPost(null);
    getPostBySlug(slug)
      .then((p) => {
        if (!cancelled) setPost(p ?? 'missing');
      })
      .catch(() => {
        if (!cancelled) setPost('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loaded = post !== null && post !== 'missing' ? post : null;
  const pick = (en: string, ar: string) => (lang === 'ar' && ar ? ar : en);

  useSeo({
    title: loaded
      ? `${pick(loaded.title, loaded.titleAr)} — الواعظ Alwaidh`
      : 'Alwaidh — مقالات الطاقة الشمسية',
    description: loaded ? pick(loaded.excerpt, loaded.excerptAr) : undefined,
    path: `/blog/${slug}`,
    image: loaded?.cover || undefined,
    type: 'article',
    jsonLd: loaded
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: pick(loaded.title, loaded.titleAr),
            alternativeHeadline: lang === 'ar' ? loaded.title : loaded.titleAr,
            description: pick(loaded.excerpt, loaded.excerptAr),
            image: loaded.cover || undefined,
            datePublished: new Date(loaded.createdAtMs).toISOString(),
            inLanguage: lang === 'ar' ? 'ar' : 'en',
            author: { '@type': 'Organization', name: 'Alwaidh — الواعظ للقدرة' },
            publisher: { '@type': 'Organization', name: 'Alwaidh — الواعظ للقدرة', url: 'https://alwaidh.com' },
            mainEntityOfPage: `https://alwaidh.com/blog/${loaded.slug}`,
          },
          organizationJsonLd(),
        ]
      : undefined,
  });

  if (post === null) {
    return <div className="container-page py-24 text-center text-slate-500">{t('Loading…')}</div>;
  }
  if (post === 'missing') {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('Article not found')}</h1>
        <Link to="/blog" className="btn-primary mt-6 inline-flex">
          {t('All articles')}
        </Link>
      </div>
    );
  }

  return (
    <article className="py-10">
      <div className="container-page max-w-3xl">
        <nav className="mb-6 text-sm text-slate-500">
          <Link to="/blog" className="font-semibold text-brand-700 hover:underline">
            {t('Articles')}
          </Link>{' '}
          / <span>{pick(post.title, post.titleAr)}</span>
        </nav>
        <h1 className="mb-3 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
          {pick(post.title, post.titleAr)}
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          {new Date(post.createdAtMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} ·
          Alwaidh — الواعظ للقدرة
        </p>
        {post.cover && (
          <img src={post.cover} alt="" className="mb-8 w-full rounded-2xl object-cover" />
        )}
        <div>{renderBody(pick(post.body, post.bodyAr))}</div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-6">
          <div>
            <p className="font-extrabold text-slate-900">{t('Thinking about solar for your home or business?')}</p>
            <p className="mt-1 text-sm text-slate-600">{t('See our system prices, or ask us anything — the survey is free.')}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/solar-prices" className="btn-primary">
              {t('See solar prices')}
            </Link>
            <button type="button" onClick={() => openChat()} className="btn-secondary">
              {t('Talk to us')}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
