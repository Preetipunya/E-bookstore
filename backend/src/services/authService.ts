import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config/env';
import { pool, query, queryOne, withTransaction } from '../db/pool';
import { signAccessToken } from '../middleware/http';
import { badRequest, conflict, unauthorized } from '../utils/errors';
import { addPoints, audit } from './ledger';

export const WELCOME_BONUS = 100;
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function publicUser(u: any) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, rewardPoints: u.reward_balance, createdAt: u.created_at };
}

async function issueTokens(user: any) {
  const accessToken = signAccessToken({ id: user.id, email: user.email });
  const refreshToken = crypto.randomBytes(48).toString('hex');
  await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + ($3 || \' days\')::interval)', [
    user.id,
    sha(refreshToken),
    String(config.refreshTokenTtlDays),
  ]);
  return { accessToken, refreshToken, expiresIn: config.accessTokenTtl };
}

export async function register(input: { name: string; email: string; password: string; phone?: string }) {
  const existing = await queryOne('SELECT id FROM users WHERE lower(email)=lower($1)', [input.email]);
  if (existing) throw conflict('An account with this email already exists', 'EMAIL_TAKEN');
  const hash = await bcrypt.hash(input.password, config.bcryptRounds);
  const user = await withTransaction(async (c) => {
    const r = await c.query('INSERT INTO users (name,email,password_hash,phone) VALUES ($1,$2,$3,$4) RETURNING *', [input.name.trim(), input.email.trim(), hash, input.phone ?? null]);
    await addPoints(c, r.rows[0].id, null, WELCOME_BONUS, 'bonus', 'Welcome bonus');
    await audit(c, r.rows[0].id, 'auth.register', 'user', r.rows[0].id);
    return (await c.query('SELECT * FROM users WHERE id=$1', [r.rows[0].id])).rows[0];
  });
  return { user: publicUser(user), ...(await issueTokens(user)) };
}

export async function login(email: string, password: string) {
  const user = await queryOne('SELECT * FROM users WHERE lower(email)=lower($1)', [email]);
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !ok) throw unauthorized('Invalid email or password');
  await audit(pool, user.id, 'auth.login', 'user', user.id);
  return { user: publicUser(user), ...(await issueTokens(user)) };
}

export async function refresh(refreshToken: string) {
  const row = await queryOne('SELECT * FROM refresh_tokens WHERE token_hash=$1', [sha(refreshToken)]);
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) throw unauthorized('Invalid refresh token');
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id=$1', [row.id]); // rotation
  const user = await queryOne('SELECT * FROM users WHERE id=$1', [row.user_id]);
  if (!user) throw unauthorized('Invalid refresh token');
  return { user: publicUser(user), ...(await issueTokens(user)) };
}

export async function logout(refreshToken?: string) {
  if (refreshToken) await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash=$1 AND revoked_at IS NULL', [sha(refreshToken)]);
}

export async function forgotPassword(email: string): Promise<{ resetToken?: string }> {
  const user = await queryOne('SELECT id FROM users WHERE lower(email)=lower($1)', [email]);
  if (!user) return {};
  const token = crypto.randomBytes(32).toString('hex');
  await query("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '30 minutes')", [user.id, sha(token)]);
  await audit(pool, user.id, 'auth.forgot_password', 'user', user.id);
  if (!config.isTest) console.log(`[demo] password reset token for ${email}: ${token}`);
  return { resetToken: token };
}

export async function resetPassword(token: string, newPassword: string) {
  const row = await queryOne('SELECT * FROM password_resets WHERE token_hash=$1', [sha(token)]);
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) throw badRequest('Reset token is invalid or has expired');
  const hash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await withTransaction(async (c) => {
    await c.query('UPDATE users SET password_hash=$2, updated_at=now() WHERE id=$1', [row.user_id, hash]);
    await c.query('UPDATE password_resets SET used_at=now() WHERE id=$1', [row.id]);
    await c.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [row.user_id]);
    await audit(c, row.user_id, 'auth.reset_password', 'user', row.user_id);
  });
}
