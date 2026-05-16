import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { CartItem, Product } from '../types/product';
import { products } from '../data/products';

interface CartState {
  items: CartItem[];
}

type Action =
  | { type: 'ADD'; productId: string; quantity: number }
  | { type: 'REMOVE'; productId: string }
  | { type: 'SET_QUANTITY'; productId: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; items: CartItem[] };

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'ADD': {
      const existing = state.items.find((i) => i.productId === action.productId);
      const items = existing
        ? state.items.map((i) =>
            i.productId === action.productId
              ? { ...i, quantity: i.quantity + action.quantity }
              : i,
          )
        : [...state.items, { productId: action.productId, quantity: action.quantity }];
      return { items };
    }
    case 'REMOVE':
      return { items: state.items.filter((i) => i.productId !== action.productId) };
    case 'SET_QUANTITY':
      return {
        items: state.items
          .map((i) =>
            i.productId === action.productId ? { ...i, quantity: action.quantity } : i,
          )
          .filter((i) => i.quantity > 0),
      };
    case 'CLEAR':
      return { items: [] };
    case 'HYDRATE':
      return { items: action.items };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  currency: string;
  productLookup: Record<string, Product>;
  add: (productId: string, quantity?: number) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'alwaidh.cart.v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) {
          dispatch({ type: 'HYDRATE', items: parsed });
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      /* ignore */
    }
  }, [state.items]);

  const productLookup = useMemo(() => {
    const map: Record<string, Product> = {};
    for (const p of products) map[p.id] = p;
    return map;
  }, []);

  const itemCount = state.items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = state.items.reduce((sum, i) => {
    const p = productLookup[i.productId];
    return sum + (p ? p.price * i.quantity : 0);
  }, 0);
  const currency = state.items[0] ? productLookup[state.items[0].productId]?.currency ?? 'USD' : 'USD';

  const add = useCallback(
    (productId: string, quantity = 1) => dispatch({ type: 'ADD', productId, quantity }),
    [],
  );
  const remove = useCallback(
    (productId: string) => dispatch({ type: 'REMOVE', productId }),
    [],
  );
  const setQuantity = useCallback(
    (productId: string, quantity: number) =>
      dispatch({ type: 'SET_QUANTITY', productId, quantity }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const value: CartContextValue = {
    items: state.items,
    itemCount,
    subtotal,
    currency,
    productLookup,
    add,
    remove,
    setQuantity,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
