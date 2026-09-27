import { describe, expect, it } from 'vitest';
import { getSkySnapshot } from '@/lib/astro/sky';
import { getTarotCard } from '@/lib/tarot/deck';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import { TAROT_INSTRUCTIONS, buildTarotBatchPrompt, buildTarotSignPrompt } from './tarot-prompt';

const cards = new Map(SIGN_SLUGS.map((sign, index) => [sign, getTarotCard(index === 0 ? 'olum' : 'kupa-as')]));
const base = { dateKey: '2026-09-27', audience: 'kadin' as const, sky: getSkySnapshot('2026-09-27'), cards, recent: [] };

describe('tarot promptu', () => {
  it('her burcun günün kartını anlamıyla verir; kartın adının yorumda anılmasını ister', () => {
    const { instructions, prompt } = buildTarotBatchPrompt(base);
    expect(instructions).toBe(TAROT_INSTRUCTIONS);
    expect(prompt).toContain('GÜNLÜK TAROT');
    expect(prompt).toContain('Bu yorumlar kadın okurlar için.');
    expect(prompt).toContain('- Koç (koc, 21 Mart – 19 Nisan): cesur, girişken, sabırsız, enerjik — günün kartı: Ölüm (dönüşüm, bir dönemin kapanması, yenilenme, bırakma)');
    expect(TAROT_INSTRUCTIONS).toContain('kartın adını yorumda doğal biçimde an');
    expect(TAROT_INSTRUCTIONS).toContain('280–420 karakter');
    expect(TAROT_INSTRUCTIONS).toContain('korkutucu');
  });

  it('tek burç promptu yalnız o burcu ve kartını ister', () => {
    const { prompt } = buildTarotSignPrompt({ ...base, sign: 'koc', issues: [] });
    expect(prompt).toContain('Yalnızca şu burç için yaz: Koç (koc)');
    expect(prompt).toContain('günün kartı: Ölüm');
    expect(prompt).not.toContain('- Boğa (boga');
  });
});
