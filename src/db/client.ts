import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import type { Db } from './types';

let pool: Pool | undefined;
let db: Db | undefined;

export function getDb(): Db {
  if (db) return db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL tanımlı değil');
  pool = new Pool({ connectionString, max: 5 });
  attachDatabasePool(pool);
  db = drizzle({ client: pool, schema });
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
