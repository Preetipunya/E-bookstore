import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { config } from '../config/env';
import { query, queryOne, withTransaction } from '../db/pool';
import { asyncHandler, idParam, optionalAuth, q, requireAuth, validate } from '../middleware/http';
import * as auth from '../services/authService';
import * as cat from '../services/catalogueService';
import * as rec from '../services/recommendationService';
import * as cart from '../services/cartService';
import * as orders from '../services/orderService';
import { audit } from '../services/ledger';
import { coverSvg } from '../utils/coverSvg';
import { badRequest, notFound, unauthorized } from '../utils/errors';
import { PAYMENT_METHODS } from '../utils/paymentValidation';

export const router = Router();

const email = z.string().trim().email().max(255);
const password = z.string().min(8, 'Password must be at least 8 characters').max(72).regex(/[A-Za-z]/, 'Password needs a letter').regex(/\d/, 'Password needs a digit');
const phone = z.string().trim().regex(/^\+?[0-9 -]{8,16}$/, 'Invalid phone number');

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ================================================================== AUTH
router.post('/auth/register', validate(z.object({ name: z.string().trim().min(2).max(120), email, password, phone: phone.optional() })), asyncHandler(async (req, res) => res.status(201).json(await auth.register(req.body))));
router.post('/auth/login', validate(z.object({ email, password: z.string().min(1) })), asyncHandler(async (req, res) => res.json(await auth.login(req.body.email, req.body.password))));
router.post('/auth/refresh', validate(z.object({ refreshToken: z.string().min(10) })), asyncHandler(async (req, res) => res.json(await auth.refresh(req.body.refreshToken))));
router.post('/auth/logout', validate(z.object({ refreshToken: z.string().optional() })), asyncHandler(async (req, res) => { await auth.logout(req.body.refreshToken); res.status(204).end(); }));
router.post('/auth/forgot-password', validate(z.object({ email })), asyncHandler(async (req, res) => {
  const r = await auth.forgotPassword(req.body.email);
  // Demo only: the token is returned (instead of emailed) outside production so the flow is testable end-to-end.
  res.json({ message: 'If that email is registered, a reset link has been sent.', ...(config.isProd ? {} : { resetToken: r.resetToken }) });
}));
router.post('/auth/reset-password', validate(z.object({ token: z.string().min(10), password })), asyncHandler(async (req, res) => { await auth.resetPassword(req.body.token, req.body.password); res.json({ message: 'Password updated. Please log in.' }); }));

// ================================================================== USERS
router.get('/users/me', requireAuth, asyncHandler(async (req, res) => {
  const u = await queryOne('SELECT * FROM users WHERE id=$1', [req.user!.id]);
  if (!u) throw unauthorized();
  const addresses = await query('SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC, id', [u.id]);
  const stats = await queryOne("SELECT COUNT(*)::int AS orders, COALESCE(SUM(total),0) AS spent FROM orders WHERE user_id=$1 AND status IN ('confirmed','processing','shipped','delivered')", [u.id]);
  res.json({ ...auth.publicUser(u), addresses: addresses.map(mapAddress), stats: { orders: stats!.orders, totalSpent: Number(stats!.spent) } });
}));
router.patch('/users/me', requireAuth, validate(z.object({ name: z.string().trim().min(2).max(120).optional(), phone: phone.optional() })), asyncHandler(async (req, res) => {
  const u = await queryOne('UPDATE users SET name=COALESCE($2,name), phone=COALESCE($3,phone), updated_at=now() WHERE id=$1 RETURNING *', [req.user!.id, req.body.name ?? null, req.body.phone ?? null]);
  res.json(auth.publicUser(u));
}));
router.post('/users/me/change-password', requireAuth, validate(z.object({ currentPassword: z.string(), newPassword: password })), asyncHandler(async (req, res) => {
  const u = await queryOne('SELECT * FROM users WHERE id=$1', [req.user!.id]);
  if (!u || !(await bcrypt.compare(req.body.currentPassword, u.password_hash))) throw badRequest('Current password is incorrect');
  await query('UPDATE users SET password_hash=$2 WHERE id=$1', [u.id, await bcrypt.hash(req.body.newPassword, config.bcryptRounds)]);
  res.json({ message: 'Password changed' });
}));

// ================================================================== CATALOGUE
const bookQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(100).optional(),
  author: z.string().max(100).optional(),
  publisher: z.string().max(100).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  availability: z.enum(['in_stock', 'all']).optional(),
  language: z.string().max(40).optional(),
  format: z.enum(['Paperback', 'Hardcover', 'eBook']).optional(),
  featured: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'best_selling', 'top_rated', 'newest']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
});

router.get('/books', validate(bookQuery, 'query'), asyncHandler(async (req, res) => res.json(await cat.listBooks(q(req)))));
router.get('/books/suggest', asyncHandler(async (req, res) => {
  const term = String(req.query.q ?? '').trim();
  res.json(term.length < 2 ? [] : await cat.suggest(term));
}));
router.get('/books/:id', optionalAuth, asyncHandler(async (req, res) => {
  const id = idParam(req);
  const book = await cat.getBook(id);
  if (req.user) await rec.trackView(req.user.id, id);
  res.json(book);
}));
router.get('/books/:id/similar', asyncHandler(async (req, res) => res.json(await rec.similar(idParam(req)))));
router.get('/books/:id/frequently-bought-together', asyncHandler(async (req, res) => res.json(await rec.frequentlyBoughtTogether(idParam(req)))));
router.get('/books/:id/reviews', asyncHandler(async (req, res) => res.json(await cat.listReviews(idParam(req)))));
router.post('/books/:id/reviews', requireAuth, validate(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().min(3).max(1000) })), asyncHandler(async (req, res) => {
  res.status(201).json(await cat.upsertReview(req.user!.id, idParam(req), req.body.rating, req.body.comment));
}));

async function sendCover(req: any, res: any, side: 'front' | 'back') {
  const row = await queryOne(
    'SELECT b.id, b.title, b.description, b.cover_color_1, b.cover_color_2, a.name AS author, c.name AS category FROM books b JOIN authors a ON a.id=b.author_id JOIN categories c ON c.id=b.category_id WHERE b.id=$1',
    [idParam(req)],
  );
  if (!row) throw notFound('Book not found');
  res.set({ 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
  res.send(coverSvg({ id: row.id, title: row.title, author: row.author, description: row.description, color1: row.cover_color_1, color2: row.cover_color_2, category: row.category }, side));
}
router.get('/books/:id/cover.svg', asyncHandler((req, res) => sendCover(req, res, 'front')));
router.get('/books/:id/cover-back.svg', asyncHandler((req, res) => sendCover(req, res, 'back')));

router.get('/categories', asyncHandler(async (_req, res) => res.json(await cat.listCategories())));
router.get('/publishers', asyncHandler(async (_req, res) => res.json(await cat.listPublishers())));
router.get('/authors', asyncHandler(async (req, res) => res.json(await cat.listAuthors(req.query.categoryId ? Number(req.query.categoryId) : undefined))));
router.get('/languages', asyncHandler(async (_req, res) => res.json((await query<{ language: string }>('SELECT DISTINCT language FROM books ORDER BY language')).map((r) => r.language))));

// ================================================================== RECOMMENDATIONS
const limitQ = (req: any, d = 12) => Math.min(30, Math.max(1, Number(req.query.limit) || d));
router.get('/recommendations/featured', asyncHandler(async (req, res) => res.json(await rec.featured(limitQ(req)))));
router.get('/recommendations/best-sellers', asyncHandler(async (req, res) => res.json(await rec.bestSellers(limitQ(req)))));
router.get('/recommendations/new-arrivals', asyncHandler(async (req, res) => res.json(await rec.newArrivals(limitQ(req)))));
router.get('/recommendations/trending', asyncHandler(async (req, res) => res.json(await rec.trending(limitQ(req)))));
router.get('/recommendations/for-you', requireAuth, asyncHandler(async (req, res) => res.json(await rec.recommended(req.user!.id, limitQ(req)))));
router.get('/recommendations/buy-again', requireAuth, asyncHandler(async (req, res) => res.json(await rec.buyAgain(req.user!.id, limitQ(req)))));
router.get('/recommendations/recently-viewed', requireAuth, asyncHandler(async (req, res) => res.json(await rec.recentlyViewed(req.user!.id, limitQ(req)))));

// ================================================================== ADDRESSES
const mapAddress = (a: any) => ({ id: a.id, fullName: a.full_name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, country: a.country, postalCode: a.postal_code, isDefault: a.is_default });
const addressBody = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone,
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(100).default('India'),
  postalCode: z.string().trim().regex(/^[A-Za-z0-9 -]{4,12}$/, 'Invalid postal code'),
  isDefault: z.boolean().optional(),
});
const listAddresses = async (userId: number) => (await query('SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC, id', [userId])).map(mapAddress);

router.get('/addresses', requireAuth, asyncHandler(async (req, res) => res.json(await listAddresses(req.user!.id))));
router.post('/addresses', requireAuth, validate(addressBody), asyncHandler(async (req, res) => {
  const b = req.body;
  const uid = req.user!.id;
  const count = (await queryOne('SELECT COUNT(*)::int AS n FROM addresses WHERE user_id=$1', [uid]))!.n;
  const makeDefault = b.isDefault || count === 0;
  const row = await withTransaction(async (c) => {
    if (makeDefault) await c.query('UPDATE addresses SET is_default=FALSE WHERE user_id=$1', [uid]);
    return (await c.query('INSERT INTO addresses (user_id,full_name,phone,line1,line2,city,state,country,postal_code,is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [uid, b.fullName, b.phone, b.line1, b.line2 ?? null, b.city, b.state, b.country, b.postalCode, makeDefault])).rows[0];
  });
  res.status(201).json(mapAddress(row));
}));
router.put('/addresses/:id', requireAuth, validate(addressBody), asyncHandler(async (req, res) => {
  const b = req.body;
  const uid = req.user!.id;
  const id = idParam(req);
  const row = await withTransaction(async (c) => {
    if (b.isDefault) await c.query('UPDATE addresses SET is_default=FALSE WHERE user_id=$1', [uid]);
    const r = await c.query(
      'UPDATE addresses SET full_name=$3,phone=$4,line1=$5,line2=$6,city=$7,state=$8,country=$9,postal_code=$10,is_default=COALESCE($11,is_default),updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *',
      [id, uid, b.fullName, b.phone, b.line1, b.line2 ?? null, b.city, b.state, b.country, b.postalCode, b.isDefault ?? null],
    );
    return r.rows[0];
  });
  if (!row) throw notFound('Address not found');
  res.json(mapAddress(row));
}));
router.delete('/addresses/:id', requireAuth, asyncHandler(async (req, res) => {
  const uid = req.user!.id;
  const del = await queryOne('DELETE FROM addresses WHERE id=$1 AND user_id=$2 RETURNING is_default', [idParam(req), uid]);
  if (!del) throw notFound('Address not found');
  if (del.is_default) await query('UPDATE addresses SET is_default=TRUE WHERE id=(SELECT id FROM addresses WHERE user_id=$1 ORDER BY id LIMIT 1)', [uid]);
  res.status(204).end();
}));
router.post('/addresses/:id/default', requireAuth, asyncHandler(async (req, res) => {
  const uid = req.user!.id;
  const id = idParam(req);
  const exists = await queryOne('SELECT id FROM addresses WHERE id=$1 AND user_id=$2', [id, uid]);
  if (!exists) throw notFound('Address not found');
  await withTransaction(async (c) => {
    await c.query('UPDATE addresses SET is_default=FALSE WHERE user_id=$1', [uid]);
    await c.query('UPDATE addresses SET is_default=TRUE WHERE id=$1', [id]);
  });
  res.json(await listAddresses(uid));
}));

// ================================================================== CART & WISHLIST
router.get('/cart', requireAuth, asyncHandler(async (req, res) => res.json(await cart.getCart(req.user!.id))));
router.post('/cart/items', requireAuth, validate(z.object({ bookId: z.number().int().positive(), quantity: z.number().int().min(1).max(10).default(1) })), asyncHandler(async (req, res) => res.status(201).json(await cart.addItem(req.user!.id, req.body.bookId, req.body.quantity))));
router.patch('/cart/items/:id', requireAuth, validate(z.object({ quantity: z.number().int().min(1).max(10).optional(), savedForLater: z.boolean().optional() }).refine((v) => v.quantity !== undefined || v.savedForLater !== undefined, 'Nothing to update')), asyncHandler(async (req, res) => res.json(await cart.updateItem(req.user!.id, idParam(req), req.body))));
router.delete('/cart/items/:id', requireAuth, asyncHandler(async (req, res) => res.json(await cart.removeItem(req.user!.id, idParam(req)))));
router.post('/cart/items/:id/move-to-wishlist', requireAuth, asyncHandler(async (req, res) => res.json(await cart.moveToWishlist(req.user!.id, idParam(req)))));
router.post('/cart/coupon', requireAuth, validate(z.object({ code: z.string().trim().min(2).max(40) })), asyncHandler(async (req, res) => res.json(await cart.applyCoupon(req.user!.id, req.body.code))));
router.delete('/cart/coupon', requireAuth, asyncHandler(async (req, res) => res.json(await cart.removeCoupon(req.user!.id))));
router.get('/cart/shipping-estimate', requireAuth, asyncHandler(async (req, res) => {
  const pin = String(req.query.postalCode ?? '');
  if (!/^[A-Za-z0-9 -]{4,12}$/.test(pin)) throw badRequest('Valid postalCode query param required');
  res.json(await cart.estimateShipping(req.user!.id, pin));
}));
router.get('/coupons', asyncHandler(async (_req, res) => res.json(await query("SELECT code, description, discount_type AS \"discountType\", value, min_order AS \"minOrder\" FROM coupons WHERE is_active AND (valid_until IS NULL OR valid_until > now()) ORDER BY code"))));

router.get('/wishlist', requireAuth, asyncHandler(async (req, res) => res.json(await cart.listWishlist(req.user!.id))));
router.post('/wishlist', requireAuth, validate(z.object({ bookId: z.number().int().positive() })), asyncHandler(async (req, res) => res.status(201).json(await cart.addToWishlist(req.user!.id, req.body.bookId))));
router.delete('/wishlist/:bookId', requireAuth, asyncHandler(async (req, res) => res.json(await cart.removeFromWishlist(req.user!.id, idParam(req, 'bookId')))));

// ================================================================== CHECKOUT / PAYMENTS / ORDERS
router.get('/checkout/summary', requireAuth, asyncHandler(async (req, res) => {
  const pts = Number(req.query.points ?? 0);
  res.json(await orders.previewCheckout(req.user!.id, Number.isFinite(pts) ? Math.trunc(pts) : 0));
}));
router.post('/checkout/pay', requireAuth, validate(z.object({
  addressId: z.number().int().positive(),
  paymentMethod: z.enum(PAYMENT_METHODS as [string, ...string[]]),
  paymentDetails: z.record(z.string(), z.any()).optional(),
  pointsToRedeem: z.number().int().min(0).optional(),
  simulationMode: z.enum(['success', 'failed', 'pending']).optional(),
})), asyncHandler(async (req, res) => {
  const r = await orders.pay(req.user!.id, req.body);
  res.status(r.outcome === 'failed' ? 402 : 201).json(r);
}));
router.post('/payments/:orderId/resolve', requireAuth, validate(z.object({ outcome: z.enum(['success', 'failed']) })), asyncHandler(async (req, res) => res.json(await orders.resolvePendingPayment(req.user!.id, idParam(req, 'orderId'), req.body.outcome))));
router.get('/payments/methods', (_req, res) => res.json(PAYMENT_METHODS.map((m) => ({ id: m, label: m.replace('_', ' ') }))));

router.get('/orders', requireAuth, asyncHandler(async (req, res) => res.json(await orders.listOrders(req.user!.id))));
router.get('/orders/purchase-history', requireAuth, asyncHandler(async (req, res) => res.json(await orders.purchaseHistory(req.user!.id))));
router.post('/orders/buy-again', requireAuth, validate(z.object({ orderId: z.number().int().positive().optional(), bookIds: z.array(z.number().int().positive()).max(20).optional() })), asyncHandler(async (req, res) => res.json(await orders.buyAgain(req.user!.id, req.body))));
router.get('/orders/:id', requireAuth, asyncHandler(async (req, res) => res.json(await orders.loadOrder(req.user!.id, idParam(req)))));
router.post('/orders/:id/cancel', requireAuth, validate(z.object({ reason: z.string().trim().min(3, 'Please tell us why').max(500) })), asyncHandler(async (req, res) => res.json(await orders.cancelOrder(req.user!.id, idParam(req), req.body.reason))));

// ================================================================== REWARDS
router.get('/rewards', requireAuth, asyncHandler(async (req, res) => res.json(await orders.rewardSummary(req.user!.id))));

export { audit };
