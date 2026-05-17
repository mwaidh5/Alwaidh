import { Link } from 'react-router-dom';
import type { Category } from '../types/product';

export default function CategoryTile({ category }: { category: Category }) {
  return (
    <Link
      to="/shop"
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${category.accent} p-8 text-white shadow-md transition hover:shadow-xl`}
    >
      <div className="text-5xl">{category.icon}</div>
      <h3 className="mt-6 text-2xl font-extrabold">{category.name}</h3>
      <p className="mt-2 max-w-xs text-sm text-white/90">{category.tagline}</p>
      <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
        Browse shop
        <span aria-hidden className="transition group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}
