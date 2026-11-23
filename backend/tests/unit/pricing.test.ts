import { cancellationInfo, computeTotals, couponError, CouponLike, deliveryEstimate, effectiveStatus, salePrice } from '../../src/utils/pricing';

const coupon = (o: Partial<CouponLike> = {}): CouponLike => ({
  code: 'T', discount_type: 'percent', value: 10, max_discount: null, min_order: 0, valid_from: new Date(Date.now() - 1e6), valid_until: null, usage_limit: null, used_count: 0, is_active: true, ...o,
});

describe('salePrice', () => {
  it('applies percentage discount with 2dp rounding', () => {
    expect(salePrice(399, 0)).toBe(399);
    expect(salePrice(399, 10)).toBe(359.1);
    expect(salePrice(299, 15)).toBe(254.15);
  });
});

describe('computeTotals', () => {
  const items = [{ listPrice: 200, discountPercent: 10, quantity: 2 }]; // sale 180 x2 = 360

  it('computes subtotal, tax (5%), shipping fee below threshold', () => {
    const t = computeTotals({ items: [{ listPrice: 100, discountPercent: 0, quantity: 1 }] });
    expect(t.subtotal).toBe(100);
    expect(t.tax).toBe(5);
    expect(t.shipping).toBe(49);
    expect(t.total).toBe(154);
  });

  it('gives free shipping at/above Rs 499 and tracks book discount', () => {
    const t = computeTotals({ items: [{ listPrice: 600, discountPercent: 10, quantity: 1 }] });
    expect(t.subtotal).toBe(540);
    expect(t.bookDiscount).toBe(60);
    expect(t.shipping).toBe(0);
  });

  it('applies percent coupon with cap', () => {
    const t = computeTotals({ items: [{ listPrice: 2000, discountPercent: 0, quantity: 1 }], coupon: coupon({ value: 20, max_discount: 300 }) });
    expect(t.couponDiscount).toBe(300);
  });

  it('applies flat coupon and shipping coupon', () => {
    expect(computeTotals({ items, coupon: coupon({ discount_type: 'flat', value: 50 }) }).couponDiscount).toBe(50);
    const s = computeTotals({ items: [{ listPrice: 100, discountPercent: 0, quantity: 1 }], coupon: coupon({ discount_type: 'shipping', value: 0 }) });
    expect(s.shipping).toBe(0);
    expect(s.couponDiscount).toBe(0);
  });

  it('redeems points, capped at 50% of payable and at the balance', () => {
    const base = computeTotals({ items, pointsBalance: 1000 });
    expect(base.maxRedeemablePoints).toBe(Math.floor((base.total * 0.5)));
    const t = computeTotals({ items, pointsBalance: 1000, pointsToRedeem: 100 });
    expect(t.pointsDiscount).toBe(100);
    expect(t.total).toBe(base.total - 100);
    expect(computeTotals({ items, pointsBalance: 20 }).maxRedeemablePoints).toBe(20);
  });

  it('rejects redeeming more than allowed or a negative/non-integer amount', () => {
    expect(() => computeTotals({ items, pointsBalance: 10, pointsToRedeem: 11 })).toThrow(/at most 10/);
    expect(() => computeTotals({ items, pointsBalance: 10, pointsToRedeem: -1 })).toThrow();
    expect(() => computeTotals({ items, pointsBalance: 10, pointsToRedeem: 1.5 })).toThrow();
  });

  it('earns 1 point per Rs 10 paid', () => {
    const t = computeTotals({ items, pointsBalance: 0 });
    expect(t.pointsToEarn).toBe(Math.floor(t.total / 10));
  });

  it('handles an empty basket', () => {
    const t = computeTotals({ items: [] });
    expect(t.total).toBe(0);
    expect(t.shipping).toBe(0);
  });
});

describe('couponError', () => {
  it.each([
    ['missing', null, 500, 'Invalid'],
    ['inactive', coupon({ is_active: false }), 500, 'Invalid'],
    ['expired', coupon({ valid_until: new Date(Date.now() - 1000) }), 500, 'expired'],
    ['not started', coupon({ valid_from: new Date(Date.now() + 1e6) }), 500, 'not active'],
    ['limit reached', coupon({ usage_limit: 1, used_count: 1 }), 500, 'limit'],
    ['below minimum', coupon({ min_order: 800 }), 500, 'Minimum order'],
  ])('rejects %s coupon', (_n, c, subtotal, msg) => {
    expect(couponError(c as any, subtotal as number)).toMatch(new RegExp(msg as string));
  });
  it('accepts a valid coupon', () => expect(couponError(coupon(), 500)).toBeNull());
});

describe('cancellation window (48 hours)', () => {
  const now = new Date('2025-01-10T12:00:00Z');
  const ago = (h: number) => new Date(now.getTime() - h * 3600_000);

  it('allows cancellation inside 48h', () => {
    const i = cancellationInfo('confirmed', ago(10), now);
    expect(i.allowed).toBe(true);
    expect(i.hoursRemaining).toBe(38);
  });
  it('allows at 47h59m', () => expect(cancellationInfo('confirmed', new Date(now.getTime() - (48 * 3600_000 - 60_000)), now).allowed).toBe(true));
  it('blocks at exactly 48h and after', () => {
    const i = cancellationInfo('confirmed', ago(48), now);
    expect(i.allowed).toBe(false);
    expect(i.reason).toMatch(/48-hour/);
    expect(cancellationInfo('confirmed', ago(100), now).allowed).toBe(false);
  });
  it('blocks already cancelled / failed orders', () => {
    expect(cancellationInfo('cancelled', ago(1), now).allowed).toBe(false);
    expect(cancellationInfo('payment_failed', ago(1), now).allowed).toBe(false);
  });
});

describe('effectiveStatus', () => {
  const now = new Date('2025-01-10T12:00:00Z');
  const ago = (h: number) => new Date(now.getTime() - h * 3600_000);
  it('derives fulfilment progress from order age', () => {
    expect(effectiveStatus('confirmed', ago(1), now)).toBe('confirmed');
    expect(effectiveStatus('confirmed', ago(7), now)).toBe('processing');
    expect(effectiveStatus('confirmed', ago(49), now)).toBe('shipped');
    expect(effectiveStatus('confirmed', ago(130), now)).toBe('delivered');
  });
  it('never overrides terminal statuses', () => {
    expect(effectiveStatus('cancelled', ago(130), now)).toBe('cancelled');
    expect(effectiveStatus('payment_pending', ago(130), now)).toBe('payment_pending');
  });
});

describe('deliveryEstimate', () => {
  it('returns null when out of stock', () => expect(deliveryEstimate(false)).toBeNull());
  it('skips Sundays', () => {
    // Friday 2025-01-10 + 3 business days (Sat, Mon, Tue) = Tue 2025-01-14
    expect(deliveryEstimate(true, new Date('2025-01-10T09:00:00Z'))).toBe('2025-01-14');
  });
});
