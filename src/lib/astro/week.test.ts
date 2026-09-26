import { describe, expect, it } from 'vitest';
import { describeWeekSkyTr, getWeekSky, isMonday, weekLabelTr } from './week';

describe('haftanın gökyüzü', () => {
  it('pazartesiyi tanır ve hafta etiketini yazar', () => {
    expect(isMonday('2026-09-28')).toBe(true);
    expect(isMonday('2026-09-29')).toBe(false);
    expect(weekLabelTr('2026-09-28')).toBe('28 Eylül – 4 Ekim');
    expect(weekLabelTr('2026-12-28')).toBe('28 Aralık – 3 Ocak');
  });

  it('28 Eylül haftasının burç geçişlerini, retro başlangıcını ve ay evresini sırayla listeler', () => {
    const week = getWeekSky('2026-09-28');
    expect(week.label).toBe('28 Eylül – 4 Ekim');
    expect(week.sunSigns).toEqual(['terazi']);
    expect(week.events).toEqual([
      '28 Eylül: Mars Aslan burcuna geçiyor.',
      '30 Eylül: Merkür Akrep burcuna geçiyor.',
      expect.stringMatching(/^3 Ekim: Son Dördün \((İkizler|Yengeç)\)\.$/),
      '3 Ekim: Venüs retrosu başlıyor.',
    ]);
    expect(describeWeekSkyTr(week)).toContain('Güneş hafta boyunca Terazi burcunda.');
  });

  it('5 Ekim haftasında Terazi yeni ayını bulur', () => {
    expect(getWeekSky('2026-10-05').events).toContainEqual('10 Ekim: Yeni Ay (Terazi).');
  });

  it('pazartesi olmayan tarih için hata verir', () => {
    expect(() => getWeekSky('2026-09-29')).toThrow('Haftalık gökyüzü pazartesi tarihiyle istenmeli');
  });
});
