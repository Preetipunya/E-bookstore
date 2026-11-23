import crypto from 'crypto';
import { PoolClient } from 'pg';
import { Db, pool, query, queryOne, withTransaction } from '../db/pool';
import { badRequest, conflict, notFound } from '../utils/errors';
import { PaymentMethod, validatePaymentDetails } from '../utils/paymentValidation';
import { cancellationInfo, computeTotals, couponError, deliveryEstimate, effectiveStatus, FULFILMENT_STEPS, OrderStatus, salePrice } from '../utils/pricing';
import { clearActiveItems, getCoupon, loadCartRows } from './cartService';
import { addPoints, audit } from './ledger';

export type SimulationMode = 'success' | 'failed' | 'pending';

export interface PayInput {
  addressId: number;
  paymentMethod: PaymentMethod;
  paymentDetails?: Record<string, any>;
  pointsToRedeem?: number;
  simulationMode?: SimulationMode;
}

const orderNumber = () => `BW${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${crypto.randomInt(100000, 999999)}`;
const txRef = () => `TXN${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

// ---------------------------------------------------------------- serialization
export async function loadOrder(userId: number, idOrNumber: string | number, db: Db = pool) {
  const isId = typeof idOrNumber === 'number';
  const order = await queryOne(`SELECT * FROM orders WHERE user_id=$1 AND ${isId ? 'id' : 'order_number'}=$2`, [userId, idOrNumber], db);
  if (!order) throw notFound('Order not found');
  return serializeOrder(order, db);
}

export async function serializeOrder(o: any, db: Db = pool) {
  const items = await query(
    `SELECT oi.*, EXISTS(SELECT 1 FROM inventory i WHERE i.book_id=oi.book_id AND i.quantity>0) AS in_stock FROM order_items oi WHERE order_id=$1 ORDER BY oi.id`,
    [o.id],
    db,
  );
  const payment = await queryOne('SELECT * FROM payments WHERE order_id=$1 ORDER BY id DESC LIMIT 1', [o.id], db);
  const status = effectiveStatus(o.status, o.created_at);
  const cancel = cancellationInfo(o.status, o.created_at);
  const created = new Date(o.created_at).getTime();
  const tracking =
    status === 'cancelled' || status === 'payment_failed' || status === 'payment_pending'
      ? []
      : FULFILMENT_STEPS.map((s) => ({
          status: s.status,
          label: s.label,
          done: (Date.now() - created) / 3600000 >= s.afterHours,
          at: new Date(created + s.afterHours * 3600000).toISOString(),
        }));
  return {
    id: o.id,
    orderNumber: o.order_number,
    status,
    createdAt: o.created_at,
    items: items.map((i: any) => ({
      bookId: i.book_id,
      title: i.title,
      author: i.author,
      quantity: i.quantity,
      listPrice: Number(i.list_price),
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
      inStock: i.in_stock,
      coverUrl: `/api/books/${i.book_id}/cover.svg`,
    })),
    address: { fullName: o.ship_name, phone: o.ship_phone, line1: o.ship_line1, line2: o.ship_line2, city: o.ship_city, state: o.ship_state, country: o.ship_country, postalCode: o.ship_postal },
    totals: {
      subtotal: Number(o.subtotal),
      bookDiscount: Number(o.book_discount),
      couponCode: o.coupon_code,
      couponDiscount: Number(o.coupon_discount),
      tax: Number(o.tax),
      shipping: Number(o.shipping),
      pointsRedeemed: o.points_redeemed,
      pointsDiscount: Number(o.points_discount),
      total: Number(o.total),
      pointsEarned: o.points_earned,
    },
    payment: payment ? { id: payment.id, method: payment.method, status: payment.status, amount: Number(payment.amount), transactionRef: payment.transaction_ref, details: payment.details_masked } : null,
    cancellation: { ...cancel, cancelledAt: o.cancelled_at, cancelReason: o.cancel_reason },
    tracking,
    estimatedDelivery: status === 'delivered' || status === 'cancelled' ? null : deliveryEstimate(true, new Date(o.created_at), 4),
    invoice: {
      invoiceNumber: `INV-${o.order_number}`,
      issuedAt: o.created_at,
      lines: items.map((i: any) => ({ description: i.title, quantity: i.quantity, unitPrice: Number(i.unit_price), amount: Number(i.line_total) })),
    },
  };
}

export async function listOrders(userId: number) {
  const rows = await query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
  return Promise.all(rows.map((r: any) => serializeOrder(r)));
}

export async function purchaseHistory(userId: number) {
  return query(
    `SELECT oi.book_id AS "bookId", oi.title, oi.author, SUM(oi.quantity)::int AS "totalQuantity", SUM(oi.line_total) AS "totalSpent",
            MAX(o.created_at) AS "lastPurchasedAt", COUNT(DISTINCT o.id)::int AS "orderCount", '/api/books/' || oi.book_id || '/cover.svg' AS "coverUrl"
       FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE o.user_id=$1 AND o.status IN ('confirmed','processing','shipped','delivered')
      GROUP BY oi.book_id, oi.title, oi.author ORDER BY MAX(o.created_at) DESC`,
    [userId],
  );
}

// ---------------------------------------------------------------- checkout
export async function previewCheckout(userId: number, pointsToRedeem = 0, couponCode?: string | null) {
  const { getCart } = await import('./cartService');
  return getCart(userId, { pointsToRedeem, couponCodeOverride: couponCode });
}

async function applyStockAndSales(client: PoolClient, bookId: number, delta: number) {
  // delta negative = sell, positive = restock
  const r = await client.query('UPDATE inventory SET quantity = quantity + $2, updated_at=now() WHERE book_id=$1 RETURNING quantity', [bookId, delta]);
  if (!r.rowCount) throw notFound('Inventory record missing');
  await client.query('UPDATE books SET sales_count = GREATEST(0, sales_count - $2) WHERE id=$1', [bookId, delta]);
}

export async function pay(userId: number, input: PayInput) {
  const mode: SimulationMode = input.simulationMode ?? 'success';
  const maskedDetails = validatePaymentDetails(input.paymentMethod, input.paymentDetails);

  return withTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const address = await queryOne('SELECT * FROM addresses WHERE id=$1 AND user_id=$2', [input.addressId, userId], client);
    if (!address) throw badRequest('Select a valid delivery address');

    const rows = (await loadCartRows(userId, client)).filter((r: any) => !r.saved_for_later);
    if (!rows.length) throw badRequest('Your cart is empty');

    // lock inventory rows in a stable order to avoid deadlocks, then verify stock
    const ids = rows.map((r: any) => r.book_id).sort((a: number, b: number) => a - b);
    const stockRows = await query<{ book_id: number; quantity: number }>('SELECT book_id, quantity FROM inventory WHERE book_id = ANY($1::int[]) ORDER BY book_id FOR UPDATE', [ids], client);
    const stock = new Map(stockRows.map((s) => [s.book_id, s.quantity]));
    for (const r of rows) {
      if ((stock.get(r.book_id) ?? 0) < r.quantity) throw conflict(`"${r.title}" does not have enough stock (${stock.get(r.book_id) ?? 0} left)`, 'INSUFFICIENT_STOCK');
    }

    const cartMeta = await queryOne<{ coupon_code: string | null }>('SELECT coupon_code FROM carts WHERE user_id=$1', [userId], client);
    const user = await queryOne<{ reward_balance: number }>('SELECT reward_balance FROM users WHERE id=$1', [userId], client);
    const priced = rows.map((r: any) => ({ listPrice: Number(r.list_price), discountPercent: Number(r.discount_percent), quantity: r.quantity }));
    let coupon = await getCoupon(cartMeta?.coupon_code, client);
    if (coupon && couponError(coupon, computeTotals({ items: priced }).subtotal)) coupon = null;
    const totals = computeTotals({ items: priced, coupon, pointsToRedeem: input.pointsToRedeem ?? 0, pointsBalance: user?.reward_balance ?? 0 });

    const txn = txRef();
    const method = input.paymentMethod;

    if (mode === 'failed') {
      const p = await queryOne(
        `INSERT INTO payments (order_id,user_id,method,status,amount,transaction_ref,details_masked,failure_reason) VALUES (NULL,$1,$2,'failed',$3,$4,$5,$6) RETURNING *`,
        [userId, method, totals.total, txn, JSON.stringify(maskedDetails), 'Payment declined by the bank (simulated)'],
        client,
      );
      await audit(client, userId, 'payment.failed', 'payment', p.id, { amount: totals.total });
      return { outcome: 'failed' as const, payment: { id: p.id, status: 'failed', transactionRef: txn, amount: totals.total, failureReason: p.failure_reason }, order: null };
    }

    const status: OrderStatus = mode === 'pending' ? 'payment_pending' : 'confirmed';
    const o = await queryOne(
      `INSERT INTO orders (order_number,user_id,address_id,ship_name,ship_phone,ship_line1,ship_line2,ship_city,ship_state,ship_country,ship_postal,
                           status,subtotal,book_discount,coupon_code,coupon_discount,tax,shipping,points_redeemed,points_discount,total,points_earned)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [
        orderNumber(), userId, address.id, address.full_name, address.phone, address.line1, address.line2, address.city, address.state, address.country, address.postal_code,
        status, totals.subtotal, totals.bookDiscount, coupon?.code ?? null, totals.couponDiscount, totals.tax, totals.shipping, totals.pointsRedeemed, totals.pointsDiscount, totals.total,
        status === 'confirmed' ? totals.pointsToEarn : 0,
      ],
      client,
    );

    for (const r of rows) {
      const unit = salePrice(Number(r.list_price), Number(r.discount_percent));
      await client.query(
        'INSERT INTO order_items (order_id,book_id,title,author,list_price,unit_price,quantity,line_total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [o.id, r.book_id, r.title, r.author_name, r.list_price, unit, r.quantity, Math.round(unit * r.quantity * 100) / 100],
      );
      await applyStockAndSales(client, r.book_id, -r.quantity);
    }
    if (totals.pointsRedeemed > 0) await addPoints(client, userId, o.id, -totals.pointsRedeemed, 'redeemed', `Redeemed on order ${o.order_number}`);
    if (status === 'confirmed' && totals.pointsToEarn > 0) await addPoints(client, userId, o.id, totals.pointsToEarn, 'earned', `Earned on order ${o.order_number}`);
    if (coupon) await client.query('UPDATE coupons SET used_count = used_count + 1 WHERE code=$1', [coupon.code]);

    const p = await queryOne(
      `INSERT INTO payments (order_id,user_id,method,status,amount,transaction_ref,details_masked) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [o.id, userId, method, status === 'confirmed' ? 'success' : 'pending', totals.total, txn, JSON.stringify(maskedDetails)],
      client,
    );
    await clearActiveItems(client, userId);
    await audit(client, userId, status === 'confirmed' ? 'order.placed' : 'order.payment_pending', 'order', o.id, { total: totals.total, paymentId: p.id });
    return { outcome: status === 'confirmed' ? ('success' as const) : ('pending' as const), payment: { id: p.id, status: p.status, transactionRef: txn, amount: totals.total }, order: await loadOrder(userId, o.id, client) };
  });
}

/** Resolves a pending (simulated) payment as success or failure. */
export async function resolvePendingPayment(userId: number, orderId: number, outcome: 'success' | 'failed') {
  return withTransaction(async (client) => {
    const o = await queryOne('SELECT * FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE', [orderId, userId], client);
    if (!o) throw notFound('Order not found');
    if (o.status !== 'payment_pending') throw conflict('Order payment is not pending', 'NOT_PENDING');
    if (outcome === 'success') {
      const earn = Math.floor(Number(o.total) / 10);
      await client.query("UPDATE orders SET status='confirmed', points_earned=$2 WHERE id=$1", [orderId, earn]);
      await client.query("UPDATE payments SET status='success' WHERE order_id=$1", [orderId]);
      if (earn > 0) await addPoints(client, userId, orderId, earn, 'earned', `Earned on order ${o.order_number}`);
      await audit(client, userId, 'payment.resolved_success', 'order', orderId);
    } else {
      await releaseOrder(client, userId, o, 'payment_failed', 'Payment failed after pending state (simulated)');
      await client.query("UPDATE payments SET status='failed', failure_reason='Payment failed (simulated)' WHERE order_id=$1", [orderId]);
      await audit(client, userId, 'payment.resolved_failed', 'order', orderId);
    }
    return loadOrder(userId, orderId, client);
  });
}

/** Restores stock + redeemed points for an order that will not be fulfilled. */
async function releaseOrder(client: PoolClient, userId: number, o: any, newStatus: 'cancelled' | 'payment_failed', reason: string) {
  const items = await query<{ book_id: number; quantity: number }>('SELECT book_id, quantity FROM order_items WHERE order_id=$1 ORDER BY book_id', [o.id], client);
  for (const i of items) await applyStockAndSales(client, i.book_id, i.quantity);
  if (o.points_redeemed > 0) await addPoints(client, userId, o.id, o.points_redeemed, 'refunded', `Points returned for order ${o.order_number}`);
  await client.query('UPDATE orders SET status=$2, cancel_reason=$3, cancelled_at=now() WHERE id=$1', [o.id, newStatus, reason]);
}

// ---------------------------------------------------------------- cancellation
export async function cancelOrder(userId: number, orderId: number, reason: string) {
  return withTransaction(async (client) => {
    const o = await queryOne('SELECT * FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE', [orderId, userId], client);
    if (!o) throw notFound('Order not found');
    const info = cancellationInfo(o.status, o.created_at);
    if (!info.allowed) throw conflict(info.reason ?? 'Order cannot be cancelled', 'CANCELLATION_NOT_ALLOWED');

    await releaseOrder(client, userId, o, 'cancelled', reason);
    if (o.points_earned > 0) {
      const bal = await queryOne<{ reward_balance: number }>('SELECT reward_balance FROM users WHERE id=$1', [userId], client);
      const reverse = Math.min(o.points_earned, bal?.reward_balance ?? 0);
      if (reverse > 0) await addPoints(client, userId, o.id, -reverse, 'reversed', `Earned points reversed for cancelled order ${o.order_number}`);
    }
    if (o.coupon_code) await client.query('UPDATE coupons SET used_count = GREATEST(0, used_count - 1) WHERE code=$1', [o.coupon_code]);
    await client.query("UPDATE payments SET status = CASE WHEN status='success' THEN 'refunded' ELSE status END WHERE order_id=$1", [o.id]);
    await audit(client, userId, 'order.cancelled', 'order', o.id, { reason });
    return loadOrder(userId, o.id, client);
  });
}

/** Buy Again: puts previously purchased books back in the cart (skips unavailable ones). */
export async function buyAgain(userId: number, input: { orderId?: number; bookIds?: number[] }) {
  const { addItem } = await import('./cartService');
  let bookIds = input.bookIds ?? [];
  if (input.orderId) {
    const rows = await query<{ book_id: number }>('SELECT oi.book_id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.id=$1 AND o.user_id=$2', [input.orderId, userId]);
    if (!rows.length) throw notFound('Order not found');
    bookIds = rows.map((r) => r.book_id);
  }
  if (!bookIds.length) throw badRequest('Provide orderId or bookIds');
  const added: number[] = [];
  const skipped: { bookId: number; reason: string }[] = [];
  for (const id of bookIds) {
    try {
      await addItem(userId, id, 1);
      added.push(id);
    } catch (e: any) {
      skipped.push({ bookId: id, reason: e.message });
    }
  }
  const { getCart } = await import('./cartService');
  return { added, skipped, cart: await getCart(userId) };
}

// ---------------------------------------------------------------- rewards
export async function rewardSummary(userId: number) {
  const user = await queryOne<{ reward_balance: number }>('SELECT reward_balance FROM users WHERE id=$1', [userId]);
  const history = await query(
    `SELECT r.id, r.points, r.type, r.description, r.balance_after AS "balanceAfter", r.created_at AS "createdAt", o.order_number AS "orderNumber"
       FROM reward_points r LEFT JOIN orders o ON o.id=r.order_id WHERE r.user_id=$1 ORDER BY r.id DESC LIMIT 100`,
    [userId],
  );
  return {
    balance: user?.reward_balance ?? 0,
    pointValue: 1,
    rules: ['Earn 1 point for every Rs 10 paid', '1 point = Rs 1 off at checkout', 'Up to 50% of an order can be paid with points', 'Points are returned when you cancel within 48 hours'],
    history,
  };
}
