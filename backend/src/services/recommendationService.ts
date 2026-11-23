import { query } from '../db/pool';
import { BOOK_SELECT, mapBook } from './bookMapper';

const LIVE = `o.status IN ('confirmed','processing','shipped','delivered')`;

export async function trending(limit = 12) {
  const rows = await query(
    `${BOOK_SELECT}
     LEFT JOIN (
       SELECT oi.book_id, SUM(oi.quantity) AS recent
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE ${LIVE} AND o.created_at > now() - interval '30 days'
        GROUP BY oi.book_id
     ) t ON t.book_id = b.id
     ORDER BY COALESCE(t.recent,0) DESC, b.sales_count DESC, b.id LIMIT $1`,
    [limit],
  );
  return rows.map(mapBook);
}

export async function bestSellers(limit = 12) {
  return (await query(`${BOOK_SELECT} ORDER BY b.sales_count DESC, b.id LIMIT $1`, [limit])).map(mapBook);
}

export async function newArrivals(limit = 12) {
  return (await query(`${BOOK_SELECT} ORDER BY b.published_date DESC, b.id DESC LIMIT $1`, [limit])).map(mapBook);
}

export async function featured(limit = 12) {
  return (await query(`${BOOK_SELECT} WHERE b.is_featured ORDER BY b.rating_avg DESC, b.sales_count DESC LIMIT $1`, [limit])).map(mapBook);
}

export async function buyAgain(userId: number, limit = 12) {
  const rows = await query(
    `${BOOK_SELECT.replace('SELECT b.id,', 'SELECT h.last_bought, h.times, b.id,')}
     JOIN (
       SELECT oi.book_id, MAX(o.created_at) AS last_bought, SUM(oi.quantity)::int AS times
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.user_id = $1 AND ${LIVE}
        GROUP BY oi.book_id
     ) h ON h.book_id = b.id
     ORDER BY h.last_bought DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r: any) => ({ ...mapBook(r), lastPurchasedAt: r.last_bought, timesPurchased: r.times }));
}

export async function recentlyViewed(userId: number, limit = 12) {
  const rows = await query(`${BOOK_SELECT} JOIN book_views v ON v.book_id=b.id AND v.user_id=$1 ORDER BY v.viewed_at DESC LIMIT $2`, [userId, limit]);
  return rows.map(mapBook);
}

export async function trackView(userId: number, bookId: number) {
  await query(
    `INSERT INTO book_views (user_id, book_id) SELECT $1, id FROM books WHERE id=$2
     ON CONFLICT (user_id, book_id) DO UPDATE SET viewed_at = now()`,
    [userId, bookId],
  );
}

/**
 * Personalised recommendations.
 * score = 3*purchases-in-category + 3*purchases-by-author + 1*views-in-category + 0.5*cart-in-category
 *       + co-purchase affinity + rating/5, excluding books the user already bought.
 * Falls back to trending for brand-new users. Results are persisted to `recommendations`.
 */
export async function recommended(userId: number, limit = 12) {
  const rows = await query(
    `WITH cat_pref AS (
        SELECT category_id, SUM(w) AS w FROM (
          SELECT b.category_id, 3.0 * oi.quantity AS w FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN books b ON b.id=oi.book_id WHERE o.user_id=$1 AND ${LIVE}
          UNION ALL SELECT b.category_id, 1.0 FROM book_views v JOIN books b ON b.id=v.book_id WHERE v.user_id=$1
          UNION ALL SELECT b.category_id, 0.5 FROM cart_items ci JOIN carts c ON c.id=ci.cart_id JOIN books b ON b.id=ci.book_id WHERE c.user_id=$1
        ) s GROUP BY category_id
      ), auth_pref AS (
        SELECT b.author_id, SUM(3.0 * oi.quantity) AS w FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN books b ON b.id=oi.book_id WHERE o.user_id=$1 AND ${LIVE} GROUP BY b.author_id
      ), bought AS (
        SELECT DISTINCT oi.book_id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.user_id=$1 AND ${LIVE}
      ), co AS (
        SELECT oi2.book_id, COUNT(*) AS n FROM order_items oi1
          JOIN order_items oi2 ON oi2.order_id=oi1.order_id AND oi2.book_id<>oi1.book_id
         WHERE oi1.book_id IN (SELECT book_id FROM bought) GROUP BY oi2.book_id
      )
      SELECT x.*, s.score FROM (${BOOK_SELECT}) x
      JOIN LATERAL (SELECT 1) l ON TRUE
      JOIN (
        SELECT b.id,
               COALESCE(cp.w,0) + COALESCE(ap.w,0) + LEAST(COALESCE(co.n,0),5) + b.rating_avg/5.0 AS score
          FROM books b
          LEFT JOIN cat_pref cp ON cp.category_id=b.category_id
          LEFT JOIN auth_pref ap ON ap.author_id=b.author_id
          LEFT JOIN co ON co.book_id=b.id
         WHERE b.id NOT IN (SELECT book_id FROM bought)
      ) s ON s.id = x.id
      ORDER BY s.score DESC, x.sales_count DESC LIMIT $2`,
    [userId, limit],
  );
  const hasSignal = rows.length > 0 && Number(rows[0].score) >= 1.5;
  if (!hasSignal) return { reason: 'trending', items: await trending(limit) };
  await query('DELETE FROM recommendations WHERE user_id=$1', [userId]);
  for (const r of rows) {
    await query('INSERT INTO recommendations (user_id, book_id, score, reason) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [userId, r.id, Number(r.score).toFixed(3), 'personalised']);
  }
  return { reason: 'personalised', items: rows.map(mapBook) };
}

export async function similar(bookId: number, limit = 8) {
  const rows = await query(
    `${BOOK_SELECT}
     WHERE b.id <> $1 AND (b.category_id = (SELECT category_id FROM books WHERE id=$1) OR b.author_id = (SELECT author_id FROM books WHERE id=$1))
     ORDER BY (b.author_id = (SELECT author_id FROM books WHERE id=$1)) DESC, (b.publisher_id = (SELECT publisher_id FROM books WHERE id=$1)) DESC, b.rating_avg DESC, b.sales_count DESC
     LIMIT $2`,
    [bookId, limit],
  );
  return rows.map(mapBook);
}

export async function frequentlyBoughtTogether(bookId: number, limit = 3) {
  const rows = await query(
    `${BOOK_SELECT}
     JOIN (
       SELECT oi2.book_id, COUNT(*) AS n FROM order_items oi1
         JOIN order_items oi2 ON oi2.order_id=oi1.order_id AND oi2.book_id<>oi1.book_id
         JOIN orders o ON o.id=oi1.order_id
        WHERE oi1.book_id=$1 AND ${LIVE} GROUP BY oi2.book_id
     ) t ON t.book_id=b.id
     ORDER BY t.n DESC, b.sales_count DESC LIMIT $2`,
    [bookId, limit],
  );
  if (rows.length >= limit) return rows.map(mapBook);
  // top up with best-rated books from the same category
  const have = rows.map((r: any) => r.id).concat([bookId]);
  const extra = await query(
    `${BOOK_SELECT} WHERE b.category_id=(SELECT category_id FROM books WHERE id=$1) AND b.id <> ALL($2::int[]) ORDER BY b.rating_avg DESC, b.sales_count DESC LIMIT $3`,
    [bookId, have, limit - rows.length],
  );
  return [...rows, ...extra].map(mapBook);
}
