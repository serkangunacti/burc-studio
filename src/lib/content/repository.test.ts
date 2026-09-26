import { beforeEach, describe, expect, it } from 'vitest';
import { readings } from '@/db/schema';
import { isUniqueViolation } from '@/db/errors';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';
import {
  createPostVersion,
  getCurrentPost,
  getCurrentPostsForDate,
  getCurrentReadings,
  getRecentHeadlines,
  saveReadings,
  type NewReading,
} from './repository';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };

function reading(sign: SignSlug, headline = `${sign} başlık`): NewReading {
  return {
    sign,
    headline,
    body: `${sign} yorum`,
    short: `${sign} kısa`,
    meta: { scores: { love: 4, money: 3, health: 5 }, luckyColor: 'lila', luckyNumber: 7 },
    provider: 'mock',
    model: 'mock',
    promptVersion: 'burc-v1',
    runId: null,
  };
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('okuma sürümleri', () => {
  it('yeniden kayıt yeni sürüm açar, yalnızca son sürüm güncel kalır', async () => {
    await saveReadings(db, KEY, SIGN_SLUGS.map((sign) => reading(sign)));
    const [second] = await saveReadings(db, KEY, [reading('koc', 'yeni başlık')]);
    expect(second).toMatchObject({ sign: 'koc', version: 2, isCurrent: true });
    const current = await getCurrentReadings(db, KEY);
    expect(current.map((row) => row.sign)).toEqual([...SIGN_SLUGS]);
    expect(current[0]).toMatchObject({ headline: 'yeni başlık', version: 2 });
    expect(await db.select().from(readings)).toHaveLength(13);
  });

  it('aynı anahtarda ikinci güncel kayıt veritabanı tarafından reddedilir', async () => {
    await saveReadings(db, KEY, [reading('koc')]);
    const error = await db
      .insert(readings)
      .values({ ...KEY, ...reading('koc'), version: 9, isCurrent: true })
      .catch((caught: unknown) => caught);
    expect(isUniqueViolation(error)).toBe(true);
  });

  it('son iki günün yalnızca güncel başlıklarını döner', async () => {
    for (const date of ['2026-09-23', '2026-09-24', '2026-09-25']) {
      await saveReadings(db, { ...KEY, date }, [reading('koc', `başlık ${date}`)]);
    }
    await saveReadings(db, { ...KEY, date: '2026-09-25' }, [reading('koc', 'son başlık')]);
    await saveReadings(db, { ...KEY, audience: 'erkek', date: '2026-09-25' }, [reading('koc', 'erkek başlık')]);
    const recent = await getRecentHeadlines(db, { kind: 'horoscope', audience: 'kadin' }, '2026-09-26', 2);
    expect(recent.map((item) => [item.date, item.headline])).toEqual([
      ['2026-09-24', 'başlık 2026-09-24'],
      ['2026-09-25', 'son başlık'],
    ]);
  });

  it('elle düzenleme zamanını saklar', async () => {
    const editedAt = new Date('2026-09-26T08:00:00Z');
    const [row] = await saveReadings(db, KEY, [{ ...reading('koc'), editedAt }]);
    expect(row.editedAt).toEqual(editedAt);
  });
});

describe('gönderi sürümleri', () => {
  it('14 slaytlık gönderi oluşturur; yeni sürüm eskisini arşivler', async () => {
    const saved = await saveReadings(db, KEY, SIGN_SLUGS.map((sign) => reading(sign)));
    const input = {
      ...KEY,
      templateVersion: 'pastel@1',
      format: '4x5' as const,
      cover: { hook: 'Kanca' },
      caption: 'Caption',
      hashtags: ['#burç'],
      signReadingIds: saved.map((row) => row.id),
    };
    const first = await createPostVersion(db, input);
    const second = await createPostVersion(db, { ...input, caption: 'Yeni caption' });
    expect(first.version).toBe(1);
    expect(second).toMatchObject({ version: 2, isCurrent: true, status: 'taslak', caption: 'Yeni caption' });
    const current = await getCurrentPost(db, KEY);
    expect(current?.post.id).toBe(second.id);
    expect(current?.slides.map((slide) => slide.type)).toEqual(['cover', ...Array(12).fill('sign'), 'cta']);
    expect(current?.slides[1].readingId).toBe(saved[0].id);
    expect((await getCurrentPostsForDate(db, KEY.date)).map((post) => post.id)).toEqual([second.id]);
  });

  it('12 burç kimliği olmadan gönderi oluşturmaz', async () => {
    await expect(
      createPostVersion(db, { ...KEY, templateVersion: 'pastel@1', format: '4x5', cover: { hook: 'x' }, caption: 'x', hashtags: [], signReadingIds: [] }),
    ).rejects.toThrow('12 burç');
  });
});
