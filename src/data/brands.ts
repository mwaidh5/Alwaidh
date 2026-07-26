/**
 * Brands we supply. Each can carry an uploaded logo (settings.brandLogos,
 * keyed by slug); until one is uploaded the homepage shows the wordmark so
 * the strip never looks unfinished.
 */
export interface Brand {
  slug: string;
  name: string;
}

export const solarBrands: Brand[] = [
  { slug: 'saj', name: 'SAJ' },
  { slug: 'jinko', name: 'Jinko' },
  { slug: 'hailei', name: 'Hailei' },
  { slug: 'sinexcel', name: 'Sinexcel' },
  { slug: 'fortuners', name: 'Fortuners' },
];
