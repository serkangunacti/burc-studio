import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { getPostDetail } from './repository';
import { audienceOf, brandFromSettings, buildCoverProps, buildSlideProps } from './slide-props';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };
const BRAND = brandFromSettings({ ...DEFAULT_SETTINGS, instagramHandle: 'burc.studio' });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('buildSlideProps', () => {
  it('gönderi sürümünden 14 slaytlık, kendi kendine yeten veri üretir', async () => {
    const post = await seedPost(db, KEY);
    const props = buildSlideProps((await getPostDetail(db, post.id))!, BRAND);
    expect(props).toHaveLength(14);
    expect(props[0]).toEqual({
      format: '4x5',
      brand: { handle: 'burc.studio', enabled: true, position: 'bottom-center', opacity: 0.55 },
      slide: { type: 'cover', audience: 'kadin', dateLabel: '26 EYLÜL 2026 CUMARTESİ', hook: 'Kanca' },
    });
    expect(props[1].slide).toEqual({
      type: 'sign',
      audience: 'kadin',
      dateLabel: '26 EYLÜL',
      sign: 'koc',
      signName: 'Koç',
      dateRange: '21 Mart – 19 Nisan',
      element: 'ates',
      headline: 'koc başlık',
      body: 'koc yorum',
      scores: { love: 4, money: 3, health: 5 },
      luckyColor: { name: 'Lila', hex: '#C8B6E2' },
      luckyNumber: 7,
    });
    expect(props[13].slide).toEqual({ type: 'cta', audience: 'kadin' });
    expect(buildCoverProps(post, BRAND)).toEqual(props[0]);
  });

  it('yorumu eksik burç slaytında ve genel kitlede hata verir', async () => {
    const post = await seedPost(db, KEY);
    const detail = (await getPostDetail(db, post.id))!;
    detail.slides[3] = { ...detail.slides[3], reading: null };
    expect(() => buildSlideProps(detail, BRAND)).toThrow('Slayt 3 için yorum bulunamadı');
    expect(() => audienceOf({ audience: 'genel' })).toThrow('Genel kitleli gönderiler');
  });
});
