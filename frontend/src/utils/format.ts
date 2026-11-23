export const formatPrice = (n: number): string => `\u20B9${n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;

export const formatDate = (iso: string | Date): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (iso: string | Date): string =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Tentative delivery date: 4 days from today. */
export function deliveryDate(days = 4): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export const uid = (prefix = ''): string => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const fakeTransactionId = (): string => `TXN${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const fakeOrderId = (): string => `BW${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${Math.floor(100000 + Math.random() * 900000)}`;

export const CANCEL_WINDOW_MS = 48 * 60 * 60 * 1000;
export const REWARD_PER_PURCHASE = 10;
export const FREE_SHIPPING_ABOVE = 499;
export const SHIPPING_FEE = 49;

export function cancellationState(createdAt: string, now = Date.now()) {
  const deadline = new Date(createdAt).getTime() + CANCEL_WINDOW_MS;
  const msLeft = deadline - now;
  return { allowed: msLeft > 0, msLeft: Math.max(0, msLeft), hoursLeft: Math.max(0, Math.ceil(msLeft / 3600000)) };
}
