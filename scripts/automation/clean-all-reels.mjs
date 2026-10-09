import pg from 'pg';
import { list, del } from '@vercel/blob';

async function main() {
  console.log('--- Vercel Blob & Yayın Temizliği Başlatılıyor ---');
  let deletedBlobs = 0;
  let cursor;
  do {
    const page = await list({ prefix: 'reels/', cursor, limit: 1000 });
    if (page.blobs.length > 0) {
      const urls = page.blobs.map((b) => b.url);
      console.log(`${urls.length} video siliniyor...`);
      await del(urls);
      deletedBlobs += urls.length;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  console.log(`Vercel Blob temizliği tamamlandı. Toplam silinen video: ${deletedBlobs}`);

  if (process.env.DATABASE_URL) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
    await client.connect();
    try {
      const res = await client.query(`
        UPDATE publications
        SET status = 'expired',
            approved_at = NULL,
            error = 'Kullanıcı talimatıyla tüm eski/hızlı videolar silindi ve yayın iptal edildi',
            media = '{}',
            updated_at = NOW()
        WHERE status IN ('ready', 'approved', 'publishing')
        RETURNING id, date, post_id, format
      `);
      console.log(`İptal edilen/sıfırlanan yayın kaydı sayısı: ${res.rowCount}`);
    } finally {
      await client.end();
    }
  }

  console.log('--- Temizlik Başarıyla Tamamlandı ---');
}

main().catch((err) => {
  console.error('Temizlik hatası:', err);
  process.exit(1);
});
