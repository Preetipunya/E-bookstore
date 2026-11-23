import { useEffect, useState } from 'react';

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / blocked - app keeps working in memory */
  }
}

/** useState that mirrors its value into localStorage. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readJSON<T>(key, initial));
  useEffect(() => writeJSON(key, value), [key, value]);
  return [value, setValue] as const;
}

export const KEYS = {
  users: 'bw.users',
  session: 'bw.session',
  cart: (uid: string) => `bw.cart.${uid}`,
  wishlist: (uid: string) => `bw.wishlist.${uid}`,
  addresses: (uid: string) => `bw.addresses.${uid}`,
  orders: 'bw.orders',
  points: (uid: string) => `bw.points.${uid}`,
};
