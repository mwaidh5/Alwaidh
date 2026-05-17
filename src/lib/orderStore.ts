import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
];

export interface OrderLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: string;
  notes?: string;
  lines: OrderLine[];
  subtotal: number;
  currency: string;
  status: OrderStatus;
  createdAt: number;
  userUid?: string;
}

export type NewOrder = Omit<Order, 'id' | 'createdAt' | 'status'> & {
  status?: OrderStatus;
};

const COLLECTION = 'orders';
const LS_KEY = 'alwaidh.orders.v1';

function readLocal(): Order[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: Order[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function normalize(data: Record<string, unknown>, id: string): Order {
  const ts = data.createdAt;
  const createdAt =
    ts instanceof Timestamp ? ts.toMillis() : typeof ts === 'number' ? ts : Date.now();
  return {
    id,
    customerName: String(data.customerName ?? ''),
    customerEmail: String(data.customerEmail ?? ''),
    customerPhone: data.customerPhone ? String(data.customerPhone) : undefined,
    shippingAddress: data.shippingAddress ? String(data.shippingAddress) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    lines: Array.isArray(data.lines) ? (data.lines as OrderLine[]) : [],
    subtotal: Number(data.subtotal ?? 0),
    currency: String(data.currency ?? 'USD'),
    status: (data.status as OrderStatus) ?? 'pending',
    createdAt,
    userUid: data.userUid ? String(data.userUid) : undefined,
  };
}

export async function createOrder(input: NewOrder): Promise<string> {
  const database = db;
  const payload = {
    ...input,
    status: input.status ?? 'pending',
  };
  if (database) {
    const ref = await addDoc(collection(database, COLLECTION), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }
  const order: Order = {
    id: crypto.randomUUID(),
    ...payload,
    status: payload.status,
    createdAt: Date.now(),
  };
  writeLocal([order, ...readLocal()]);
  return order.id;
}

export async function listOrders(): Promise<Order[]> {
  const database = db;
  if (database) {
    const snap = await getDocs(query(collection(database, COLLECTION), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id));
  }
  return readLocal();
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const database = db;
  if (database) {
    await updateDoc(doc(database, COLLECTION, id), { status });
    return;
  }
  writeLocal(readLocal().map((o) => (o.id === id ? { ...o, status } : o)));
}

export async function deleteOrder(id: string): Promise<void> {
  const database = db;
  if (database) {
    await deleteDoc(doc(database, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((o) => o.id !== id));
}
