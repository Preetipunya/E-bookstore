import fs from 'fs';
import path from 'path';
import { pool } from './db/pool';

export function schemaPath(): string {
  const candidates = [
    process.env.SCHEMA_PATH,
    path.resolve(__dirname, '../../database/schema.sql'), // repo layout (backend/src -> ../../database)
    path.resolve(__dirname, '../database/schema.sql'), // docker layout (/app/dist -> /app/database)
    path.resolve(process.cwd(), 'database/schema.sql'),
    path.resolve(process.cwd(), '../database/schema.sql'),
  ].filter(Boolean) as string[];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error(`schema.sql not found. Tried: ${candidates.join(', ')}`);
  return found;
}

export async function migrate(): Promise<void> {
  const sql = fs.readFileSync(schemaPath(), 'utf8');
  await pool.query(sql);
}

if (require.main === module) {
  migrate()
    .then(() => { console.log('Schema applied.'); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
