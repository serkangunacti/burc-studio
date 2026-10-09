import pg from 'pg';
import {list, del} from '@vercel/blob';

// One explicitly authorized reset. Never run from the recurring render job.
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.CONFIRM_RESET_GENERATED_VIDEOS !== '2026-10-09') {
  throw new Error('9 Ekim video temizliği yalnız açık onaylı Actions işiyle yapılabilir');
}
const db = new pg.Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000});
try {
  await db.connect();
  const active = await db.query("select count(*)::int as count from publications where status='publishing'");
  if (active.rows[0].count) throw new Error('Aktif paylaşım var; video temizliği bekletildi');
  const blobs = [];
  let cursor;
  do {
    const page = await list({prefix: 'reels/', cursor, limit: 1000});
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  await db.query('begin');
  await db.query("update publications set status=case when status='published' then status else 'expired'::publication_status end, approved_at=null, media=media-'videoUrl'-'durationSeconds'-'partCount', updated_at=now() where media ? 'videoUrl'");
  const cleared = await db.query("delete from publications where date='2026-10-09' and status not in ('published','publishing') returning id");
  await db.query('commit');
  if (blobs.length) await del(blobs.map(blob => blob.url));
  const remaining = await list({prefix: 'reels/', limit: 1});
  if (remaining.blobs.length) throw new Error('Eski video temizliği doğrulanamadı');
  console.log(JSON.stringify({deletedVideos: blobs.length, resetTodayPublications: cleared.rowCount, remainingGeneratedVideos: 0}));
} finally {
  await db.end();
}
