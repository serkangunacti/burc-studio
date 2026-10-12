import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { istanbulInstant, partLabel, partSigns, planPublications, type PlannablePost } from './plan';

const post = (id: string, kind: PlannablePost['kind'], audience: PlannablePost['audience']): PlannablePost => ({
  id,
  kind,
  audience,
  caption: 'Günün yorumları burada ✨',
  hashtags: ['#burç', '#astroloji'],
});

const DAILY = [post('hk', 'horoscope', 'kadin'), post('he', 'horoscope', 'erkek'), post('tk', 'tarot', 'kadin'), post('te', 'tarot', 'erkek')];
const automation = DEFAULT_SETTINGS.automation;

describe('carousel parçaları', () => {
  it('12 burcu sırayla 4erli üç parçaya böler', () => {
    expect(partSigns(1)).toEqual(['koc', 'boga', 'ikizler', 'yengec']);
    expect(partSigns(2)).toEqual(['aslan', 'basak', 'terazi', 'akrep']);
    expect(partSigns(3)).toEqual(['yay', 'oglak', 'kova', 'balik']);
    expect(partLabel(1)).toBe('1/3 · KOÇ · BOĞA · İKİZLER · YENGEÇ');
    expect(partLabel(2)).toBe('2/3 · ASLAN · BAŞAK · TERAZİ · AKREP');
  });
});

describe('paylaşım planı', () => {
  it('TSİ saatini UTC anına çevirir', () => {
    expect(istanbulInstant('2026-09-29', '08:30').toISOString()).toBe('2026-09-29T05:30:00.000Z');
  });

  it('günlük 4 gönderiden 4 Reels video planlar (carousel kartları üretilmez)', () => {
    const plan = planPublications('2026-09-29', DAILY, automation);
    expect(plan).toHaveLength(4);
    expect(plan.filter((item) => item.format === 'carousel')).toHaveLength(0);
    expect(plan.filter((item) => item.format === 'reels').map((item) => [item.postId, item.scheduledAt.toISOString()])).toEqual([
      ['hk', '2026-09-29T06:00:00.000Z'],
      ['he', '2026-09-29T06:25:00.000Z'],
      ['tk', '2026-09-29T06:50:00.000Z'],
      ['te', '2026-09-29T07:15:00.000Z'],
    ]);
  });

  it('Reels açıklaması parçasızdır ve etiketleri içerir', () => {
    const plan = planPublications('2026-09-29', [DAILY[0]], automation);
    expect(plan[0].caption).toContain('29 Eylül 2026 · Günlük burç yorumu · Kadın');
    expect(plan[0].caption).not.toContain('(1/3)');
    expect(plan[0].caption).toContain('#günlükburç #burçyorumu');
  });

  it('pazartesi haftalık gönderileri ilk sırada (08:30 ve 08:45) video olarak planlar; özel ve genel gönderileri atlar', () => {
    const plan = planPublications(
      '2026-09-28',
      [...DAILY, post('wk', 'weekly', 'kadin'), post('we', 'weekly', 'erkek'), post('sp', 'special', 'genel')],
      automation,
    );
    expect(plan).toHaveLength(6);
    expect(plan.every((item) => item.scheduledAt.getTime() >= new Date('2026-09-28T05:30:00Z').getTime())).toBe(true);
    expect(plan.some((item) => item.postId === 'sp')).toBe(false);
    expect(plan[0].postId).toBe('wk');
    expect(plan[0].scheduledAt.toISOString()).toBe('2026-09-28T05:30:00.000Z');
    expect(plan[1].postId).toBe('we');
    expect(plan[1].scheduledAt.toISOString()).toBe('2026-09-28T05:45:00.000Z');
  });

  it('eksik gönderi için satır üretmez', () => {
    expect(planPublications('2026-09-29', [DAILY[1]], automation).every((item) => item.postId === 'he')).toBe(true);
  });

  it('aynı videoyu aynı saatte, platforma uygun açıklamayla iki platform için planlar (TikTok açıkken)', () => {
    const plan = planPublications('2026-09-29', DAILY, { ...automation, tiktok: { enabled: true } });
    expect(plan).toHaveLength(8);
    const tiktok = plan.filter((item) => item.format === 'tiktok');
    const reels = plan.filter((item) => item.format === 'reels');
    expect(tiktok.map(({ postId, part, scheduledAt }) => ({ postId, part, scheduledAt }))).toEqual(
      reels.map(({ postId, part, scheduledAt }) => ({ postId, part, scheduledAt })),
    );
    expect(tiktok[0].caption).toContain('Günün yorumları burada ✨');
    expect(reels[0].caption).toContain('Günün yorumları burada ✨');
    expect(tiktok[0].caption).not.toBe(reels[0].caption);
  });

  it('tarot açıklamasında türü ve erkek hedef kitleyi belirtir; ilgili etiketleri kullanır', () => {
    const plan = planPublications('2026-10-05', [post('te', 'tarot', 'erkek')], automation);
    expect(plan[0].caption).toContain('5 Ekim 2026 · Günlük tarot yorumu · Erkek');
    expect(plan[0].caption).toContain('#tarot #günlüktarot');
    expect(plan[0].caption).not.toContain('#astroloji');
    expect(plan[0].caption.match(/#[\p{L}\p{N}_]+/gu)?.length).toBeLessThanOrEqual(5);
  });

  it('haftalık dönemin yıl sınırını doğru gösterir', () => {
    const plan = planPublications('2026-12-28', [post('we', 'weekly', 'erkek')], automation);
    expect(plan[0].caption).toContain('28 Aralık 2026 – 3 Ocak 2027 · Haftalık burç yorumu · Erkek');
  });
});
