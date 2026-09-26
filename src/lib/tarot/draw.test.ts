import { describe, expect, it } from 'vitest';
import { TAROT_DECK } from './deck';
import { drawCards } from './draw';

describe('drawCards', () => {
  it('istenen sayıda, tekrarsız kart çeker', () => {
    for (let run = 0; run < 50; run++) {
      const cards = drawCards(12);
      expect(cards).toHaveLength(12);
      expect(new Set(cards.map((card) => card.id)).size).toBe(12);
    }
  });

  it('karıştırma verilen rastgele kaynağı kullanır (Fisher–Yates)', () => {
    expect(drawCards(3, () => 0).map((card) => card.id)).toEqual([TAROT_DECK[1].id, TAROT_DECK[2].id, TAROT_DECK[3].id]);
  });
});
