import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

export async function startLocalDb(options: { port: number; dataDir: string }) {
  const pglite = new PGlite(options.dataDir);
  await migrate(drizzle({ client: pglite }), { migrationsFolder: 'src/db/migrations' });
  const server = new PGLiteSocketServer({ db: pglite, port: options.port, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${options.port}/postgres`,
    async stop() {
      await server.stop();
      await pglite.close();
    },
  };
}

async function main() {
  const local = await startLocalDb({
    port: Number(process.env.LOCAL_DB_PORT ?? 55432),
    dataDir: process.env.LOCAL_DB_DIR ?? '.data/pglite',
  });
  console.log(`Yerel veritabanı hazır: ${local.url}`);
  const shutdown = () => void local.stop().then(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1]?.endsWith('local-db.ts')) void main();
