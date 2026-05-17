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
      setProducts(list);
      setLoading(false);
    });
  }, []);
  return { products, loading };
}
