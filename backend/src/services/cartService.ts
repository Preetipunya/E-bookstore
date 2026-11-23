import { PoolClient } from 'pg';
import { Db, pool, query, queryOne, withTransaction } from '../db/pool';
import { badRequest, conflict, notFound } from '../utils/errors';
import { computeTotals, couponError, CouponLike, salePrice } from '../utils/pricing';
import { deliveryEstimate } from '../utils/pricing';

export async function ensureCart(userId: number, db: Db = pool): Promise<number> {
  const row = await queryOne<{ id: number }>('INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING id', [userId], db);
  return row!.id;
}

export async function getCoupon(code: string | null | undefined, db: Db = pool): Promise<CouponLike | null> {
  if (!code) return null;
  return queryOne<CouponLike>('SELECT * FROM coupons WHERE upper(code)=upper($1)', [code], db);
}

export async function loadCartRows(userId: number, db: Db = pool) {
  return query(
    `SELECT ci.id, ci.book_id, ci.quantity, ci.saved_for_later, b.title, b.list_price, b.discount_percent, b.format, b.language,
            a.name AS author_name, p.name AS publisher_name, c.name AS category_name, COALESCE(inv.quantity,0) AS stock
       FROM carts ct
       JOIN cart_items ci ON ci.cart_id = ct.id
       JOIN books b ON b.id = ci.book_id
       JOIN authors a ON a.id = b.author_id
       JOIN publishers p ON p.id = b.publisher_id
       JOIN categories c ON c.id = b.category_id
       LEFT JOIN inventory inv ON inv.book_id = b.id
      WHERE ct.user_id = $1
      ORDER BY ci.added_at`,
    [userId],
    db,
  );
}

const mapItem = (r: any) => {
  const unit = salePrice(Number(r.list_price), Number(r.discount_percent));
  return {
    id: r.id,
    bookId: r.book_id,
    title: r.title,
    author: r.author_name,
    publisher: r.publisher_name,
    category: r.category_name,
    format: r.format,
    quantity: r.quantity,
    savedForLater: r.saved_for_later,
    listPrice: Number(r.list_price),
    discountPercent: Number(r.discount_percent),
    unitPrice: unit,
    lineTotal: Math.round(unit * r.quantity * 100) / 100,
    stock: Number(r.stock),
    inStock: Number(r.stock) >= r.quantity,
    coverUrl: `/api/books/${r.book_id}/cover.svg`,
    deliveryDate: deliveryEstimate(Number(r.stock) > 0),
  };
};

export interface CartOptions {
  pointsToRedeem?: number;
  couponCodeOverride?: string | null;
}

export async function getCart(userId: number, opts: CartOptions = {}, db: Db = pool) {
  await ensureCart(userId, db);
  const rows = await loadCartRows(userId, db);
  const cartRow = await queryOne<{ coupon_code: string | null }>('SELECT coupon_code FROM carts WHERE user_id=$1', [userId], db);
  const user = await queryOne<{ reward_balance: number }>('SELECT reward_balance FROM users WHERE id=$1', [userId], db);
  const items = rows.map(mapItem);
  const active = items.filter((i) => !i.savedForLater);
  const saved = items.filter((i) => i.savedForLater);

  const code = opts.couponCodeOverride !== undefined ? opts.couponCodeOverride : cartRow?.coupon_code;
  let coupon = await getCoupon(code, db);
  const totalsBase = computeTotals({ items: active.map((i) => ({ listPrice: i.listPrice, discountPercent: i.discountPercent, quantity: i.quantity })) });
  let couponMessage: string | null = null;
  if (coupon) {
    const err = couponError(coupon, totalsBase.subtotal);
    if (err) {
      couponMessage = err;
      coupon = null;
    }
  }
  const totals = computeTotals({
    items: active.map((i) => ({ listPrice: i.listPrice, discountPercent: i.discountPercent, quantity: i.quantity })),
    coupon,
    pointsToRedeem: opts.pointsToRedeem ?? 0,
    pointsBalance: user?.reward_balance ?? 0,
  });
  return {
    items: active,
    savedForLater: saved,
    coupon: coupon ? { code: coupon.code, description: coupon.description ?? '' } : null,
    couponMessage,
    totals,
    rewardBalance: user?.reward_balance ?? 0,
  };
}

async function bookStock(bookId: number, db: Db = pool) {
  const row = await queryOne<{ id: number; stock: number }>('SELECT b.id, COALESCE(i.quantity,0) AS stock FROM books b LEFT JOIN inventory i ON i.book_id=b.id WHERE b.id=$1', [bookId], db);
  if (!row) throw notFound('Book not found');
  return Number(row.stock);
}

export async function addItem(userId: number, bookId: number, quantity: number) {
  const stock = await bookStock(bookId);
  const cartId = await ensureCart(userId);
  const existing = await queryOne<{ quantity: number }>('SELECT quantity FROM cart_items WHERE cart_id=$1 AND book_id=$2', [cartId, bookId]);
  const next = Math.min(10, (existing?.quantity ?? 0) + quantity);
  if (stock <= 0) throw conflict('This book is out of stock', 'OUT_OF_STOCK');
  if (next > stock) throw conflict(`Only ${stock} copies available`, 'INSUFFICIENT_STOCK');
  await query(
    `INSERT INTO cart_items (cart_id, book_id, quantity) VALUES ($1,$2,$3)
     ON CONFLICT (cart_id, book_id) DO UPDATE SET quantity=$3, saved_for_later=FALSE`,
    [cartId, bookId, next],
  );
  return getCart(userId);
}

export async function updateItem(userId: number, itemId: number, patch: { quantity?: number; savedForLater?: boolean }) {
  const item = await queryOne<{ id: number; book_id: number }>(
    'SELECT ci.id, ci.book_id FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE ci.id=$1 AND c.user_id=$2',
    [itemId, userId],
  );
  if (!item) throw notFound('Cart item not found');
  if (patch.quantity !== undefined) {
    const stock = await bookStock(item.book_id);
    if (patch.quantity > stock) throw conflict(`Only ${stock} copies available`, 'INSUFFICIENT_STOCK');
    await query('UPDATE cart_items SET quantity=$2 WHERE id=$1', [itemId, patch.quantity]);
  }
  if (patch.savedForLater !== undefined) await query('UPDATE cart_items SET saved_for_later=$2 WHERE id=$1', [itemId, patch.savedForLater]);
  return getCart(userId);
}

export async function removeItem(userId: number, itemId: number) {
  const r = await query('DELETE FROM cart_items WHERE id=$1 AND cart_id=(SELECT id FROM carts WHERE user_id=$2) RETURNING id', [itemId, userId]);
  if (!r.length) throw notFound('Cart item not found');
  return getCart(userId);
}

export async function moveToWishlist(userId: number, itemId: number) {
  const item = await queryOne<{ book_id: number }>('SELECT ci.book_id FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE ci.id=$1 AND c.user_id=$2', [itemId, userId]);
  if (!item) throw notFound('Cart item not found');
  await withTransaction(async (c) => {
    await c.query('INSERT INTO wishlist (user_id, book_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, item.book_id]);
    await c.query('DELETE FROM cart_items WHERE id=$1', [itemId]);
  });
  return getCart(userId);
}

export async function applyCoupon(userId: number, code: string) {
  const cart = await getCart(userId, { couponCodeOverride: null });
  const coupon = await getCoupon(code);
  const err = couponError(coupon, cart.totals.subtotal);
  if (err) throw badRequest(err);
  await query('UPDATE carts SET coupon_code=$2, updated_at=now() WHERE user_id=$1', [userId, coupon!.code]);
  return getCart(userId);
}

export async function removeCoupon(userId: number) {
  await query('UPDATE carts SET coupon_code=NULL WHERE user_id=$1', [userId]);
  return getCart(userId);
}

export async function clearActiveItems(client: PoolClient, userId: number) {
  await client.query('DELETE FROM cart_items WHERE saved_for_later = FALSE AND cart_id=(SELECT id FROM carts WHERE user_id=$1)', [userId]);
  await client.query('UPDATE carts SET coupon_code=NULL WHERE user_id=$1', [userId]);
}

export async function estimateShipping(userId: number, postalCode: string) {
  const cart = await getCart(userId);
  const metro = /^(11|40|56|60|70|50)/.test(postalCode);
  const days = metro ? 2 : 4;
  return {
    postalCode,
    shipping: cart.totals.shipping,
    estimatedDays: days,
    estimatedDelivery: deliveryEstimate(true, new Date(), days),
    freeShippingAbove: 499,
  };
}

export async function listWishlist(userId: number) {
  return query(
    `SELECT b.id AS "bookId", b.title, a.name AS author, b.list_price AS "listPrice", b.discount_percent AS "discountPercent",
            ROUND(b.list_price*(1-b.discount_percent/100.0),2) AS price, COALESCE(i.quantity,0) > 0 AS "inStock", w.created_at AS "addedAt",
            '/api/books/' || b.id || '/cover.svg' AS "coverUrl"
       FROM wishlist w JOIN books b ON b.id=w.book_id JOIN authors a ON a.id=b.author_id LEFT JOIN inventory i ON i.book_id=b.id
      WHERE w.user_id=$1 ORDER BY w.created_at DESC`,
    [userId],
  );
}

export async function addToWishlist(userId: number, bookId: number) {
  await bookStock(bookId);
  await query('INSERT INTO wishlist (user_id, book_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, bookId]);
  return listWishlist(userId);
}

export async function removeFromWishlist(userId: number, bookId: number) {
  await query('DELETE FROM wishlist WHERE user_id=$1 AND book_id=$2', [userId, bookId]);
  return listWishlist(userId);
}
