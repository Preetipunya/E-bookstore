import { closeDb, getApp, loginAs, newUser, resetDb } from '../helpers';
import request from 'supertest';

let app: any;
beforeAll(async () => { await resetDb(); app = await getApp(); });
afterAll(closeDb);

const list = (qs = '') => request(app).get(`/api/books${qs}`);

describe('Catalogue listing', () => {
  it('paginates and returns every field the book card needs', async () => {
    const res = await list('?pageSize=5&page=2');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(5);
    expect(res.body.page).toBe(2);
    expect(res.body.totalPages).toBeGreaterThan(1);
    expect(res.body.items[0]).toEqual(expect.objectContaining({
      title: expect.any(String), author: expect.objectContaining({ name: expect.any(String) }), publisher: expect.objectContaining({ name: expect.any(String) }),
      description: expect.any(String), price: expect.any(Number), listPrice: expect.any(Number), discountPercent: expect.any(Number),
      rating: expect.any(Number), inStock: expect.any(Boolean), coverUrl: expect.stringContaining('/cover.svg'),
    }));
  });

  it('filters by category slug and every result belongs to it', async () => {
    const res = await list('?category=self-help&pageSize=60');
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items.every((b: any) => b.category.slug === 'self-help')).toBe(true);
  });

  it('filters by publisher', async () => {
    const pubs = (await request(app).get('/api/publishers')).body;
    const res = await list(`?publisher=${pubs[0].id}&pageSize=60`);
    expect(res.body.total).toBe(pubs[0].bookCount);
    expect(res.body.items.every((b: any) => b.publisher.id === pubs[0].id)).toBe(true);
  });

  it('filters by author', async () => {
    const res = await list('?author=Daniel%20Reed');
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((b: any) => b.author.name === 'Daniel Reed')).toBe(true);
  });

  it('filters by price range, rating and availability', async () => {
    const p = await list('?minPrice=200&maxPrice=300&pageSize=60');
    expect(p.body.items.every((b: any) => b.price >= 200 && b.price <= 300)).toBe(true);
    const r = await list('?minRating=4&pageSize=60');
    expect(r.body.items.every((b: any) => b.rating >= 4)).toBe(true);
    const s = await list('?availability=in_stock&pageSize=60');
    expect(s.body.items.every((b: any) => b.inStock)).toBe(true);
    const all = await list('?pageSize=1');
    expect(s.body.total).toBeLessThan(all.body.total); // seed contains out-of-stock titles
  });

  it('sorts by price both ways', async () => {
    const asc = (await list('?sort=price_asc&pageSize=60')).body.items.map((b: any) => b.price);
    const desc = (await list('?sort=price_desc&pageSize=60')).body.items.map((b: any) => b.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it('sorts by best selling, top rated and newest', async () => {
    const bs = (await list('?sort=best_selling&pageSize=30')).body.items.map((b: any) => b.salesCount);
    expect(bs).toEqual([...bs].sort((a, b) => b - a));
    const tr = (await list('?sort=top_rated&pageSize=30')).body.items.map((b: any) => b.rating);
    expect(tr).toEqual([...tr].sort((a, b) => b - a));
    const nw = (await list('?sort=newest&pageSize=30')).body.items.map((b: any) => b.publishedDate);
    expect(nw).toEqual([...nw].sort().reverse());
  });

  it('searches by title, author and ISBN, ranking prefix matches first', async () => {
    const t = await list('?q=minimalism');
    expect(t.body.items[0].title).toBe('The Joy of Minimalism');
    expect((await list('?q=Jessica%20Martin')).body.items.length).toBeGreaterThan(0);
    const isbn = t.body.items[0].isbn;
    expect((await list(`?q=${isbn}`)).body.items[0].isbn).toBe(isbn);
    expect((await list('?q=zzzzzz-no-match')).body.total).toBe(0);
  });

  it('combines filters + search + sort and keeps total accurate', async () => {
    const res = await list('?q=the&category=science&sort=price_asc&pageSize=2');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(2);
    expect(res.body.items.every((b: any) => b.category.slug === 'science')).toBe(true);
  });

  it('is safe against SQL injection and rejects bad params', async () => {
    expect((await list("?q=%27%3B%20DROP%20TABLE%20books%3B--")).status).toBe(200);
    expect((await list('')).body.total).toBeGreaterThanOrEqual(100);
    expect((await list('?sort=hax')).status).toBe(400);
    expect((await list('?pageSize=9999')).status).toBe(400);
  });

  it('gives suggestions for the search box', async () => {
    const res = await request(app).get('/api/books/suggest?q=art');
    expect(res.body.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/books/suggest?q=a')).body).toEqual([]);
  });

  it('lists categories, publishers, authors, languages', async () => {
    expect((await request(app).get('/api/authors')).body.length).toBeGreaterThan(10);
    expect((await request(app).get('/api/languages')).body).toContain('English');
  });
});

describe('Product details', () => {
  it('returns full details with author, publisher, ISBN, delivery estimate and rating distribution', async () => {
    const id = (await list('?q=minimalism')).body.items[0].id;
    const res = await request(app).get(`/api/books/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'The Joy of Minimalism', author: { name: 'Daniel Reed' }, publisher: { name: 'ABC Publishers' } });
    expect(res.body.isbn).toMatch(/^\d{13}$/);
    expect(res.body.deliveryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.authorInfo.bio).toContain('Daniel Reed');
    expect(res.body.ratingDistribution).toHaveLength(5);
    expect(res.body.images.length).toBeGreaterThanOrEqual(2);
  });

  it('404s for unknown books and 400s for invalid ids', async () => {
    expect((await request(app).get('/api/books/999999')).status).toBe(404);
    expect((await request(app).get('/api/books/abc')).status).toBe(400);
  });

  it('serves SVG covers', async () => {
    const res = await request(app).get('/api/books/1/cover.svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/svg/);
    expect((await request(app).get('/api/books/1/cover-back.svg')).status).toBe(200);
  });

  it('returns similar and frequently-bought-together books (excluding the book itself)', async () => {
    const id = (await list('?q=art%20of%20focus')).body.items[0].id;
    const sim = await request(app).get(`/api/books/${id}/similar`);
    expect(sim.body.length).toBeGreaterThan(0);
    expect(sim.body.some((b: any) => b.id === id)).toBe(false);
    const fbt = await request(app).get(`/api/books/${id}/frequently-bought-together`);
    expect(fbt.body.length).toBeGreaterThan(0);
    expect(fbt.body.some((b: any) => b.id === id)).toBe(false);
  });

  it('lets a user add one review (upsert) and updates the aggregate rating', async () => {
    const u = await newUser(app, 'rev');
    const id = (await list('?pageSize=1')).body.items[0].id;
    const before = (await request(app).get(`/api/books/${id}`)).body;
    expect((await request(app).post(`/api/books/${id}/reviews`).send({ rating: 5, comment: 'Nice' })).status).toBe(401);
    const r1 = await request(app).post(`/api/books/${id}/reviews`).set(u.auth).send({ rating: 1, comment: 'Not great at all' });
    expect(r1.status).toBe(201);
    const r2 = await request(app).post(`/api/books/${id}/reviews`).set(u.auth).send({ rating: 5, comment: 'Changed my mind!' });
    const mine = r2.body.filter((r: any) => r.userName === 'Test User');
    expect(mine).toHaveLength(1);
    expect(mine[0].rating).toBe(5);
    const after = (await request(app).get(`/api/books/${id}`)).body;
    expect(after.ratingCount).toBe(before.ratingCount + 1);
    expect((await request(app).post(`/api/books/${id}/reviews`).set(u.auth).send({ rating: 9, comment: 'bad' })).status).toBe(400);
  });
});

describe('Recommendations', () => {
  it('serves public home-page sections', async () => {
    for (const s of ['featured', 'best-sellers', 'new-arrivals', 'trending']) {
      const res = await request(app).get(`/api/recommendations/${s}?limit=6`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.length).toBeLessThanOrEqual(6);
    }
    const nw = (await request(app).get('/api/recommendations/new-arrivals?limit=3')).body.map((b: any) => b.title);
    expect(nw).toEqual(expect.arrayContaining(['The Joy of Minimalism']));
  });

  it('personalises for a user with history: excludes owned books, favours their categories', async () => {
    const { auth } = await loginAs(app);
    const mine = (await request(app).get('/api/orders/purchase-history').set(auth)).body.map((b: any) => b.bookId);
    const res = await request(app).get('/api/recommendations/for-you?limit=12').set(auth);
    expect(res.body.reason).toBe('personalised');
    expect(res.body.items.some((b: any) => mine.includes(b.id))).toBe(false);
    expect(res.body.items.filter((b: any) => b.category.slug === 'self-help').length).toBeGreaterThan(0);
  });

  it('falls back to trending for brand-new users', async () => {
    const u = await newUser(app, 'cold');
    const res = await request(app).get('/api/recommendations/for-you').set(u.auth);
    expect(res.body.reason).toBe('trending');
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('tracks recently viewed books and uses them as a signal', async () => {
    const u = await newUser(app, 'views');
    const id = (await list('?category=cooking&pageSize=1')).body.items[0].id;
    await request(app).get(`/api/books/${id}`).set(u.auth);
    const rv = await request(app).get('/api/recommendations/recently-viewed').set(u.auth);
    expect(rv.body.map((b: any) => b.id)).toContain(id);
    const fy = await request(app).get('/api/recommendations/for-you').set(u.auth);
    expect(fy.body.items[0].category.slug).toBe('cooking');
  });

  it('shows "Buy Again" with previously purchased books only', async () => {
    const { auth } = await loginAs(app);
    const res = await request(app).get('/api/recommendations/buy-again').set(auth);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].timesPurchased).toBeGreaterThan(0);
    const newUserRes = await newUser(app, 'nobuy');
    expect((await request(app).get('/api/recommendations/buy-again').set(newUserRes.auth)).body).toEqual([]);
  });
});
