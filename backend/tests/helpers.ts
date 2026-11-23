// Import this FIRST in every integration test so env is set before the app/pool modules load.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL as string;
process.env.JWT_SECRET = 'test-secret';

import request from 'supertest';

export const DEMO = { email: 'demo@bookworm.com', password: 'Password123!' };

export async function resetDb() {
  const { seedDatabase } = await import('../src/seed/seed');
  await seedDatabase({ reset: true });
}

export async function getApp() {
  const { createApp } = await import('../src/app');
  return createApp();
}

export async function closeDb() {
  const { pool } = await import('../src/db/pool');
  await pool.end();
}

export async function loginAs(app: any, email = DEMO.email, password = DEMO.password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken as string, refreshToken: res.body.refreshToken as string, user: res.body.user, auth: { Authorization: `Bearer ${res.body.accessToken}` } };
}

export const VALID_CARD = { cardNumber: '4242 4242 4242 4242', nameOnCard: 'Demo Reader', expiry: '12/35', cvv: '123' };

/** Registers a fresh user with an address, returning handy handles. */
export async function newUser(app: any, tag: string) {
  const email = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const reg = await request(app).post('/api/auth/register').send({ name: 'Test User', email, password: 'Secret123' });
  if (reg.status !== 201) throw new Error(`register failed ${JSON.stringify(reg.body)}`);
  const auth = { Authorization: `Bearer ${reg.body.accessToken}` };
  const addr = await request(app).post('/api/addresses').set(auth).send({ fullName: 'Test User', phone: '+919999999999', line1: '1 Test Street', city: 'Pune', state: 'Maharashtra', country: 'India', postalCode: '411001' });
  return { email, auth, user: reg.body.user, addressId: addr.body.id as number, refreshToken: reg.body.refreshToken as string };
}
