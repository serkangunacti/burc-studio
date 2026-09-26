import { describe, expect, it } from 'vitest';
import { TAROT_DECK, getTarotCard } from './deck';

describe('tarot destesi', () => {
  it('22 büyük ve 56 küçük arkanadan oluşan, kimlikleri tekil 78 kart içerir', () => {
    expect(TAROT_DECK).toHaveLength(78);
    expect(new Set(TAROT_DECK.map((card) => card.id)).size).toBe(78);
    expect(TAROT_DECK.filter((card) => card.arcana === 'buyuk')).toHaveLength(22);
    expect(TAROT_DECK.filter((card) => card.suit === 'kupa')).toHaveLength(14);
  });

  it('Türkçe adları ve anahtar kelimeleri verir', () => {
    expect(getTarotCard('yildiz')).toMatchObject({ name: 'Yıldız', arcana: 'buyuk' });
    expect(getTarotCard('kupa-as').name).toBe('Kupa Ası');
    expect(getTarotCard('tilsim-kralice').name).toBe('Tılsım Kraliçesi');
    expect(getTarotCard('kilic-10').keywords).toContain('tamamlanma');
    expect(() => getTarotCard('yok')).toThrow('Bilinmeyen tarot kartı: yok');
  });
});
