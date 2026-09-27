import type { Db } from '@/db/types';
import { createPostVersion, saveReadings, type NewReading, type PostRow, type ReadingKey } from '@/lib/content/repository';
import { TAROT_DECK } from '@/lib/tarot/deck';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';

const TEMPLATES = { horoscope: 'pastel@1', tarot: 'pastel-tarot@1', weekly: 'pastel-weekly@1', special: 'pastel@1' } as const;

export function sampleReading(sign: SignSlug, tarotCardId?: string): NewReading {
  return {
    sign,
    headline: `${sign} başlık`,
    body: `${sign} yorum`,
    short: `${sign} kısa`,
    meta: { scores: { love: 4, money: 3, health: 5 }, luckyColor: 'lila', luckyNumber: 7, ...(tarotCardId ? { tarotCardId } : {}) },
    provider: 'mock',
    model: 'mock',
    promptVersion: 'burc-v1',
    runId: null,
  };
}

export async function seedPost(db: Db, key: ReadingKey, overrides: { caption?: string; hook?: string } = {}): Promise<PostRow> {
  // Tarot ve haftalık yorumlar kartlı; sıralı ve tekrarsız kartlar çizimi tekrarlanabilir kılar.
  const saved = await saveReadings(db, key, SIGN_SLUGS.map((sign, index) => sampleReading(sign, key.kind === 'horoscope' ? undefined : TAROT_DECK[index * 6].id)));
  return createPostVersion(db, {
    ...key,
    templateVersion: TEMPLATES[key.kind],
    format: '4x5',
    cover: { hook: overrides.hook ?? 'Kanca' },
    caption: overrides.caption ?? 'Caption',
    hashtags: ['#burç'],
    signReadingIds: saved.map((row) => row.id),
  });
}
