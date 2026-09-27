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

  it('günlük 4 gönderiden 12 carousel parçası ve 4 Reels planlar', () => {
    const plan = planPublications('2026-09-29', DAILY, automation);
    expect(plan).toHaveLength(16);
    expect(plan.filter((item) => item.format === 'carousel')).toHaveLength(12);
    expect(plan.filter((item) => item.format === 'reels').map((item) => [item.postId, item.scheduledAt.toISOString()])).toEqual([
      ['hk', '2026-09-29T16:00:00.000Z'],
      ['he', '2026-09-29T17:00:00.000Z'],
      ['tk', '2026-09-29T18:00:00.000Z'],
      ['te', '2026-09-29T19:00:00.000Z'],
    ]);
  });

  it('parçaları sondan başa, ayarlanan arayla sıralar', () => {
    const parts = planPublications('2026-09-29', [DAILY[0]], automation).filter((item) => item.format === 'carousel');
    expect(parts.map((item) => [item.part, item.scheduledAt.toISOString()])).toEqual([
      [1, '2026-09-29T05:36:00.000Z'],
      [2, '2026-09-29T05:33:00.000Z'],
      [3, '2026-09-29T05:30:00.000Z'],
    ]);
  });

  it('açıklamaya parçanın burçlarını ve hashtagleri ekler; Reels açıklaması parçasızdır', () => {
    const plan = planPublications('2026-09-29', [DAILY[0]], automation);
    expect(plan[0].caption).toBe('Koç · Boğa · İkizler · Yengeç (1/3)\n\nGünün yorumları burada ✨\n\n#burç #astroloji');
    expect(plan[3].caption).toBe('Günün yorumları burada ✨\n\n#burç #astroloji');
  });

  it('pazartesi haftalık gönderileri kendi saatlerinde planlar; özel ve genel gönderileri atlar', () => {
    const plan = planPublications(
      '2026-09-28',
      [...DAILY, post('wk', 'weekly', 'kadin'), post('we', 'weekly', 'erkek'), post('sp', 'special', 'genel')],
      automation,
    );
    expect(plan).toHaveLength(24);
    expect(plan.some((item) => item.postId === 'sp')).toBe(false);
    const weekly = plan.filter((item) => item.postId === 'we');
    expect(weekly.find((item) => item.part === 3)?.scheduledAt.toISOString()).toBe('2026-09-28T08:30:00.000Z');
    expect(weekly.find((item) => item.format === 'reels')?.scheduledAt.toISOString()).toBe('2026-09-28T15:00:00.000Z');
  });

  it('eksik gönderi için satır üretmez', () => {
    expect(planPublications('2026-09-29', [DAILY[1]], automation).every((item) => item.postId === 'he')).toBe(true);
  });
});
