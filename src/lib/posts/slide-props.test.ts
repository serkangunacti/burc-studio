import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { getPostDetail } from './repository';
import { audienceOf, brandFromSettings, buildCoverProps, buildSlideProps, variantFor } from './slide-props';

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
    expect(props.every((item) => item.variant === 20722)).toBe(true);
    expect(props[0]).toEqual({
      format: '4x5',
      variant: 20722,
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

describe('haftalık gönderi verisi', () => {
  it('kapak ve burç slaytlarında tarih yerine hafta aralığını yazar', async () => {
    const post = await seedPost(db, { date: '2026-09-28', kind: 'weekly', audience: 'erkek' });
    const props = buildSlideProps((await getPostDetail(db, post.id))!, BRAND);
    expect(props[0].slide).toMatchObject({ type: 'cover', dateLabel: '28 EYLÜL – 4 EKİM' });
    expect(props[1].slide).toMatchObject({ type: 'sign', dateLabel: '28 EYLÜL – 4 EKİM' });
  });
});

describe('tarot gönderi verisi', () => {
  it('tarot gönderisinde her burç slaytı günün kartını taşır; burç gönderisinde taşımaz', async () => {
    const tarot = await seedPost(db, { date: '2026-09-27', kind: 'tarot', audience: 'kadin' });
    const slides = buildSlideProps((await getPostDetail(db, tarot.id))!, BRAND).filter((props) => props.slide.type === 'sign');
    expect(slides).toHaveLength(12);
    expect(slides.every((props) => props.slide.type === 'sign' && props.slide.tarotCard?.id && props.slide.tarotCard.name)).toBe(true);
    const daily = await seedPost(db, KEY);
    expect(buildSlideProps((await getPostDetail(db, daily.id))!, BRAND)[1].slide).not.toHaveProperty('tarotCard');
  });
});

describe('variantFor', () => {
  it('aynı günün gönderileri birbirinden, ardışık günler de birbirinden farklı zemin alır', () => {
    const day = (date: string, kind: 'horoscope' | 'tarot' | 'special', audience: 'kadin' | 'erkek' | 'genel') => variantFor({ date, kind, audience }) % 7;
    const sameDay = [day('2026-09-26', 'horoscope', 'kadin'), day('2026-09-26', 'horoscope', 'erkek'), day('2026-09-26', 'tarot', 'kadin'), day('2026-09-26', 'tarot', 'erkek'), day('2026-09-26', 'special', 'genel')];
    expect(new Set(sameDay).size).toBe(5);
    expect(day('2026-09-27', 'horoscope', 'kadin')).not.toBe(day('2026-09-26', 'horoscope', 'kadin'));
    expect(variantFor({ date: '2026-09-26', kind: 'horoscope', audience: 'kadin' })).toBe(20722);
  });

  it('pazartesi haftalık gönderiler günlük, tarot ve özel gönderilerden farklı zemin alır', () => {
    const all = (['horoscope', 'tarot', 'weekly'] as const).flatMap((kind) =>
      (['kadin', 'erkek'] as const).map((audience) => variantFor({ date: '2026-09-28', kind, audience }) % 7),
    );
    expect(new Set([...all, variantFor({ date: '2026-09-28', kind: 'special', audience: 'genel' }) % 7]).size).toBe(7);
  });
});
