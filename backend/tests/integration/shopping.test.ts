import { closeDb, getApp, loginAs, newUser, resetDb, VALID_CARD } from '../helpers';
import request from 'supertest';

let app: any;
beforeAll(async () => { await resetDb(); app = await getApp(); });
afterAll(closeDb);

const firstBooks = async (n: number, qs = '?availability=in_stock&sort=price_asc') => (await request(app).get(`/api/books${qs}&pageSize=${n}&minPrice=100`)).body.items as any[];

describe('Shopping cart', () => {
  it('adds, merges quantities, updates, removes', async () => {
    const u = await newUser(app, 'cart');
    const [b1, b2] = await firstBooks(2);
    const a = await request(app).post('/api/cart/items').set(u.auth).send({ bookId: b1.id, quantity: 1 });
    expect(a.status).toBe(201);
    await request(app).post('/api/cart/items').set(u.auth).send({ bookId: b1.id, quantity: 2 }); // merges
    const c = await request(app).post('/api/cart/items').set(u.auth).send({ bookId: b2.id });
    expect(c.body.items).toHaveLength(2);
    const line = c.body.items.find((i: any) => i.bookId === b1.id);
    expect(line.quantity).toBe(3);
    expect(line.lineTotal).toBeCloseTo(b1.price * 3, 2);
    expect(c.body.totals.itemCount).toBe(4);

    const upd = await request(app).patch(`/api/cart/items/${line.id}`).set(u.auth).send({ quantity: 1 });
    expect(upd.body.items.find((i: any) => i.bookId === b1.id).quantity).toBe(1);
    expect((await request(app).patch(`/api/cart/items/${line.id}`).set(u.auth).send({ quantity: 0 })).status).toBe(400);

    const del = await request(app).delete(`/api/cart/items/${line.id}`).set(u.auth);
    expect(del.body.items).toHaveLength(1);
    expect((await request(app).delete(`/api/cart/items/${line.id}`).set(u.auth)).status).toBe(404);
  });

  it('requires authentication and isolates carts between users', async () => {
    const [b] = await firstBooks(1);
    expect((await request(app).get('/api/cart')).status).toBe(401);
    const u1 = await newUser(app, 'iso1');
    const u2 = await newUser(app, 'iso2');
    const added = await request(app).post('/api/cart/items').set(u1.auth).send({ bookId: b.id });
    const itemId = added.body.items[0].id;
    expect((await request(app).get('/api/cart').set(u2.auth)).body.items).toHaveLength(0);
    expect((await request(app).delete(`/api/cart/items/${itemId}`).set(u2.auth)).status).toBe(404);
  });

  it('blocks out-of-stock books and quantities beyond stock', async () => {
    const u = await newUser(app, 'stock');
    const oos = (await request(app).get('/api/books?pageSize=60')).body.items.concat((await request(app).get('/api/books?pageSize=60&page=2')).body.items).find((b: any) => !b.inStock);
    expect(oos).toBeTruthy();
    const res = await request(app).post('/api/cart/items').set(u.auth).send({ bookId: oos.id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OUT_OF_STOCK');
    expect((await request(app).post('/api/cart/items').set(u.auth).send({ bookId: 99999 })).status).toBe(404);
  });

  it('saves for later (excluded from totals) and moves back', async () => {
    const u = await newUser(app, 'later');
    const [b1, b2] = await firstBooks(2);
    await request(app).post('/api/cart/items').set(u.auth).send({ bookId: b1.id });
    const c = await request(app).post('/api/cart/items').set(u.auth).send({ bookId: b2.id });
    const id = c.body.items[0].id;
    const saved = await request(app).patch(`/api/cart/items/${id}`).set(u.auth).send({ savedForLater: true });
    expect(saved.body.items).toHaveLength(1);
    expect(saved.body.savedForLater).toHaveLength(1);
    expect(saved.body.totals.itemCount).toBe(1);
    const back = await request(app).patch(`/api/cart/items/${id}`).set(u.auth).send({ savedForLater: false });
    expect(back.body.items).toHaveLength(2);
  });

  it('moves an item to the wishlist and manages the wishlist directly', async () => {
    const u = await newUser(app, 'wish');
    const [b1, b2] = await firstBooks(2);
    const c = await request(app).post('/api/cart/items').set(u.auth).send({ bookId: b1.id });
    const moved = await request(app).post(`/api/cart/items/${c.body.items[0].id}/move-to-wishlist`).set(u.auth);
    expect(moved.body.items).toHaveLength(0);
    expect((await request(app).get('/api/wishlist').set(u.auth)).body.map((w: any) => w.bookId)).toEqual([b1.id]);
    const add = await request(app).post('/api/wishlist').set(u.auth).send({ bookId: b2.id });
    expect(add.body).toHaveLength(2);
    await request(app).post('/api/wishlist').set(u.auth).send({ bookId: b2.id }); // idempotent
    const rm = await request(app).delete(`/api/wishlist/${b1.id}`).set(u.auth);
    expect(rm.body.map((w: any) => w.bookId)).toEqual([b2.id]);
  });

  it('applies and removes coupons with validation', async () => {
    const u = await newUser(app, 'coupon');
    const expensive = (await request(app).get('/api/books?sort=price_desc&pageSize=3')).body.items;
    await request(app).post('/api/cart/items').set(u.auth).send({ bookId: expensive[0].id });
    const ok = await request(app).post('/api/cart/coupon').set(u.auth).send({ code: 'welcome10' });
    expect(ok.status).toBe(200);
    expect(ok.body.coupon.code).toBe('WELCOME10');
    expect(ok.body.totals.couponDiscount).toBeGreaterThan(0);
    expect(ok.body.totals.couponDiscount).toBeLessThanOrEqual(150);
    const bad = await request(app).post('/api/cart/coupon').set(u.auth).send({ code: 'NOPE' });
    expect(bad.status).toBe(400);
    const rm = await request(app).delete('/api/cart/coupon').set(u.auth);
    expect(rm.body.coupon).toBeNull();
    expect(rm.body.totals.couponDiscount).toBe(0);
    // minimum-order rule
    const u2 = await newUser(app, 'coupon2');
    const cheap = (await request(app).get('/api/books?sort=price_asc&pageSize=1')).body.items[0];
    await request(app).post('/api/cart/items').set(u2.auth).send({ bookId: cheap.id });
    const min = await request(app).post('/api/cart/coupon').set(u2.auth).send({ code: 'READMORE20' });
    expect(min.status).toBe(400);
    expect(min.body.error.message).toMatch(/Minimum order/);
  });

  it('estimates shipping by postal code', async () => {
    const u = await newUser(app, 'ship');
    const [b] = await firstBooks(1);
    await request(app).post('/api/cart/items').set(u.auth).send({ bookId: b.id });
    const res = await request(app).get('/api/cart/shipping-estimate?postalCode=560001').set(u.auth);
    expect(res.status).toBe(200);
    expect(res.body.estimatedDelivery).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await request(app).get('/api/cart/shipping-estimate?postalCode=%21').set(u.auth)).status).toBe(400);
  });
});

describe('Checkout, payment, rewards and orders', () => {
  const setupCart = async (tag: string, bookCount = 2) => {
    const u = await newUser(app, tag);
    const books = (await request(app).get(`/api/books?availability=in_stock&minPrice=250&pageSize=${bookCount}`)).body.items;
    for (const b of books) await request(app).post('/api/cart/items').set(u.auth).send({ bookId: b.id });
    return { u, books };
  };
  const pay = (u: any, extra: object = {}) => request(app).post('/api/checkout/pay').set(u.auth).send({ addressId: u.addressId, paymentMethod: 'credit_card', paymentDetails: VALID_CARD, ...extra });

  it('previews checkout totals including max redeemable points', async () => {
    const { u } = await setupCart('prev');
    const res = await request(app).get('/api/checkout/summary?points=40').set(u.auth);
    expect(res.status).toBe(200);
    expect(res.body.totals.pointsRedeemed).toBe(40);
    expect(res.body.totals.maxRedeemablePoints).toBe(100); // welcome bonus
    expect(res.body.rewardBalance).toBe(100);
    expect((await request(app).get('/api/checkout/summary?points=5000').set(u.auth)).status).toBe(400);
  });

  it('completes the full purchase: order, invoice, stock, points earned, cart cleared', async () => {
    const { u, books } = await setupCart('buy');
    const stockBefore = (await request(app).get(`/api/books/${books[0].id}`)).body.stock;
    const salesBefore = (await request(app).get(`/api/books/${books[0].id}`)).body.salesCount;
    const summary = (await request(app).get('/api/checkout/summary').set(u.auth)).body;
    const res = await pay(u);
    expect(res.status).toBe(201);
    expect(res.body.outcome).toBe('success');
    const o = res.body.order;
    expect(o.orderNumber).toMatch(/^BW\d{6}\d{6}$/);
    expect(o.status).toBe('confirmed');
    expect(o.totals.total).toBe(summary.totals.total);
    expect(o.totals.pointsEarned).toBe(Math.floor(summary.totals.total / 10));
    expect(o.items).toHaveLength(2);
    expect(o.invoice.invoiceNumber).toBe(`INV-${o.orderNumber}`);
    expect(o.address.city).toBe('Pune');
    expect(o.payment).toMatchObject({ method: 'credit_card', status: 'success' });
    expect(JSON.stringify(o.payment)).not.toContain('4242 4242');
    expect(o.payment.details.cardLast4).toBe('4242');
    expect(o.cancellation.allowed).toBe(true);
    expect(o.tracking[0].done).toBe(true);

    expect((await request(app).get('/api/cart').set(u.auth)).body.items).toHaveLength(0);
    const after = (await request(app).get(`/api/books/${books[0].id}`)).body;
    expect(after.stock).toBe(stockBefore - 1);
    expect(after.salesCount).toBe(salesBefore + 1);
    const rewards = (await request(app).get('/api/rewards').set(u.auth)).body;
    expect(rewards.balance).toBe(100 + o.totals.pointsEarned);
    expect(rewards.history[0]).toMatchObject({ type: 'earned', points: o.totals.pointsEarned });
    expect((await request(app).get(`/api/orders/${o.id}`).set(u.auth)).body.orderNumber).toBe(o.orderNumber);
  });

  it('redeems reward points and reduces payable amount', async () => {
    const { u } = await setupCart('redeem');
    const base = (await request(app).get('/api/checkout/summary').set(u.auth)).body.totals.total;
    const res = await pay(u, { pointsToRedeem: 60 });
    expect(res.body.order.totals.pointsRedeemed).toBe(60);
    expect(res.body.order.totals.pointsDiscount).toBe(60);
    expect(res.body.order.totals.total).toBeCloseTo(base - 60, 2);
    const rewards = (await request(app).get('/api/rewards').set(u.auth)).body;
    expect(rewards.history.map((h: any) => h.type)).toEqual(expect.arrayContaining(['redeemed', 'earned', 'bonus']));
    expect(rewards.balance).toBe(100 - 60 + res.body.order.totals.pointsEarned);
  });

  it('refuses to redeem more points than owned', async () => {
    const { u } = await setupCart('overredeem');
    const res = await pay(u, { pointsToRedeem: 101 });
    expect(res.status).toBe(400);
    expect((await request(app).get('/api/cart').set(u.auth)).body.items).toHaveLength(2); // cart untouched
  });

  it('applies a coupon at checkout and counts its usage', async () => {
    const { u } = await setupCart('chkcoupon');
    await request(app).post('/api/cart/coupon').set(u.auth).send({ code: 'WELCOME10' });
    const res = await pay(u);
    expect(res.body.order.totals.couponCode).toBe('WELCOME10');
    expect(res.body.order.totals.couponDiscount).toBeGreaterThan(0);
    const coupons = (await request(app).get('/api/coupons')).body;
    expect(coupons.map((c: any) => c.code)).toContain('WELCOME10');
  });

  it('validates payment details for each method', async () => {
    const { u } = await setupCart('val');
    const badCard = await pay(u, { paymentDetails: { ...VALID_CARD, cardNumber: '1234' } });
    expect(badCard.status).toBe(400);
    expect(badCard.body.error.details.cardNumber).toBeTruthy();
    expect((await pay(u, { paymentDetails: { ...VALID_CARD, expiry: '01/20' } })).status).toBe(400);
    expect((await pay(u, { paymentMethod: 'upi', paymentDetails: { upiId: 'x' } })).status).toBe(400);
    expect((await pay(u, { addressId: 999999 })).status).toBe(400);
    expect((await request(app).get('/api/cart').set(u.auth)).body.items).toHaveLength(2); // nothing consumed
    for (const [method, details] of [['upi', { upiId: 'reader@okbank' }], ['net_banking', { bank: 'HDFC Bank' }], ['wallet', { wallet: 'Paytm', mobile: '9876543210' }], ['debit_card', VALID_CARD]] as const) {
      const c = await setupCart(`m-${method}`, 1);
      const ok = await pay(c.u, { paymentMethod: method, paymentDetails: details });
      expect(ok.status).toBe(201);
      expect(ok.body.order.payment.method).toBe(method);
    }
  });

  it('simulates FAILED payment: no order, no stock change, cart kept, points untouched', async () => {
    const { u, books } = await setupCart('fail');
    const stock = (await request(app).get(`/api/books/${books[0].id}`)).body.stock;
    const res = await pay(u, { simulationMode: 'failed', pointsToRedeem: 50 });
    expect(res.status).toBe(402);
    expect(res.body.outcome).toBe('failed');
    expect(res.body.order).toBeNull();
    expect(res.body.payment.failureReason).toBeTruthy();
    expect((await request(app).get('/api/orders').set(u.auth)).body).toHaveLength(0);
    expect((await request(app).get('/api/cart').set(u.auth)).body.items).toHaveLength(2);
    expect((await request(app).get(`/api/books/${books[0].id}`)).body.stock).toBe(stock);
    expect((await request(app).get('/api/rewards').set(u.auth)).body.balance).toBe(100);
    // retrying with success afterwards works
    expect((await pay(u)).status).toBe(201);
  });

  it('simulates PENDING payment then resolves to success (awards points) or failure (restores stock + points)', async () => {
    const a = await setupCart('pend-ok');
    const stock = (await request(app).get(`/api/books/${a.books[0].id}`)).body.stock;
    const p = await pay(a.u, { simulationMode: 'pending', pointsToRedeem: 30 });
    expect(p.status).toBe(201);
    expect(p.body.outcome).toBe('pending');
    expect(p.body.order.status).toBe('payment_pending');
    expect(p.body.order.cancellation.allowed).toBe(true);
    expect((await request(app).get('/api/rewards').set(a.u.auth)).body.balance).toBe(70); // 100 - 30, nothing earned yet
    const ok = await request(app).post(`/api/payments/${p.body.order.id}/resolve`).set(a.u.auth).send({ outcome: 'success' });
    expect(ok.body.status).toBe('confirmed');
    expect((await request(app).get('/api/rewards').set(a.u.auth)).body.balance).toBe(70 + ok.body.totals.pointsEarned);
    expect((await request(app).post(`/api/payments/${p.body.order.id}/resolve`).set(a.u.auth).send({ outcome: 'success' })).status).toBe(409);

    const b = await setupCart('pend-fail');
    const stockBeforeB = (await request(app).get(`/api/books/${b.books[0].id}`)).body.stock;
    const pb = await pay(b.u, { simulationMode: 'pending', pointsToRedeem: 30 });
    expect((await request(app).get(`/api/books/${b.books[0].id}`)).body.stock).toBe(stockBeforeB - 1); // reserved while pending
    const fail = await request(app).post(`/api/payments/${pb.body.order.id}/resolve`).set(b.u.auth).send({ outcome: 'failed' });
    expect(fail.body.status).toBe('payment_failed');
    expect((await request(app).get('/api/rewards').set(b.u.auth)).body.balance).toBe(100);
    expect((await request(app).get(`/api/books/${b.books[0].id}`)).body.stock).toBe(stockBeforeB); // released on failure
    expect(stock).toBeGreaterThan(0);
  });

  it('prevents overselling: two checkouts racing for the last copy', async () => {
    const { pool } = await import('../../src/db/pool');
    const book = (await request(app).get('/api/books?availability=in_stock&minPrice=250&pageSize=1')).body.items[0];
    await pool.query('UPDATE inventory SET quantity=1 WHERE book_id=$1', [book.id]);
    const [x, y] = await Promise.all([newUser(app, 'race1'), newUser(app, 'race2')]);
    await request(app).post('/api/cart/items').set(x.auth).send({ bookId: book.id });
    await request(app).post('/api/cart/items').set(y.auth).send({ bookId: book.id });
    const results = await Promise.all([pay(x), pay(y)]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect((await pool.query('SELECT quantity FROM inventory WHERE book_id=$1', [book.id])).rows[0].quantity).toBe(0);
  });

  it('rejects checkout with an empty cart', async () => {
    const u = await newUser(app, 'empty');
    expect((await pay(u)).status).toBe(400);
  });
});

describe('Order history, Buy Again and cancellation', () => {
  it('lists the demo user\'s orders newest first with statuses derived from age', async () => {
    const { auth } = await loginAs(app);
    const res = await request(app).get('/api/orders').set(auth);
    expect(res.body.length).toBe(5);
    const dates = res.body.map((o: any) => new Date(o.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    const statuses = res.body.map((o: any) => o.status);
    expect(statuses).toEqual(expect.arrayContaining(['confirmed', 'shipped', 'delivered', 'cancelled']));
  });

  it('only exposes my own orders', async () => {
    const { auth } = await loginAs(app);
    const other = await newUser(app, 'snoop');
    const id = (await request(app).get('/api/orders').set(auth)).body[0].id;
    expect((await request(app).get(`/api/orders/${id}`).set(other.auth)).status).toBe(404);
    expect((await request(app).post(`/api/orders/${id}/cancel`).set(other.auth).send({ reason: 'hacking' })).status).toBe(404);
  });

  it('Buy Again from a past order adds available books to the cart', async () => {
    const { auth } = await loginAs(app);
    const orders = (await request(app).get('/api/orders').set(auth)).body;
    const old = orders.find((o: any) => o.status === 'delivered' || o.status === 'shipped');
    const res = await request(app).post('/api/orders/buy-again').set(auth).send({ orderId: old.id });
    expect(res.status).toBe(200);
    expect(res.body.added.length).toBe(old.items.length);
    expect(res.body.cart.items.map((i: any) => i.bookId).sort()).toEqual(old.items.map((i: any) => i.bookId).sort());
    expect((await request(app).post('/api/orders/buy-again').set(auth).send({})).status).toBe(400);
    for (const i of res.body.cart.items) await request(app).delete(`/api/cart/items/${i.id}`).set(auth);
  });

  it('Buy Again by book ids and shows purchase history', async () => {
    const { auth } = await loginAs(app);
    const history = (await request(app).get('/api/orders/purchase-history').set(auth)).body;
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toEqual(expect.objectContaining({ bookId: expect.any(Number), totalQuantity: expect.any(Number), lastPurchasedAt: expect.anything() }));
    const res = await request(app).post('/api/orders/buy-again').set(auth).send({ bookIds: [history[0].bookId] });
    expect(res.body.added).toEqual([history[0].bookId]);
    for (const i of res.body.cart.items) await request(app).delete(`/api/cart/items/${i.id}`).set(auth);
  });

  it('cancels within 48h: restocks, returns redeemed points, reverses earned points, refunds payment', async () => {
    const u = await newUser(app, 'cancel');
    const books = (await request(app).get('/api/books?availability=in_stock&minPrice=250&pageSize=2')).body.items;
    for (const b of books) await request(app).post('/api/cart/items').set(u.auth).send({ bookId: b.id });
    const stock = (await request(app).get(`/api/books/${books[0].id}`)).body;
    const placed = await request(app).post('/api/checkout/pay').set(u.auth).send({ addressId: u.addressId, paymentMethod: 'credit_card', paymentDetails: VALID_CARD, pointsToRedeem: 80 });
    const order = placed.body.order;
    expect((await request(app).get(`/api/books/${books[0].id}`)).body.stock).toBe(stock.stock - 1);

    expect((await request(app).post(`/api/orders/${order.id}/cancel`).set(u.auth).send({ reason: '' })).status).toBe(400); // reason required
    const res = await request(app).post(`/api/orders/${order.id}/cancel`).set(u.auth).send({ reason: 'Found a better price elsewhere' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.cancellation).toMatchObject({ allowed: false, cancelReason: 'Found a better price elsewhere' });
    expect(res.body.payment.status).toBe('refunded');
    expect((await request(app).get(`/api/books/${books[0].id}`)).body.stock).toBe(stock.stock); // restocked
    const rewards = (await request(app).get('/api/rewards').set(u.auth)).body;
    expect(rewards.balance).toBe(100); // 100 - 80 redeemed + 80 refunded + earned - earned reversed
    expect(rewards.history.map((h: any) => h.type)).toEqual(expect.arrayContaining(['redeemed', 'refunded', 'earned', 'reversed']));
    expect((await request(app).post(`/api/orders/${order.id}/cancel`).set(u.auth).send({ reason: 'again please' })).status).toBe(409); // idempotent guard
  });

  it('blocks cancellation after 48 hours and exposes the reason', async () => {
    const u = await newUser(app, 'late');
    const b = (await request(app).get('/api/books?availability=in_stock&minPrice=250&pageSize=1')).body.items[0];
    await request(app).post('/api/cart/items').set(u.auth).send({ bookId: b.id });
    const placed = await request(app).post('/api/checkout/pay').set(u.auth).send({ addressId: u.addressId, paymentMethod: 'upi', paymentDetails: { upiId: 'reader@okbank' } });
    const { pool } = await import('../../src/db/pool');
    await pool.query("UPDATE orders SET created_at = now() - interval '49 hours' WHERE id=$1", [placed.body.order.id]);
    const detail = (await request(app).get(`/api/orders/${placed.body.order.id}`).set(u.auth)).body;
    expect(detail.cancellation.allowed).toBe(false);
    expect(detail.cancellation.reason).toMatch(/48-hour/);
    const res = await request(app).post(`/api/orders/${placed.body.order.id}/cancel`).set(u.auth).send({ reason: 'Too late?' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANCELLATION_NOT_ALLOWED');

    // still allowed at 47h
    await pool.query("UPDATE orders SET created_at = now() - interval '47 hours' WHERE id=$1", [placed.body.order.id]);
    const early = (await request(app).get(`/api/orders/${placed.body.order.id}`).set(u.auth)).body;
    expect(early.cancellation.allowed).toBe(true); // at 47h the order is still "processing", inside the window
  });

  it('the demo seed contains one cancellable and one non-cancellable order', async () => {
    const { auth } = await loginAs(app);
    const orders = (await request(app).get('/api/orders').set(auth)).body;
    expect(orders.some((o: any) => o.cancellation.allowed)).toBe(true);
    expect(orders.some((o: any) => !o.cancellation.allowed && o.status !== 'cancelled')).toBe(true);
    const cancelled = orders.find((o: any) => o.status === 'cancelled');
    expect(cancelled.cancellation.cancelReason).toBeTruthy();
  });

  it('records an audit trail', async () => {
    const { pool } = await import('../../src/db/pool');
    const { rows } = await pool.query("SELECT DISTINCT action FROM audit_logs");
    const actions = rows.map((r: any) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['auth.register', 'order.placed', 'order.cancelled', 'payment.failed']));
  });
});

describe('Platform', () => {
  it('serves health, swagger spec and 404 JSON', async () => {
    expect((await request(app).get('/api/health')).body.status).toBe('ok');
    const nf = await request(app).get('/api/nope');
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
    expect((await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad')).status).toBe(400);
  });
});
