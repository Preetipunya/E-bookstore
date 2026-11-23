import { query, queryOne } from '../db/pool';
import { notFound } from '../utils/errors';
import { BOOK_SELECT, mapBook, PRICE_SQL } from './bookMapper';

export interface BookFilters {
  q?: string;
  category?: string; // slug or numeric id
  author?: string; // numeric id or name fragment
  publisher?: string; // numeric id or slug
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availability?: 'in_stock' | 'all';
  language?: string;
  format?: string;
  featured?: boolean;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'best_selling' | 'top_rated' | 'newest';
  page: number;
  pageSize: number;
}

const isNum = (s: string) => /^\d+$/.test(s);

export async function listBooks(f: BookFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (f.q) {
    const p = add(`%${f.q.replace(/[%_]/g, (m) => '\\' + m)}%`);
    where.push(`(b.title ILIKE ${p} OR a.name ILIKE ${p} OR b.isbn ILIKE ${p} OR p.name ILIKE ${p} OR c.name ILIKE ${p})`);
  }
  if (f.category) where.push(isNum(f.category) ? `b.category_id = ${add(Number(f.category))}` : `c.slug = ${add(f.category)}`);
  if (f.author) where.push(isNum(f.author) ? `b.author_id = ${add(Number(f.author))}` : `a.name ILIKE ${add(`%${f.author}%`)}`);
  if (f.publisher) where.push(isNum(f.publisher) ? `b.publisher_id = ${add(Number(f.publisher))}` : `p.slug = ${add(f.publisher)}`);
  if (f.minPrice !== undefined) where.push(`${PRICE_SQL} >= ${add(f.minPrice)}`);
  if (f.maxPrice !== undefined) where.push(`${PRICE_SQL} <= ${add(f.maxPrice)}`);
  if (f.minRating !== undefined) where.push(`b.rating_avg >= ${add(f.minRating)}`);
  if (f.availability === 'in_stock') where.push('COALESCE(i.quantity,0) > 0');
  if (f.language) where.push(`b.language = ${add(f.language)}`);
  if (f.format) where.push(`b.format = ${add(f.format)}`);
  if (f.featured) where.push('b.is_featured = TRUE');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const filterParams = [...params];
  let orderBy = 'b.sales_count DESC, b.id';
  switch (f.sort) {
    case 'price_asc': orderBy = `${PRICE_SQL} ASC, b.id`; break;
    case 'price_desc': orderBy = `${PRICE_SQL} DESC, b.id`; break;
    case 'best_selling': orderBy = 'b.sales_count DESC, b.id'; break;
    case 'top_rated': orderBy = 'b.rating_avg DESC, b.rating_count DESC, b.id'; break;
    case 'newest': orderBy = 'b.published_date DESC, b.id DESC'; break;
    default:
      if (f.q) {
        const p = add(`${f.q}%`);
        orderBy = `(b.title ILIKE ${p}) DESC, b.sales_count DESC, b.id`;
      }
  }

  const countRows = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM books b JOIN authors a ON a.id=b.author_id JOIN publishers p ON p.id=b.publisher_id JOIN categories c ON c.id=b.category_id LEFT JOIN inventory i ON i.book_id=b.id ${whereSql}`, filterParams);
  const total = countRows[0].n;
  const limit = add(f.pageSize);
  const offset = add((f.page - 1) * f.pageSize);
  const rows = await query(`${BOOK_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`, params);
  return { items: rows.map(mapBook), total, page: f.page, pageSize: f.pageSize, totalPages: Math.max(1, Math.ceil(total / f.pageSize)) };
}

export async function getBook(id: number) {
  const row = await queryOne(`${BOOK_SELECT} WHERE b.id = $1`, [id]);
  if (!row) throw notFound('Book not found');
  const book = mapBook(row);
  const author = await queryOne('SELECT id, name, bio FROM authors WHERE id=$1', [row.author_id]);
  const publisher = await queryOne('SELECT id, name, slug, description FROM publishers WHERE id=$1', [row.publisher_id]);
  const distribution = await query<{ rating: number; n: number }>('SELECT rating, COUNT(*)::int AS n FROM reviews WHERE book_id=$1 GROUP BY rating', [id]);
  const images = await query('SELECT kind, sort_order FROM book_images WHERE book_id=$1 ORDER BY sort_order', [id]);
  return {
    ...book,
    authorInfo: author,
    publisherInfo: publisher,
    images: images.map((i: any) => ({ kind: i.kind, url: `/api/books/${id}/${i.kind === 'back' ? 'cover-back.svg' : 'cover.svg'}` })),
    ratingDistribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: distribution.find((d) => d.rating === r)?.n ?? 0 })),
  };
}

export async function suggest(q: string) {
  const p = `%${q}%`;
  const books = await query(`SELECT b.id, b.title, a.name AS author FROM books b JOIN authors a ON a.id=b.author_id WHERE b.title ILIKE $1 OR a.name ILIKE $1 ORDER BY (b.title ILIKE $2) DESC, b.sales_count DESC LIMIT 6`, [p, `${q}%`]);
  return books.map((b: any) => ({ id: b.id, title: b.title, author: b.author }));
}

export async function listCategories() {
  return query(`SELECT c.id, c.name, c.slug, c.description, COUNT(b.id)::int AS "bookCount" FROM categories c LEFT JOIN books b ON b.category_id=c.id GROUP BY c.id ORDER BY c.sort_order, c.name`);
}

export async function listPublishers() {
  return query(`SELECT p.id, p.name, p.slug, p.description, COUNT(b.id)::int AS "bookCount" FROM publishers p LEFT JOIN books b ON b.publisher_id=p.id GROUP BY p.id ORDER BY p.name`);
}

export async function listAuthors(categoryId?: number) {
  return query(
    `SELECT a.id, a.name, COUNT(b.id)::int AS "bookCount" FROM authors a JOIN books b ON b.author_id=a.id ${categoryId ? 'WHERE b.category_id=$1' : ''} GROUP BY a.id ORDER BY a.name`,
    categoryId ? [categoryId] : [],
  );
}

export async function listReviews(bookId: number) {
  return query(`SELECT r.id, r.rating, r.comment, r.created_at AS "createdAt", u.name AS "userName" FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.book_id=$1 ORDER BY r.created_at DESC LIMIT 50`, [bookId]);
}

export async function upsertReview(userId: number, bookId: number, rating: number, comment: string) {
  const exists = await queryOne('SELECT id FROM books WHERE id=$1', [bookId]);
  if (!exists) throw notFound('Book not found');
  await query(
    `INSERT INTO reviews (book_id,user_id,rating,comment) VALUES ($1,$2,$3,$4)
     ON CONFLICT (book_id,user_id) DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment, created_at=now()`,
    [bookId, userId, rating, comment],
  );
  await query(`UPDATE books SET rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric,2) FROM reviews WHERE book_id=$1),0), rating_count = (SELECT COUNT(*) FROM reviews WHERE book_id=$1) WHERE id=$1`, [bookId]);
  return listReviews(bookId);
}
