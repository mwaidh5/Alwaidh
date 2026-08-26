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
  subcategory?: string;      // first sub-category; kept for older records
  subcategories?: string[];  // a product can sit in several at once
  price: number;        // what the customer pays now, in your local currency
  /** The price before the discount. Shown struck through when it's higher
   *  than `price`; empty or lower means the product isn't on offer. */
  oldPrice?: number | null;
  currency: string;     // e.g. "USD", "AED", "SAR"
  image: string;        // primary image (= images[0]); kept for thumbnails/back-compat
  images: string[];     // full gallery, first entry is the primary
  /** 'contain' shows the whole photo (default); 'cover' fills the square
   *  and crops whatever doesn't fit. */
  imageFit?: 'contain' | 'cover';
  rating: number;       // 0..5
  inStock: boolean;
  /** Announced but not sellable yet — shows a badge and a notify box. */
  comingSoon?: boolean;
  shortDescription: string;
  /** Arabic wording, shown when the site is in Arabic; empty falls back
      to the English. */
  nameAr?: string;
  shortDescriptionAr?: string;
  /** Hidden Arabic search words — never shown, only matched when someone
      searches in Arabic. Space-separated words and synonyms. */
  keywordsAr?: string;
  specs: Record<string, string>;
  /**
   * The same specs in the order they were typed. Firestore returns a map's
   * keys sorted alphabetically, which scrambled hand-ordered spec sheets —
   * so the order is kept here and `specs` is left for older records.
   */
  specsList?: { name: string; value: string }[];
  datasheet?: string;   // PDF or image URL — shown on the product page
  manual?: string;      // PDF URL — offered as a download only
  deliveryFee?: number | null; // overrides the store's default delivery fee
  separateDelivery?: boolean;  // ships on its own: fee is ADDED, not merged
  draft?: boolean;      // true = hidden from the shop, staff-only
  /** When it was added, for "newest first" ordering. Missing on products
   *  created before this was recorded. */
  createdAtMs?: number | null;
  deletedAtMs?: number | null; // set = product is in the Trash
  deletedBy?: string;   // who moved it to the Trash
}

export interface CartItem {
  productId: string;
  quantity: number;
}
