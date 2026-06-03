import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  subscribeSolarProjects,
  SEED_PROJECTS,
  type SolarProject,
} from '../lib/solarProjectsStore';

export default function SolarProjects() {
  const [live, setLive] = useState<SolarProject[]>([]);

  useEffect(() => subscribeSolarProjects(setLive), []);

  // Show real data when available; otherwise the sample projects so the page
  // is never blank for visitors before an admin has populated the collection.
  const projects = live.length ? live : SEED_PROJECTS;

  return (
    <div className="bg-white">
      {/* Header */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="container-page py-14">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">
            Our Work
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Solar Energy Projects
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            A look at solar systems we’ve designed and installed — from rooftop home setups to
            off-grid battery banks and commercial arrays.
          </p>
        </div>
      </section>

      {/* Projects grid */}
      <section className="container-page py-14">
        {projects.length === 0 ? (
          <p className="py-10 text-center text-slate-500">No projects to show yet.</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            {projects.map((p) => (
              <article
                key={p.id}
                className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                  {p.image && (
                    <img
                      src={p.image}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {p.location && <span>{p.location}</span>}
                    {p.location && p.size && <span className="text-slate-300">•</span>}
                    {p.size && <span className="text-amber-600">{p.size}</span>}
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-slate-900">{p.title}</h2>
                  <p className="mt-2 text-slate-600">{p.blurb}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="container-page pb-20">
        <div className="rounded-3xl bg-slate-900 px-8 py-14 text-center text-white md:px-16">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Want a system like these?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">
            Size the right setup for your home or business with our calculator, or get in touch and
            we’ll help you plan it.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/solar-calculator"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 transition hover:bg-slate-100"
            >
              Build a Solar System
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center justify-center rounded-full border border-white/70 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-slate-900"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
