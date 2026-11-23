import { badRequest } from './errors';

export const TAX_RATE = 0.05;
export const FREE_SHIPPING_THRESHOLD = 499;
export const SHIPPING_FEE = 49;
export const POINT_VALUE = 1; // 1 point = Rs 1
export const EARN_DIVISOR = 10; // 1 point per Rs 10 paid
export const MAX_REDEEM_PERCENT = 0.5; // max 50% of the payable value can be paid with points
export const CANCEL_WINDOW_HOURS = 48;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function salePrice(listPrice: number, discountPercent: number): number {
  return round2(listPrice * (1 - discountPercent / 100));
}

export interface PricedItem {
  listPrice: number;
  discountPercent: number;
  quantity: number;
}

export interface CouponLike {
  code: string;
  description?: string;
  discount_type: 'percent' | 'flat' | 'shipping';
  value: number;
  max_discount: number | null;
  min_order: number;
  valid_from: Date | string;
  valid_until: Date | string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
}

/** Returns an error message when the coupon cannot be applied, otherwise null. */
export function couponError(coupon: CouponLike | null, subtotal: number, now = new Date()): string | null {
  if (!coupon || !coupon.is_active) return 'Invalid coupon code';
  if (new Date(coupon.valid_from) > now) return 'Coupon is not active yet';
  if (coupon.valid_until && new Date(coupon.valid_until) < now) return 'Coupon has expired';
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) return 'Coupon usage limit reached';
  if (subtotal < Number(coupon.min_order)) return `Minimum order of Rs ${Number(coupon.min_order)} required for this coupon`;
  return null;
}

export interface Totals {
  mrpTotal: number;
  subtotal: number;
  bookDiscount: number;
  couponDiscount: number;
  tax: number;
  shipping: number;
  maxRedeemablePoints: number;
  pointsRedeemed: number;
  pointsDiscount: number;
  total: number;
  pointsToEarn: number;
  itemCount: number;
}

export interface TotalsInput {
  items: PricedItem[];
  coupon?: CouponLike | null;
  pointsToRedeem?: number;
  pointsBalance?: number;
}

export function computeTotals({ items, coupon = null, pointsToRedeem = 0, pointsBalance = 0 }: TotalsInput): Totals {
  const mrpTotal = round2(items.reduce((s, i) => s + i.listPrice * i.quantity, 0));
  const subtotal = round2(items.reduce((s, i) => s + salePrice(i.listPrice, i.discountPercent) * i.quantity, 0));
  const bookDiscount = round2(mrpTotal - subtotal);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  let couponDiscount = 0;
  let freeShipping = false;
  if (coupon) {
    if (coupon.discount_type === 'percent') {
      couponDiscount = (subtotal * Number(coupon.value)) / 100;
      if (coupon.max_discount !== null) couponDiscount = Math.min(couponDiscount, Number(coupon.max_discount));
    } else if (coupon.discount_type === 'flat') {
      couponDiscount = Math.min(Number(coupon.value), subtotal);
    } else {
      freeShipping = true;
    }
  }
  couponDiscount = round2(couponDiscount);

  const taxable = round2(subtotal - couponDiscount);
  const tax = round2(taxable * TAX_RATE);
  const shipping = itemCount === 0 || freeShipping || taxable >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const beforePoints = round2(taxable + tax + shipping);

  const maxRedeemablePoints = Math.max(0, Math.min(pointsBalance, Math.floor((beforePoints * MAX_REDEEM_PERCENT) / POINT_VALUE)));
  if (!Number.isInteger(pointsToRedeem) || pointsToRedeem < 0) throw badRequest('pointsToRedeem must be a non-negative integer');
  if (pointsToRedeem > maxRedeemablePoints) {
    throw badRequest(`You can redeem at most ${maxRedeemablePoints} points on this order`, { maxRedeemablePoints });
  }
  const pointsDiscount = round2(pointsToRedeem * POINT_VALUE);
  const total = round2(beforePoints - pointsDiscount);
  return {
    mrpTotal,
    subtotal,
    bookDiscount,
    couponDiscount,
    tax,
    shipping,
    maxRedeemablePoints,
    pointsRedeemed: pointsToRedeem,
    pointsDiscount,
    total,
    pointsToEarn: Math.floor(total / EARN_DIVISOR),
    itemCount,
  };
}

/** Tentative delivery date: 3 business days (Sundays skipped) after `from`. Null when out of stock. */
export function deliveryEstimate(inStock: boolean, from = new Date(), days = 3): string | null {
  if (!inStock) return null;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) added++;
  }
  return d.toISOString().slice(0, 10);
}

export type OrderStatus = 'payment_pending' | 'payment_failed' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

const HOUR = 3600 * 1000;
/** Fulfilment progress is derived from order age so the demo shows realistic tracking without a worker. */
export const FULFILMENT_STEPS = [
  { status: 'confirmed' as const, label: 'Order confirmed', afterHours: 0 },
  { status: 'processing' as const, label: 'Packed & processing', afterHours: 6 },
  { status: 'shipped' as const, label: 'Shipped', afterHours: 48 },
  { status: 'delivered' as const, label: 'Delivered', afterHours: 120 },
];

export function effectiveStatus(stored: OrderStatus, createdAt: Date | string, now = new Date()): OrderStatus {
  if (stored !== 'confirmed') return stored;
  const ageH = (now.getTime() - new Date(createdAt).getTime()) / HOUR;
  let current: OrderStatus = 'confirmed';
  for (const s of FULFILMENT_STEPS) if (ageH >= s.afterHours) current = s.status;
  return current;
}

export interface CancellationInfo {
  allowed: boolean;
  deadline: string;
  hoursRemaining: number;
  reason: string | null;
}

export function cancellationInfo(stored: OrderStatus, createdAt: Date | string, now = new Date()): CancellationInfo {
  const created = new Date(createdAt);
  const deadline = new Date(created.getTime() + CANCEL_WINDOW_HOURS * HOUR);
  const remaining = Math.max(0, (deadline.getTime() - now.getTime()) / HOUR);
  const status = effectiveStatus(stored, created, now);
  let reason: string | null = null;
  if (status === 'cancelled') reason = 'Order is already cancelled';
  else if (status === 'payment_failed') reason = 'Payment failed - nothing to cancel';
  else if (now >= deadline) reason = `The ${CANCEL_WINDOW_HOURS}-hour cancellation window has ended`;
  else if (status === 'shipped' || status === 'delivered') reason = `Order is ${status} and can no longer be cancelled`;
  return { allowed: reason === null, deadline: deadline.toISOString(), hoursRemaining: Math.round(remaining * 10) / 10, reason };
}
