import { describe, expect, it } from 'vitest';
import { getTarotCard } from '@/lib/tarot/deck';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import { HOROSCOPE_SPEC, WEEKLY_SPEC } from './generation-spec';

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
