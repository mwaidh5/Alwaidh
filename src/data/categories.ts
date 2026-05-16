import type { Category } from '../types/product';

export const categories: Category[] = [
  {
    slug: 'computers',
    name: 'Computers',
    tagline: 'Laptops, desktops, and workstations for work and play.',
    accent: 'from-brand-700 to-brand-500',
    icon: '💻',
  },
  {
    slug: 'solar',
    name: 'Solar Energy',
    tagline: 'Panels, inverters, and batteries for clean, reliable power.',
    accent: 'from-sun-600 to-sun-400',
    icon: '☀️',
  },
  {
    slug: 'tiandy-cameras',
    name: 'Tiandy Cameras',
    tagline: 'Professional IP and analog security cameras and NVRs.',
    accent: 'from-slate-800 to-slate-600',
    icon: '📷',
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
