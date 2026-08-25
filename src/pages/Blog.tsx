import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPublishedPosts, type BlogPost } from '../lib/blogStore';
import { useLang } from '../lib/i18n';
import { useSeo, organizationJsonLd } from '../lib/seo';

export default function Blog() {
  const { t, lang } = useLang();
  const [posts, setPosts] = useState<BlogPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPublishedPosts().then((list) => {
      if (!cancelled) setPosts(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useSeo({
    title:
      lang === 'ar'
        ? 'مقالات الطاقة الشمسية في العراق — الواعظ للقدرة | Alwaidh'
        : 'Solar Energy Articles for Iraq — Alwaidh Blog',
    description:
      lang === 'ar'
        ? 'كل ما تحتاج معرفته عن الطاقة الشمسية في العراق: أسعار المنظومات، اختيار حجم المنظومة، الانفيرترات، البطاريات، ومبادرة البنك المركزي — من خبراء الواعظ للقدرة في بغداد.'
        : 'Everything about solar energy in Iraq: system prices, sizing, inverters, batteries and the Central Bank initiative — from Alwaidh, Baghdad.',
    path: '/blog',
    jsonLd: organizationJsonLd(),
  });

  const pick = (en: string, ar: string) => (lang === 'ar' && ar ? ar : en);

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <div className="mb-8 max-w-2xl">
          <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-xs font-bold tracking-wide text-brand-700">
            {t('Articles')}
          </span>
          <h1 className="mb-2 mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            {t('Solar energy, explained properly')}
          </h1>
          <p className="text-[15px] leading-relaxed text-slate-500">
            {t('Prices, sizing, inverters, batteries — written by the people who install them across Iraq.')}
          </p>
        </div>

        {posts === null ? (
          <p className="py-16 text-center text-slate-400">{t('Loading…')}</p>
        ) : posts.length === 0 ? (
          <p className="py-16 text-center text-slate-400">{t('Articles are on their way — check back soon.')}</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10"
              >
                {p.cover && (
                  <div className="relative h-44 overflow-hidden bg-slate-900">
                    <img
                      src={p.cover}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <time className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {new Date(p.createdAtMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </time>
                  <h2 className="text-lg font-extrabold leading-snug tracking-tight text-slate-900 group-hover:text-brand-700">
                    {pick(p.title, p.titleAr)}
                  </h2>
                  <p className="line-clamp-3 text-[13px] leading-relaxed text-slate-500">
                    {pick(p.excerpt, p.excerptAr)}
                  </p>
                  <span className="mt-auto pt-2 text-[13px] font-bold text-brand-700">
                    {t('Read the article')} {lang === 'ar' ? '←' : '→'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
