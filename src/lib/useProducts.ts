import { useEffect, useState } from 'react';
import { subscribeProducts } from './productStore';
import type { Product } from '../types/product';

export interface ProductsState {
  products: Product[];
  loading: boolean;
}

export function useProducts(): ProductsState {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    return subscribeProducts((list) => {
      // Drafts are staff-only: they never reach the shop, search, or cart.
      setProducts(list.filter((p) => !p.draft));
      setLoading(false);
    });
  }, []);
  return { products, loading };
}
