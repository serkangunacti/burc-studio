import { describe, expect, it } from 'vitest';
import { getWeekSky } from '@/lib/astro/week';
import { getTarotCard } from '@/lib/tarot/deck';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import { WEEKLY_INSTRUCTIONS, buildWeeklyBatchPrompt, buildWeeklySignPrompt } from './weekly-prompt';

const cards = new Map(SIGN_SLUGS.map((sign, index) => [sign, getTarotCard(index === 0 ? 'yildiz' : 'kupa-as')]));
const base = { monday: '2026-09-28', audience: 'erkek' as const, week: getWeekSky('2026-09-28'), cards, recent: [] };

describe('haftalık prompt', () => {
  it('hafta etiketini, haftanın gökyüzünü ve her burcun kartını içerir; kart adının metinde geçmemesini ister', () => {
    const { instructions, prompt } = buildWeeklyBatchPrompt(base);
    expect(instructions).toBe(WEEKLY_INSTRUCTIONS);
    expect(prompt).toContain('HAFTALIK YORUM');
    expect(prompt).toContain('Hafta: 28 Eylül – 4 Ekim.');
    expect(prompt).toContain('Bu yorumlar erkek okurlar için.');
    expect(prompt).toContain('30 Eylül Çarşamba: Merkür Akrep burcuna geçiyor.');
    expect(prompt).toContain('- Koç (koc, 21 Mart – 19 Nisan): cesur, girişken, sabırsız, enerjik — haftanın kartı: Yıldız (umut, ilham, iyileşme, yenilenmiş inanç)');
    expect(WEEKLY_INSTRUCTIONS).toContain('600–850 karakter');
    expect(WEEKLY_INSTRUCTIONS).toContain('kartın adını');
    expect(WEEKLY_INSTRUCTIONS).toContain('burcun adını başlıkta tekrarlama');
    expect(WEEKLY_INSTRUCTIONS).toContain('gün adlarını gökyüzü listesindeki tarihlerle birebir kullan');
  });

  it('tek burç promptu yalnızca o burcu ve kartını ister', () => {
    const { prompt } = buildWeeklySignPrompt({ ...base, sign: 'koc', issues: [{ field: 'yorum', message: '600-850 karakter olmalı (şu an 420).' }] });
    expect(prompt).toContain('Yalnızca şu burç için yaz: Koç (koc)');
    expect(prompt).toContain('haftanın kartı: Yıldız');
    expect(prompt).toContain('- yorum: 600-850 karakter olmalı (şu an 420).');
    expect(prompt).not.toContain('- Boğa (boga');
  });
});
