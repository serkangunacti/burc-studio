import pg from 'pg';
const wait = new Date('2026-09-28T22:10:00+03:00').getTime() - Date.now();
if (wait > 0) await new Promise((r) => setTimeout(r, wait));
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const expired = await c.query(`update publications set status='expired', error='22:00''ye kadar paylaşılamadı; kullanıcı isteğiyle bu gece paylaşılmadı', updated_at=now() where date='2026-09-28' and format='reels' and part=0 and status='approved' returning kind, audience`);
console.log(new Date().toLocaleTimeString('tr-TR'), 'süresi dolan Reels:', JSON.stringify(expired.rows));
console.table((await c.query(`select kind, audience, format, status, permalink, left(coalesce(error,''),80) err from publications where date='2026-09-28' and part=0 and format <> 'carousel' order by scheduled_at, format`)).rows);
await c.end();
