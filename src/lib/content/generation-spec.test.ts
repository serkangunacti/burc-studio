import { describe, expect, it } from 'vitest';
import { getTarotCard } from '@/lib/tarot/deck';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import { HOROSCOPE_SPEC, TAROT_SPEC, WEEKLY_SPEC, specFor } from './generation-spec';

describe('haftalık yasaklı ifadeler', () => {
  it('her burç için "tarot" ile çok sözcüklü ya da kendine özgü kart adını yasaklar; günlükte yasak yoktur', () => {
    const context = WEEKLY_SPEC.context({ date: '2026-09-28', audience: 'kadin', recent: [] });
    for (const sign of SIGN_SLUGS) {
      const card = getTarotCard(context.tarotCardId(sign)!);
      const expected = card.name.includes(' ') || ['Büyücü', 'Başrahibe', 'İmparatoriçe', 'İmparator', 'Başrahip'].includes(card.name) ? ['tarot', card.name] : ['tarot'];
      expect(context.forbidden?.(sign)).toEqual(expected);
    }
    const kept = WEEKLY_SPEC.context({ date: '2026-09-28', audience: 'kadin', recent: [], keptCards: new Map([['koc', 'yildiz'], ['boga', 'kupa-as']]) });
    expect(kept.forbidden?.('koc')).toEqual(['tarot']);
    expect(kept.forbidden?.('boga')).toEqual(['tarot', 'Kupa Ası']);
    expect(HOROSCOPE_SPEC.context({ date: '2026-09-26', audience: 'kadin', recent: [] }).forbidden).toBeUndefined();
  });
});

describe('kart atama', () => {
  it('tarot bağlamında 12 burca birbirinden farklı kart düşer; tarotta yasaklı ifade yoktur', () => {
    const context = TAROT_SPEC.context({ date: '2026-09-27', audience: 'erkek', recent: [] });
    expect(new Set(SIGN_SLUGS.map((sign) => context.tarotCardId(sign))).size).toBe(12);
    expect(context.forbidden).toBeUndefined();
    expect(specFor('tarot')).toBe(TAROT_SPEC);
    expect(TAROT_SPEC).toMatchObject({ kind: 'tarot', templateVersion: 'pastel-tarot@2', promptVersion: 'tarot-v2', chunkSize: 12 });
  });

  it('yalnız bir burç yeniden çekilirken yeni kart tutulan 11 kartla çakışmaz (tarot ve haftalık)', () => {
    for (const spec of [TAROT_SPEC, WEEKLY_SPEC]) {
      const first = spec.context({ date: '2026-09-28', audience: 'kadin', recent: [] });
      const kept = new Map(SIGN_SLUGS.filter((sign) => sign !== 'aslan').map((sign) => [sign, first.tarotCardId(sign)!]));
      for (let run = 0; run < 100; run++) {
        const next = spec.context({ date: '2026-09-28', audience: 'kadin', recent: [], keptCards: kept });
        expect([...kept.values()]).not.toContain(next.tarotCardId('aslan'));
        expect(next.tarotCardId('koc')).toBe(kept.get('koc'));
      }
    }
  });

  it('kartı yeniden çekilen burca eski kartı da gelmez', () => {
    const first = TAROT_SPEC.context({ date: '2026-09-27', audience: 'kadin', recent: [] });
    const kept = new Map(SIGN_SLUGS.filter((sign) => sign !== 'aslan').map((sign) => [sign, first.tarotCardId(sign)!]));
    const old = first.tarotCardId('aslan')!;
    for (let run = 0; run < 300; run++) {
      const next = TAROT_SPEC.context({ date: '2026-09-27', audience: 'kadin', recent: [], keptCards: kept, avoidCards: new Set([old]) });
      expect(next.tarotCardId('aslan')).not.toBe(old);
    }
  });
});
