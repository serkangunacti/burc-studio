import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const q = () => c.query(`select audience, part, status, attempts, rebuilds, permalink, to_char(published_at at time zone 'Europe/Istanbul','HH24:MI:SS') pub, left(coalesce(error,''),220) err from publications where date='2026-09-28' and kind='tarot' and format='carousel' order by audience, part`);
const deadline = Date.now() + 48 * 60_000;
while (Date.now() < deadline) {
  const rows = (await q()).rows;
  if (rows.every((r) => ['published', 'failed'].includes(r.status))) break;
  await new Promise((res) => setTimeout(res, 30_000));
}
console.log(new Date().toLocaleTimeString('tr-TR'));
console.log(JSON.stringify((await q()).rows, null, 1));
await c.end();
