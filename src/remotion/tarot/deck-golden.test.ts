import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TAROT_DECK } from '@/lib/tarot/deck';
import { TarotCardArt } from './tarot-card';

// Arşivdeki tarot gönderileri bu çizimlerle yeniden üretilir; bir ikon, pip düzeni ya da saray işareti değişirse
// eski gönderiler farklı görünür. Görünüm değişikliği yeni bir tasarım sürümüyle yapılır.
const GOLDEN = 'f0d755bfa78591a77eaa1df9470fcd0a705d60498928e7d2ca16970b2b5ab2b3';

describe('78 kartlık deste çizimi', () => {
  it('her kart aynı işaretlemeyle çizilir', () => {
    const markup = TAROT_DECK.map((card) => renderToStaticMarkup(createElement(TarotCardArt, { cardId: card.id, width: 300 }))).join('\n');
    expect(createHash('sha256').update(markup).digest('hex')).toBe(GOLDEN);
  });
});
