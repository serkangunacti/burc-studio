import { describe, expect, it } from 'vitest';
import { getSkySnapshot } from '@/lib/astro/sky';
import { HOROSCOPE_INSTRUCTIONS, buildHoroscopeBatchPrompt, buildHoroscopeSignPrompt } from './horoscope-prompt';

const base = {
  dateKey: '2026-09-24',
  audience: 'kadin' as const,
  sky: getSkySnapshot('2026-09-24'),
  recent: [{ date: '2026-09-23', sign: 'koc' as const, headline: 'Cesaretin parlıyor', short: 'Koç: Bugün sahne senin' }],
};

describe('buildHoroscopeBatchPrompt', () => {
  it('tarih, okur kitlesi, gökyüzü, 12 burç ve tekrar önleme bilgisini içerir', () => {
    const { instructions, prompt } = buildHoroscopeBatchPrompt(base);
    expect(instructions).toBe(HOROSCOPE_INSTRUCTIONS);
    expect(prompt).toContain('Tarih: 24 Eylül 2026 Perşembe.');
    expect(prompt).toContain('Bu yorumlar kadın okurlar için.');
    expect(prompt).toContain('Güneş Terazi burcunda.');
    expect(prompt).toContain('- Koç (koc, 21 Mart – 19 Nisan): cesur, girişken, sabırsız, enerjik');
    expect(prompt).toContain('- Balık (balik, 19 Şubat – 20 Mart)');
    expect(prompt).toContain('23 Eylül Koç: Cesaretin parlıyor — Koç: Bugün sahne senin');
    expect(prompt).toContain('"burclar"');
    expect(prompt).not.toContain('Yalnızca şu burç için yaz');
  });

  it('erkek okur kitlesini ve boş geçmişi yazar', () => {
    const { prompt } = buildHoroscopeBatchPrompt({ ...base, audience: 'erkek', recent: [] });
    expect(prompt).toContain('Bu yorumlar erkek okurlar için.');
    expect(prompt).toContain('Son günlerde yazılmış yorum yok.');
  });
});

describe('talimatlar', () => {
  it('biçim kurallarını ve renk kimliklerini içerir', () => {
    expect(HOROSCOPE_INSTRUCTIONS).toContain('280–420 karakter');
    expect(HOROSCOPE_INSTRUCTIONS).toContain('lila, pudra, bebek-mavisi');
    expect(HOROSCOPE_INSTRUCTIONS).toContain('en fazla 3 Türkçe hashtag');
  });
});

describe('buildHoroscopeSignPrompt', () => {
  it('yalnızca hedef burcu ve düzeltilecek sorunları ister', () => {
    const { prompt } = buildHoroscopeSignPrompt({ ...base, sign: 'aslan', issues: [{ field: 'yorum', message: '280-420 karakter olmalı (şu an 120).' }] });
    expect(prompt).toContain('Yalnızca şu burç için yaz: Aslan (aslan)');
    expect(prompt).toContain('- yorum: 280-420 karakter olmalı (şu an 120).');
    expect(prompt).toContain('{"burc": {');
    expect(prompt).not.toContain('- Koç (koc');
  });
});
