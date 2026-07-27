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

/**
 * Every brand we carry, shown as one continuous carousel on the About
 * page. Logos come from settings.brandLogos (keyed by slug) when uploaded;
 * until then the wordmark is shown.
 */
export const allBrands: Brand[] = [
  { slug: 'jinko', name: 'Jinko Solar' },
  { slug: 'solarmax', name: 'SolarMax' },
  { slug: 'saj', name: 'SAJ' },
  { slug: 'deye', name: 'Deye' },
  { slug: 'voltronic', name: 'Voltronic' },
  { slug: 'hailei', name: 'Hailei' },
  { slug: 'sinexcel', name: 'Sinexcel' },
  { slug: 'fortuners', name: 'Fortuners' },
  { slug: 'lenovo', name: 'Lenovo' },
  { slug: 'tiandy', name: 'Tiandy' },
];
