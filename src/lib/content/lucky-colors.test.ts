import { describe, expect, it } from 'vitest';
import { LUCKY_COLOR_IDS, getLuckyColor, normalizeLuckyColor } from './lucky-colors';

describe('şanslı renkler', () => {
  it('12 pastel renk tanımlıdır', () => {
    expect(LUCKY_COLOR_IDS).toHaveLength(12);
    expect(getLuckyColor('lila')).toEqual({ id: 'lila', name: 'Lila', hex: '#C8B6E2' });
  });

  it.each([
    ['lila', 'lila'],
    ['Pudra Pembe', 'pudra'],
    ['BEBEK MAVİSİ', 'bebek-mavisi'],
    ['adaçayı yeşili', 'adacayi'],
    ['mor', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLuckyColor(input)).toBe(expected);
  });
});
