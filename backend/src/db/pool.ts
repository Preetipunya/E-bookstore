import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { config } from '../config/env';

// NUMERIC -> number, BIGINT -> number, DATE -> 'YYYY-MM-DD' string (no timezone shifting)
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1082, (v) => v);

export const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

export type Db = Pick<Pool | PoolClient, 'query'>;

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const res = await db.query<T>(text, params as any[]);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = pool): Promise<T | null> {
  const rows = await query<T>(text, params, db);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
