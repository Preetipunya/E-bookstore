import { closeDb, DEMO, getApp, loginAs, newUser, resetDb } from '../helpers';
import request from 'supertest';

let app: any;
beforeAll(async () => { await resetDb(); app = await getApp(); });
afterAll(closeDb);

describe('seed data', () => {
  it('has at least 100 books, many categories and publishers', async () => {
    const books = await request(app).get('/api/books?pageSize=1');
    expect(books.body.total).toBeGreaterThanOrEqual(100);
    expect((await request(app).get('/api/categories')).body.length).toBeGreaterThanOrEqual(15);
    expect((await request(app).get('/api/publishers')).body.length).toBeGreaterThanOrEqual(5);
  });
});

describe('Authentication', () => {
  it('registers, hashes password, grants welcome points, returns tokens', async () => {
    const email = `reg-${Date.now()}@example.com`;
    const res = await request(app).post('/api/auth/register').send({ name: 'New Reader', email, password: 'Secret123', phone: '+919000000000' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.rewardPoints).toBe(100);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    const { pool } = await import('../../src/db/pool');
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email=$1', [email]);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects duplicate email (case-insensitive) with 409', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Dup', email: DEMO.email.toUpperCase(), password: 'Secret123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates registration input', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'X', email: 'bad', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    expect((await request(app).post('/api/auth/login').send(DEMO)).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: DEMO.email, password: 'wrong' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever1' })).status).toBe(401);
  });

  it('protects routes and rejects garbage tokens', async () => {
    expect((await request(app).get('/api/users/me')).status).toBe(401);
    expect((await request(app).get('/api/users/me').set('Authorization', 'Bearer nope')).status).toBe(401);
  });

  it('returns the profile with addresses, reward points and order stats', async () => {
    const { auth } = await loginAs(app);
    const res = await request(app).get('/api/users/me').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: DEMO.email, name: 'Demo Reader' });
    expect(res.body.addresses.length).toBeGreaterThanOrEqual(2);
    expect(res.body.stats.orders).toBeGreaterThan(0);
    expect(typeof res.body.rewardPoints).toBe('number');
  });

  it('rotates refresh tokens and revokes on logout', async () => {
    const { refreshToken } = await loginAs(app);
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(refreshToken);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken })).status).toBe(401); // old one is revoked
    expect((await request(app).post('/api/auth/logout').send({ refreshToken: r1.body.refreshToken })).status).toBe(204);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: r1.body.refreshToken })).status).toBe(401);
  });

  it('supports forgot + reset password and invalidates the token after use', async () => {
    const u = await newUser(app, 'reset');
    const f = await request(app).post('/api/auth/forgot-password').send({ email: u.email });
    expect(f.status).toBe(200);
    expect(f.body.resetToken).toBeTruthy();
    expect((await request(app).post('/api/auth/reset-password').send({ token: f.body.resetToken, password: 'NewSecret456' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: 'NewSecret456' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: 'Secret123' })).status).toBe(401);
    expect((await request(app).post('/api/auth/reset-password').send({ token: f.body.resetToken, password: 'Another789' })).status).toBe(400);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: u.refreshToken })).status).toBe(401); // sessions revoked
  });

  it('does not reveal whether an email exists', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.resetToken).toBeUndefined();
  });
});

describe('Addresses', () => {
  it('supports add / edit / default / delete with ownership checks', async () => {
    const a = await newUser(app, 'addr');
    const b = await newUser(app, 'addr2');
    const body = { fullName: 'Second Home', phone: '+919888888888', line1: '22 Baker Street', line2: 'Floor 2', city: 'Delhi', state: 'Delhi', country: 'India', postalCode: '110001' };
    const created = await request(app).post('/api/addresses').set(a.auth).send(body);
    expect(created.status).toBe(201);
    expect(created.body.isDefault).toBe(false); // first address (from newUser) is the default
    const edited = await request(app).put(`/api/addresses/${created.body.id}`).set(a.auth).send({ ...body, city: 'New Delhi' });
    expect(edited.body.city).toBe('New Delhi');
    expect((await request(app).put(`/api/addresses/${created.body.id}`).set(b.auth).send(body)).status).toBe(404);
    const list = await request(app).post(`/api/addresses/${created.body.id}/default`).set(a.auth);
    expect(list.body.filter((x: any) => x.isDefault)).toHaveLength(1);
    expect(list.body.find((x: any) => x.isDefault).id).toBe(created.body.id);
    expect((await request(app).delete(`/api/addresses/${created.body.id}`).set(a.auth)).status).toBe(204);
    const after = await request(app).get('/api/addresses').set(a.auth);
    expect(after.body).toHaveLength(1);
    expect(after.body[0].isDefault).toBe(true); // default is reassigned
  });

  it('validates address fields', async () => {
    const a = await newUser(app, 'addrv');
    const res = await request(app).post('/api/addresses').set(a.auth).send({ fullName: '', phone: 'x', line1: '', city: '', state: '', postalCode: '!' });
    expect(res.status).toBe(400);
  });
});
