export type CategorySlug = 'computers' | 'solar' | 'tiandy-cameras';

export interface Category {
  slug: CategorySlug;
  name: string;
  tagline: string;
  accent: string; // tailwind gradient classes
  icon: string;   // emoji or short label
}

export interface Product {
  id: string;
  name: string;
  category: CategorySlug;
  brand: string;
  price: number;        // in your local currency unit
  currency: string;     // e.g. "USD", "AED", "SAR"
  image: string;        // primary image (= images[0]); kept for thumbnails/back-compat
  images: string[];     // full gallery, first entry is the primary
  rating: number;       // 0..5
  inStock: boolean;
  shortDescription: string;
  description: string;
  specs: Record<string, string>;
}

export interface CartItem {
  productId: string;
  quantity: number;
}
