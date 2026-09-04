import { allBrands } from '../data/brands';
import { useSettings } from '../lib/useSettings';

/**
 * Continuously scrolling brand strip. The track holds the list twice so the
 * CSS animation can loop seamlessly; hovering pauses it, and it stops
 * entirely for anyone who prefers reduced motion.
 */
export default function BrandCarousel() {
  const settings = useSettings();
  // The same list the homepage shows: the brands managed in Settings,
  // with the built-in names as the fallback before any are added.
  const brands = (settings.brands ?? []).length
    ? settings.brands
    : allBrands.map((br) => ({ name: br.name, image: settings.brandLogos?.[br.slug] ?? '' }));
  const loop = [...brands, ...brands];
  return (
    <div className="marquee-pause relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent sm:w-24" />
      <ul className="marquee-track flex w-max items-center gap-3.5">
        {loop.map((b, i) => (
          <li
            key={`${b.name}-${i}`}
            aria-hidden={i >= brands.length}
            className="flex h-16 w-[150px] flex-none items-center justify-center rounded-xl border border-slate-200 bg-white px-5"
          >
            {b.image ? (
              <img src={b.image} alt={b.name} loading="lazy" className="max-h-11 max-w-full object-contain" />
            ) : (
              <span className="text-center text-[15px] font-extrabold tracking-tight text-slate-700">{b.name}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

