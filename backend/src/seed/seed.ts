import bcrypt from 'bcryptjs';
import { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { migrate } from '../migrate';
import { AUTHOR_BIOS, CATEGORIES, COUPONS, describe, PUBLISHERS, REVIEW_SNIPPETS } from './data';

export const DEMO_EMAIL = 'demo@bookworm.com';
export const DEMO_PASSWORD = 'Password123!';

// deterministic PRNG so every environment gets identical data
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const USERS = [
  ['Demo Reader', DEMO_EMAIL, '+919876543210'],
  ['Aarav Sharma', 'aarav@example.com', '+919811100001'], ['Diya Iyer', 'diya@example.com', '+919811100002'],
  ['Kabir Singh', 'kabir@example.com', '+919811100003'], ['Isha Nair', 'isha@example.com', '+919811100004'],
  ['Rohan Mehta', 'rohan@example.com', '+919811100005'], ['Sneha Reddy', 'sneha@example.com', '+919811100006'],
  ['Vihaan Joshi', 'vihaan@example.com', '+919811100007'], ['Ananya Das', 'ananya@example.com', '+919811100008'],
  ['Arnav Gupta', 'arnav@example.com', '+919811100009'], ['Meera Pillai', 'meera@example.com', '+919811100010'],
] as const;

const ADDRESSES = [
  ['Demo Reader', '+919876543210', '12, Lakeview Apartments', 'MG Road', 'Bengaluru', 'Karnataka', '560001', true],
  ['Demo Reader', '+919876543210', '4B, Sunrise Towers', 'Andheri East', 'Mumbai', 'Maharashtra', '400069', false],
] as const;

const CITIES = [['Delhi', 'Delhi', '110001'], ['Chennai', 'Tamil Nadu', '600001'], ['Pune', 'Maharashtra', '411001'], ['Hyderabad', 'Telangana', '500001'], ['Kolkata', 'West Bengal', '700001']] as const;

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export interface SeedOptions { reset?: boolean; log?: boolean }

export async function seedDatabase({ reset = false, log = false }: SeedOptions = {}) {
  await migrate();
  if (reset) {
    await pool.query('TRUNCATE audit_logs, recommendations, book_views, reward_points, payments, order_items, orders, wishlist, cart_items, carts, coupons, reviews, inventory, book_images, books, categories, publishers, authors, addresses, password_resets, refresh_tokens, users RESTART IDENTITY CASCADE');
  }
  const rnd = mulberry32(20240721);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await withTransaction(async (c) => {
    // ---- reference data
    const pubIds: number[] = [];
    for (const [name, description] of PUBLISHERS) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      pubIds.push((await c.query('INSERT INTO publishers (name, slug, description) VALUES ($1,$2,$3) RETURNING id', [name, slug, description])).rows[0].id);
    }
    const authorIds = new Map<string, number>();
    const catIds: number[] = [];
    let bookNo = 0;
    const bookRows: { id: number; price: number; cat: number }[] = [];
    const specialNew = new Set(['The Joy of Minimalism', 'The Vanishing House', 'The Lost Kitten']);
    const specialFeatured = new Set(['The Art of Focus', 'The Art of Learning', 'The Path to Success', 'The Midnight Hour', 'Beneath the Stars', 'The Final Frontier']);

    for (let ci = 0; ci < CATEGORIES.length; ci++) {
      const cat = CATEGORIES[ci];
      catIds.push((await c.query('INSERT INTO categories (name, slug, description, sort_order) VALUES ($1,$2,$3,$4) RETURNING id', [cat.name, cat.slug, cat.description, ci])).rows[0].id);
      for (let bi = 0; bi < cat.books.length; bi++) {
        const [title, author, base] = cat.books[bi];
        if (!authorIds.has(author)) {
          authorIds.set(author, (await c.query('INSERT INTO authors (name, bio) VALUES ($1,$2) RETURNING id', [author, AUTHOR_BIOS[author] ?? `${author} is an acclaimed author whose work has been translated into several languages.`])).rows[0].id);
        }
        const [c1, c2] = cat.palette[bi % cat.palette.length];
        const isNew = specialNew.has(title);
        const daysAgo = isNew ? 2 + Math.floor(rnd() * 20) : 45 + Math.floor(rnd() * 1000);
        const published = new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
        const format = title === 'The Vanishing House' ? 'eBook' : title === 'The Lost Kitten' || title === 'Beneath the Stars' ? 'Hardcover' : pick(['Paperback', 'Paperback', 'Paperback', 'Hardcover', 'eBook']);
        const language = rnd() < 0.12 ? pick(['Hindi', 'Tamil']) : 'English';
        const discount = pick([0, 0, 5, 10, 10, 15, 20, 25]);
        const publisherId = title === 'The Joy of Minimalism' ? pubIds[0] : pubIds[(ci + bi) % pubIds.length];
        const res = await c.query(
          `INSERT INTO books (isbn,title,description,author_id,publisher_id,category_id,list_price,discount_percent,language,format,pages,published_date,sales_count,is_featured,cover_color_1,cover_color_2)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
          [
            `978${String(1000000000 + bookNo * 7919).slice(0, 10)}`.slice(0, 13), title, describe(title, author, cat.name, bi), authorIds.get(author), publisherId, catIds[ci],
            base, discount, language, format, 120 + Math.floor(rnd() * 420), published, Math.floor(rnd() * 400), specialFeatured.has(title) || rnd() < 0.08, c1, c2,
          ],
        );
        const id = res.rows[0].id as number;
        const lowStockRoll = rnd();
        const qty = bookNo % 29 === 7 ? 0 : lowStockRoll < 0.06 ? 1 + Math.floor(rnd() * 4) : 15 + Math.floor(rnd() * 85);
        await c.query('INSERT INTO inventory (book_id, quantity) VALUES ($1,$2)', [id, qty]);
        await c.query("INSERT INTO book_images (book_id,url,kind,sort_order) VALUES ($1,$2,'front',0),($1,$3,'back',1)", [id, `/api/books/${id}/cover.svg`, `/api/books/${id}/cover-back.svg`]);
        bookRows.push({ id, price: base * (1 - discount / 100), cat: catIds[ci] });
        bookNo++;
      }
    }

    // ---- users + addresses
    const userIds: number[] = [];
    for (const [name, email, phone] of USERS) {
      userIds.push((await c.query('INSERT INTO users (name,email,password_hash,phone) VALUES ($1,$2,$3,$4) RETURNING id', [name, email, hash, phone])).rows[0].id);
    }
    for (const a of ADDRESSES) await c.query('INSERT INTO addresses (user_id,full_name,phone,line1,line2,city,state,postal_code,is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [userIds[0], ...a]);
    for (let i = 1; i < userIds.length; i++) {
      const [city, state, pin] = CITIES[i % CITIES.length];
      await c.query('INSERT INTO addresses (user_id,full_name,phone,line1,city,state,postal_code,is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)', [userIds[i], USERS[i][0], USERS[i][2], `${10 + i}, Rose Garden Colony`, city, state, pin]);
    }

    // ---- coupons
    for (const k of COUPONS) await c.query('INSERT INTO coupons (code,description,discount_type,value,max_discount,min_order,valid_until) VALUES ($1,$2,$3,$4,$5,$6, now() + interval \'2 years\')', [k.code, k.description, k.type, k.value, k.max, k.min]);

    // ---- reviews (unique per user/book), then aggregates
    for (const b of bookRows) {
      const n = 2 + Math.floor(rnd() * 6);
      const users = [...userIds].sort(() => rnd() - 0.5).slice(0, Math.min(n, userIds.length));
      for (const u of users) {
        const [rating, comment] = pick(REVIEW_SNIPPETS);
        await c.query('INSERT INTO reviews (book_id,user_id,rating,comment,created_at) VALUES ($1,$2,$3,$4, now() - ($5 || \' days\')::interval)', [b.id, u, rating, comment, String(Math.floor(rnd() * 300))]);
      }
    }
    await c.query('UPDATE books b SET rating_avg = s.a, rating_count = s.n FROM (SELECT book_id, ROUND(AVG(rating)::numeric,2) AS a, COUNT(*)::int AS n FROM reviews GROUP BY book_id) s WHERE s.book_id = b.id');

    // ---- orders
    let seq = 100000;
    const byTitle = async (t: string) => (await c.query('SELECT id FROM books WHERE title=$1', [t])).rows[0].id as number;
    const makeOrder = async (userId: number, bookIds: number[], hoursAgo: number, opts: { cancelled?: boolean; points?: number } = {}) => {
      const createdAt = new Date(Date.now() - hoursAgo * HOUR);
      const bs = (await c.query('SELECT b.id,b.title,b.list_price,b.discount_percent,a.name AS author FROM books b JOIN authors a ON a.id=b.author_id WHERE b.id = ANY($1::int[])', [bookIds])).rows;
      const lines = bs.map((b: any) => ({ ...b, unit: Math.round(Number(b.list_price) * (1 - b.discount_percent / 100) * 100) / 100, qty: 1 }));
      const subtotal = lines.reduce((s: number, l: any) => s + l.unit * l.qty, 0);
      const mrp = lines.reduce((s: number, l: any) => s + Number(l.list_price), 0);
      const tax = Math.round(subtotal * 5) / 100;
      const shipping = subtotal >= 499 ? 0 : 49;
      const pts = opts.points ?? 0;
      const total = Math.round((subtotal + tax + shipping - pts) * 100) / 100;
      const earned = Math.floor(total / 10);
      const addr = (await c.query('SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC LIMIT 1', [userId])).rows[0];
      const o = (
        await c.query(
          `INSERT INTO orders (order_number,user_id,address_id,ship_name,ship_phone,ship_line1,ship_line2,ship_city,ship_state,ship_country,ship_postal,status,subtotal,book_discount,tax,shipping,points_redeemed,points_discount,total,points_earned,cancel_reason,cancelled_at,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING id`,
          [`BW${createdAt.toISOString().slice(2, 10).replace(/-/g, '')}${seq++}`, userId, addr.id, addr.full_name, addr.phone, addr.line1, addr.line2, addr.city, addr.state, addr.country, addr.postal_code,
           opts.cancelled ? 'cancelled' : 'confirmed', subtotal, Math.round((mrp - subtotal) * 100) / 100, tax, shipping, pts, pts, total, opts.cancelled ? 0 : earned,
           opts.cancelled ? 'Ordered by mistake' : null, opts.cancelled ? new Date(createdAt.getTime() + HOUR) : null, createdAt],
        )
      ).rows[0].id as number;
      for (const l of lines) {
        await c.query('INSERT INTO order_items (order_id,book_id,title,author,list_price,unit_price,quantity,line_total) VALUES ($1,$2,$3,$4,$5,$6,1,$6)', [o, l.id, l.title, l.author, l.list_price, l.unit]);
        if (!opts.cancelled) await c.query('UPDATE books SET sales_count = sales_count + 1 WHERE id=$1', [l.id]);
      }
      await c.query("INSERT INTO payments (order_id,user_id,method,status,amount,transaction_ref,details_masked,created_at) VALUES ($1,$2,'credit_card',$3,$4,$5,$6,$7)", [o, userId, opts.cancelled ? 'refunded' : 'success', total, `TXNSEED${String(o).padStart(8, '0')}`, JSON.stringify({ cardLast4: '4242' }), createdAt]);
      const addPts = async (delta: number, type: string, desc: string, at: Date) => {
        const bal = (await c.query('UPDATE users SET reward_balance = reward_balance + $2 WHERE id=$1 RETURNING reward_balance', [userId, delta])).rows[0].reward_balance;
        await c.query('INSERT INTO reward_points (user_id,order_id,points,type,description,balance_after,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [userId, o, delta, type, desc, bal, at]);
      };
      if (pts) await addPts(-pts, 'redeemed', 'Redeemed on seeded order', createdAt);
      if (!opts.cancelled && earned) await addPts(earned, 'earned', 'Earned on seeded order', createdAt);
      if (opts.cancelled && pts) await addPts(pts, 'refunded', 'Points returned for cancelled order', new Date(createdAt.getTime() + HOUR));
      return o;
    };

    // welcome bonus for every user
    for (const u of userIds) {
      const bal = (await c.query('UPDATE users SET reward_balance = reward_balance + 100 WHERE id=$1 RETURNING reward_balance', [u])).rows[0].reward_balance;
      await c.query("INSERT INTO reward_points (user_id,points,type,description,balance_after,created_at) VALUES ($1,100,'bonus','Welcome bonus',$2, now() - interval '60 days')", [u, bal]);
    }

    // Demo user's curated history: delivered, shipped (outside window), and a brand-new cancellable order
    const [focus, learning, success, minimalism, midnight, stars] = await Promise.all(['The Art of Focus', 'The Art of Learning', 'The Path to Success', 'The Joy of Minimalism', 'The Midnight Hour', 'Beneath the Stars'].map(byTitle));
    await makeOrder(userIds[0], [focus, learning], 24 * 20, { points: 0 });
    await makeOrder(userIds[0], [success, midnight], 24 * 6);
    await makeOrder(userIds[0], [stars], 24 * 3, { points: 50 });
    await makeOrder(userIds[0], [minimalism, success], 5, {});
    await makeOrder(userIds[0], [learning], 24 * 9, { cancelled: true, points: 30 });

    // Other users: random order history for recommendation / trending signals
    for (let u = 1; u < userIds.length; u++) {
      const n = 2 + Math.floor(rnd() * 4);
      const favCat = pick(catIds);
      for (let i = 0; i < n; i++) {
        const pool = bookRows.filter((b) => b.cat === favCat || rnd() < 0.2);
        const picks = Array.from(new Set([pick(pool).id, pick(bookRows).id])).slice(0, 1 + Math.floor(rnd() * 2));
        await makeOrder(userIds[u], picks, Math.floor(rnd() * 24 * 60) + 1);
      }
    }

    // ensure stock on demo-order books never goes to 0
    await c.query('UPDATE inventory SET quantity = GREATEST(quantity, 20) WHERE book_id = ANY($1::int[])', [[focus, learning, success, minimalism, midnight, stars]]);
    // keep sales counts looking natural: bump the featured titles
    await c.query("UPDATE books SET sales_count = sales_count + 300 WHERE title IN ('The Midnight Hour','Beneath the Stars','The Final Frontier')");
    await c.query("INSERT INTO audit_logs (action, entity_type, metadata) VALUES ('seed.completed','system','{}')");
  });
  if (log) {
    const { rows } = await pool.query('SELECT (SELECT COUNT(*) FROM books) AS books, (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM reviews) AS reviews');
    console.log('Seeded:', rows[0]);
  }
}

export async function isEmpty(): Promise<boolean> {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM books');
  return rows[0].n === 0;
}

if (require.main === module) {
  (async () => {
    await migrate();
    const args = process.argv.slice(2);
    if (args.includes('--if-empty') && !(await isEmpty())) {
      console.log('Database already seeded - skipping.');
    } else {
      await seedDatabase({ reset: args.includes('--reset'), log: true });
      console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    }
    await pool.end();
  })().catch((e) => { console.error(e); process.exit(1); });
}
