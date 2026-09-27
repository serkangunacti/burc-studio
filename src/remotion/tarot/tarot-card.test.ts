import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TAROT_DECK } from '@/lib/tarot/deck';
import { pipLayout } from './pips';
import { ROMAN, TarotCardArt } from './tarot-card';

const art = (id: string) => renderToStaticMarkup(createElement(TarotCardArt, { cardId: id, width: 300 }));

describe('tarot tasarım sistemi', () => {
  it('pip yerleşimi 1–10 için doğru sayıda, kutu içinde ve alt yarısı ters pip verir', () => {
    for (let count = 1; count <= 10; count++) {
      const pips = pipLayout(count);
      expect(pips).toHaveLength(count);
      expect(pips.every((pip) => pip.x > 10 && pip.x < 90 && pip.y > 5 && pip.y < 95)).toBe(true);
      expect(pips.every((pip) => pip.flip === pip.y > 50)).toBe(true);
    }
  });

  it('78 kartın her biri çizilir; etiket, ad ve motif türü doğru', () => {
    for (const card of TAROT_DECK) {
      const html = art(card.id);
      expect(html).toContain(card.name.toLocaleUpperCase('tr-TR'));
      expect(html).toContain(`data-card="${card.id}"`);
    }
    expect(art('yildiz')).toContain('>XVII<');
    expect(art('deli')).toContain('>0<');
    expect(art('kupa-7').split('data-pip=').length - 1).toBe(7);
    expect(art('tilsim-kralice')).toContain('data-court="kralice"');
    expect(art('kilic-as')).toContain('>AS<');
    expect(ROMAN[21]).toBe('XXI');
  });

  it('büyük arkananın 22 ikonu birbirinden farklıdır', () => {
    const icons = TAROT_DECK.filter((card) => card.arcana === 'buyuk').map((card) => art(card.id).match(/data-icon="[^"]+"[\s\S]*?<\/svg>/)?.[0]?.replace(/data-icon="[^"]+"/, ''));
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(22);
  });
});
