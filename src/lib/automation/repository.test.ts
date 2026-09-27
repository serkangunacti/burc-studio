import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { planPublications, type PlannedPublication } from './plan';
import {
  approveDay,
  claimForPublishing,
  deleteMediaBefore,
  expireUnapproved,
  getIntegration,
  getMediaFile,
  getPublication,
  listPublications,
  markPublished,
  releaseForRetry,
  savePublication,
  saveIntegration,
  setGroupSkipped,
} from './repository';

const DATE = '2026-09-29';
const jpeg = (byte: number) => new Uint8Array([0xff, 0xd8, byte]);

let db: Db;
let plan: PlannedPublication[];

beforeEach(async () => {
  db = await createTestDb();
  const post = await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
  plan = planPublications(DATE, [post], DEFAULT_SETTINGS.automation);
});

async function saveAll() {
  for (const item of plan) {
    await savePublication(db, DATE, item, item.format === 'reels' ? { videoUrl: 'https://blob.example/r.mp4' } : { images: [jpeg(1), jpeg(2)] });
  }
  return listPublications(db, DATE);
}

describe('paylaşım kayıtları', () => {
  it('görselleri sırayla saklar ve kimlikleriyle bağlar', async () => {
    const rows = await saveAll();
    expect(rows.map((row) => [row.format, row.part])).toEqual([
      ['carousel', 3],
      ['carousel', 2],
      ['carousel', 1],
      ['reels', 0],
    ]);
    const carousel = rows[0];
    expect(carousel.status).toBe('ready');
    expect(carousel.media.imageIds).toHaveLength(2);
    const file = await getMediaFile(db, carousel.media.imageIds![1]);
    expect(file?.contentType).toBe('image/jpeg');
    expect(Array.from(file!.data)).toEqual([0xff, 0xd8, 2]);
    expect(rows[3].media).toEqual({ videoUrl: 'https://blob.example/r.mp4' });
  });

  it('hazır satırı yeniden çizimde günceller, onaylanmış satırı ezmez', async () => {
    await saveAll();
    const again = await savePublication(db, DATE, plan[0], { images: [jpeg(9)] });
    expect(again?.media.imageIds).toHaveLength(1);
    await approveDay(db, DATE);
    expect(await savePublication(db, DATE, plan[0], { images: [jpeg(7)] })).toBeNull();
    expect((await listPublications(db, DATE)).every((row) => row.status === 'approved')).toBe(true);
  });

  it('atlanan grup onaydan önce hazıra, onaydan sonra onaya döner', async () => {
    const rows = await saveAll();
    const postId = rows[0].postId;
    expect(await setGroupSkipped(db, { postId, format: 'carousel', skipped: true })).toHaveLength(3);
    expect((await approveDay(db, DATE)).map((row) => row.format)).toEqual(['reels']);
    const restored = await setGroupSkipped(db, { postId, format: 'carousel', skipped: false });
    expect(restored.map((row) => row.status)).toEqual(['approved', 'approved', 'approved']);
  });

  it('paylaşım bir kez sahiplenilir; kira süresi dolunca yeniden sahiplenilebilir', async () => {
    const [row] = await saveAll();
    expect(await claimForPublishing(db, row.id)).toBeNull();
    await approveDay(db, DATE);
    const now = new Date();
    const claimed = await claimForPublishing(db, row.id, now);
    expect(claimed?.attempts).toBe(1);
    expect(await claimForPublishing(db, row.id, now)).toBeNull();
    expect(await claimForPublishing(db, row.id, new Date(now.getTime() + 11 * 60_000))).not.toBeNull();
  });

  it('video işlenirken satır container ile onaya döner; paylaşılınca bir daha sahiplenilmez', async () => {
    const rows = await saveAll();
    const reels = rows[3];
    await approveDay(db, DATE);
    await claimForPublishing(db, reels.id);
    await releaseForRetry(db, reels.id, 'c-1');
    const again = await claimForPublishing(db, reels.id);
    expect(again?.igContainerId).toBe('c-1');
    await markPublished(db, reels.id, { igContainerId: 'c-1', igMediaId: 'm-1', permalink: 'https://instagram.com/p/x' });
    expect((await getPublication(db, reels.id))?.status).toBe('published');
    expect(await claimForPublishing(db, reels.id, new Date(Date.now() + 3_600_000))).toBeNull();
  });

  it('bakım: geçmiş günün onaysızlarını düşürür, eski görselleri siler', async () => {
    await saveAll();
    expect(await expireUnapproved(db, DATE)).toBe(0);
    expect(await expireUnapproved(db, '2026-09-30')).toBe(4);
    expect(await deleteMediaBefore(db, new Date(Date.now() + 1000))).toBe(6);
  });

  it('entegrasyon anahtarı kimlik başına tek satırda güncellenir', async () => {
    expect(await getIntegration(db, 'instagram')).toBeNull();
    const expiresAt = new Date('2026-11-26T00:00:00Z');
    await saveIntegration(db, { id: 'instagram', secretEncrypted: 'a', account: { id: '1', username: 'kozmikarkan' }, expiresAt });
    await saveIntegration(db, { id: 'instagram', secretEncrypted: 'b', account: { id: '1', username: 'kozmikarkan' }, expiresAt });
    await saveIntegration(db, { id: 'telegram', secretEncrypted: 'c', account: { id: '9', username: 'kozmikarkan_bot' }, expiresAt: null });
    expect((await getIntegration(db, 'instagram'))?.secretEncrypted).toBe('b');
    expect((await getIntegration(db, 'telegram'))?.account.username).toBe('kozmikarkan_bot');
  });
});
