import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/db/schema';
import type { Db } from '@/db/types';

export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: 'src/db/migrations' });
  return db;
}
