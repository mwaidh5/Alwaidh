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
  datasheet?: string;   // PDF or image URL — shown on the product page
  manual?: string;      // PDF URL — offered as a download only
  deletedAtMs?: number | null; // set = product is in the Trash
  deletedBy?: string;   // who moved it to the Trash
}

export interface CartItem {
  productId: string;
  quantity: number;
}
