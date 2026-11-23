import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Address, CartItem, Order, OrderItem, PaymentMethod } from '../types';
import { getBook } from '../data/catalog';
import { useAuth } from './AuthContext';
import { KEYS, readJSON, writeJSON } from '../utils/storage';
import { fakeOrderId, fakeTransactionId, FREE_SHIPPING_ABOVE, REWARD_PER_PURCHASE, SHIPPING_FEE, uid, cancellationState } from '../utils/format';

export interface PlaceOrderInput {
  items: CartItem[];
  address: Address;
  pointsToRedeem: number;
  paymentMethod: PaymentMethod;
  fromCart: boolean;
}

export interface Pricing {
  subtotal: number;
  shipping: number;
  maxRedeemable: number;
  pointsDiscount: number;
  total: number;
}

/** Pure pricing helper shared by cart, checkout and order placement. */
export function priceItems(items: CartItem[], points: number, pointsToRedeem: number): Pricing {
  const subtotal = items.reduce((s, i) => s + (getBook(i.bookId)?.price ?? 0) * i.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
  const payable = subtotal + shipping;
  const maxRedeemable = Math.max(0, Math.min(points, Math.floor(payable * 0.5)));
  const pointsDiscount = Math.min(Math.max(0, Math.floor(pointsToRedeem)), maxRedeemable);
  return { subtotal, shipping, maxRedeemable, pointsDiscount, total: payable - pointsDiscount };
}

interface ShopApi {
  cart: CartItem[];
  cartCount: number;
  addToCart: (bookId: number, qty?: number) => void;
  setQuantity: (bookId: number, qty: number) => void;
  removeFromCart: (bookId: number) => void;
  clearCart: () => void;

  wishlist: number[];
  toggleWishlist: (bookId: number) => boolean; // returns true when added
  removeFromWishlist: (bookId: number) => void;
  moveToCart: (bookId: number) => void;

  addresses: Address[];
  saveAddress: (a: Omit<Address, 'id'> & { id?: string }) => Address;
  deleteAddress: (id: string) => void;

  orders: Order[];
  placeOrder: (input: PlaceOrderInput) => Order;
  cancelOrder: (orderId: string) => { ok: boolean; error?: string };
  buyAgain: (orderId: string) => number;

  points: number;
}

const ShopContext = createContext<ShopApi | null>(null);

const GUEST = 'guest';

function ShopInner({ userId, children }: { userId: string; children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const mine = readJSON<CartItem[]>(KEYS.cart(userId), []);
    if (userId === GUEST) return mine;
    // merge items added while browsing as a guest into the user's cart
    const guest = readJSON<CartItem[]>(KEYS.cart(GUEST), []);
    if (!guest.length) return mine;
    const merged = [...mine];
    for (const g of guest) {
      const hit = merged.find((m) => m.bookId === g.bookId);
      if (hit) merged[merged.indexOf(hit)] = { ...hit, quantity: Math.min(10, hit.quantity + g.quantity) };
      else merged.push(g);
    }
    return merged;
  });
  // Clear the guest cart after merging (kept out of the initializer: StrictMode runs initializers twice).
  useEffect(() => {
    if (userId !== GUEST) localStorage.removeItem(KEYS.cart(GUEST));
  }, [userId]);
  const [wishlist, setWishlist] = useState<number[]>(() => readJSON(KEYS.wishlist(userId), []));
  const [addresses, setAddresses] = useState<Address[]>(() => readJSON(KEYS.addresses(userId), []));
  const [points, setPoints] = useState<number>(() => readJSON(KEYS.points(userId), 0));
  const [allOrders, setAllOrders] = useState<Order[]>(() => readJSON(KEYS.orders, []));

  useEffect(() => writeJSON(KEYS.cart(userId), cart), [userId, cart]);
  useEffect(() => writeJSON(KEYS.wishlist(userId), wishlist), [userId, wishlist]);
  useEffect(() => writeJSON(KEYS.addresses(userId), addresses), [userId, addresses]);
  useEffect(() => writeJSON(KEYS.points(userId), points), [userId, points]);
  useEffect(() => writeJSON(KEYS.orders, allOrders), [allOrders]);

  const orders = useMemo(() => allOrders.filter((o) => o.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [allOrders, userId]);

  const addToCart = useCallback((bookId: number, qty = 1) => {
    setCart((c) => {
      const hit = c.find((i) => i.bookId === bookId);
      return hit ? c.map((i) => (i.bookId === bookId ? { ...i, quantity: Math.min(10, i.quantity + qty) } : i)) : [...c, { bookId, quantity: Math.min(10, qty) }];
    });
  }, []);
  const setQuantity = useCallback((bookId: number, qty: number) => {
    setCart((c) => (qty <= 0 ? c.filter((i) => i.bookId !== bookId) : c.map((i) => (i.bookId === bookId ? { ...i, quantity: Math.min(10, qty) } : i))));
  }, []);
  const removeFromCart = useCallback((bookId: number) => setCart((c) => c.filter((i) => i.bookId !== bookId)), []);
  const clearCart = useCallback(() => setCart([]), []);

  const toggleWishlist = useCallback(
    (bookId: number) => {
      const has = wishlist.includes(bookId);
      setWishlist((w) => (has ? w.filter((id) => id !== bookId) : [...w, bookId]));
      return !has;
    },
    [wishlist],
  );
  const removeFromWishlist = useCallback((bookId: number) => setWishlist((w) => w.filter((id) => id !== bookId)), []);
  const moveToCart = useCallback(
    (bookId: number) => {
      addToCart(bookId, 1);
      setWishlist((w) => w.filter((id) => id !== bookId));
    },
    [addToCart],
  );

  const saveAddress = useCallback((a: Omit<Address, 'id'> & { id?: string }): Address => {
    const saved: Address = { ...a, id: a.id ?? uid('a_') };
    setAddresses((list) => (list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]));
    return saved;
  }, []);
  const deleteAddress = useCallback((id: string) => setAddresses((l) => l.filter((a) => a.id !== id)), []);

  const placeOrder = useCallback(
    (input: PlaceOrderInput): Order => {
      const pricing = priceItems(input.items, points, input.pointsToRedeem);
      const items: OrderItem[] = input.items.flatMap((i) => {
        const b = getBook(i.bookId);
        return b ? [{ bookId: b.id, title: b.title, author: b.author, image: b.image, price: b.price, quantity: i.quantity }] : [];
      });
      const order: Order = {
        id: fakeOrderId(),
        userId,
        createdAt: new Date().toISOString(),
        items,
        address: input.address,
        subtotal: pricing.subtotal,
        shipping: pricing.shipping,
        pointsRedeemed: pricing.pointsDiscount,
        total: pricing.total,
        pointsEarned: REWARD_PER_PURCHASE,
        paymentMethod: input.paymentMethod,
        transactionId: fakeTransactionId(),
        status: 'Confirmed',
      };
      setAllOrders((o) => [order, ...o]);
      setPoints((p) => p - pricing.pointsDiscount + REWARD_PER_PURCHASE);
      if (input.fromCart) setCart([]);
      return order;
    },
    [points, userId],
  );

  const cancelOrder = useCallback(
    (orderId: string) => {
      const order = allOrders.find((o) => o.id === orderId && o.userId === userId);
      if (!order) return { ok: false, error: 'Order not found.' };
      if (order.status === 'Cancelled') return { ok: false, error: 'Order is already cancelled.' };
      if (!cancellationState(order.createdAt).allowed) return { ok: false, error: 'The 48-hour cancellation window has ended.' };
      setAllOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status: 'Cancelled', cancelledAt: new Date().toISOString() } : o)));
      // return redeemed points, take back the points earned on this order
      setPoints((p) => Math.max(0, p + order.pointsRedeemed - order.pointsEarned));
      return { ok: true };
    },
    [allOrders, userId],
  );

  const buyAgain = useCallback(
    (orderId: string) => {
      const order = allOrders.find((o) => o.id === orderId && o.userId === userId);
      if (!order) return 0;
      let added = 0;
      for (const i of order.items) {
        if (getBook(i.bookId)) {
          addToCart(i.bookId, i.quantity);
          added++;
        }
      }
      return added;
    },
    [allOrders, userId, addToCart],
  );

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const value: ShopApi = {
    cart, cartCount, addToCart, setQuantity, removeFromCart, clearCart,
    wishlist, toggleWishlist, removeFromWishlist, moveToCart,
    addresses, saveAddress, deleteAddress,
    orders, placeOrder, cancelOrder, buyAgain,
    points,
  };
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const id = user?.id ?? GUEST;
  // key forces a clean re-initialisation of all per-user state whenever the user changes
  return (
    <ShopInner key={id} userId={id}>
      {children}
    </ShopInner>
  );
}

export function useShop(): ShopApi {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within ShopProvider');
  return ctx;
}
