import { PoolClient } from 'pg';
import { Db, query } from '../db/pool';

export async function audit(db: Db, userId: number | null, action: string, entityType?: string, entityId?: string | number, metadata: object = {}) {
  await query(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)',
    [userId, action, entityType ?? null, entityId === undefined ? null : String(entityId), JSON.stringify(metadata)],
    db,
  );
}

export type PointType = 'earned' | 'redeemed' | 'refunded' | 'reversed' | 'bonus';

/** Applies a delta to the user's balance and appends a ledger row. Caller should hold a transaction. */
export async function addPoints(client: PoolClient, userId: number, orderId: number | null, delta: number, type: PointType, description: string): Promise<number> {
  if (delta === 0) {
    const r = await client.query('SELECT reward_balance FROM users WHERE id=$1', [userId]);
    return r.rows[0].reward_balance;
  }
  const r = await client.query('UPDATE users SET reward_balance = reward_balance + $2, updated_at = now() WHERE id=$1 RETURNING reward_balance', [userId, delta]);
  const balance: number = r.rows[0].reward_balance;
  await client.query('INSERT INTO reward_points (user_id, order_id, points, type, description, balance_after) VALUES ($1,$2,$3,$4,$5,$6)', [
    userId,
    orderId,
    delta,
    type,
    description,
    balance,
  ]);
  return balance;
}
