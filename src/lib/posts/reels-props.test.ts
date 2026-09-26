import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { buildReelsProps } from './reels-props';
import { getPostDetail } from './repository';
import { brandFromSettings } from './slide-props';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('buildReelsProps', () => {
  it('gönderi sürümünden kapak bilgisi ve 12 burcun kısa metinleriyle Reels verisi kurar', async () => {
    const post = await seedPost(db, { date: '2026-09-26', kind: 'horoscope', audience: 'kadin' }, { hook: 'Özel kanca' });
    const brand = brandFromSettings({ ...DEFAULT_SETTINGS, instagramHandle: 'kozmikarkan' });
    const reels = buildReelsProps((await getPostDetail(db, post.id))!, brand);
    expect(reels).toMatchObject({ audience: 'kadin', dateLabel: '26 EYLÜL 2026 CUMARTESİ', hook: 'Özel kanca', variant: 20722, brand: { handle: 'kozmikarkan' } });
    expect(reels.signs.map((sign) => sign.sign)).toHaveLength(12);
    expect(reels.signs[0]).toEqual({
      sign: 'koc',
      signName: 'Koç',
      dateRange: '21 Mart – 19 Nisan',
      element: 'ates',
      headline: 'koc başlık',
      short: 'koc kısa',
      scores: { love: 4, money: 3, health: 5 },
      luckyColor: { name: 'Lila', hex: '#C8B6E2' },
      luckyNumber: 7,
    });
  });
});
