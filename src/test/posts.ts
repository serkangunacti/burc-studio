import type { Db } from '@/db/types';
import { createPostVersion, saveReadings, type NewReading, type PostRow, type ReadingKey } from '@/lib/content/repository';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';

export function sampleReading(sign: SignSlug): NewReading {
  return {
    sign,
    headline: `${sign} başlık`,
    body: `${sign} yorum`,
    short: `${sign} kısa`,
    meta: { scores: { love: 4, money: 3, health: 5 }, luckyColor: 'lila', luckyNumber: 7 },
    provider: 'mock',
    model: 'mock',
    promptVersion: 'burc-v1',
    runId: null,
  };
}

export async function seedPost(db: Db, key: ReadingKey, overrides: { caption?: string; hook?: string } = {}): Promise<PostRow> {
  const saved = await saveReadings(db, key, SIGN_SLUGS.map(sampleReading));
  return createPostVersion(db, {
    ...key,
    templateVersion: 'pastel@1',
    format: '4x5',
    cover: { hook: overrides.hook ?? 'Kanca' },
    caption: overrides.caption ?? 'Caption',
    hashtags: ['#burç'],
    signReadingIds: saved.map((row) => row.id),
  });
}
