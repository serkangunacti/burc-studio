import { describe, expect, it } from 'vitest';
import { countEmoji, foldTurkish, graphemeLength, looksTurkish } from './turkish';

describe('foldTurkish', () => {
  it.each([
    ['İkizler', 'ikizler'],
    ['IKIZLER', 'ikizler'],
    ['Yengeç Burcu', 'yengecburcu'],
    ['♓ Balık', 'balik'],
    ['ŞÜĞÖÇ', 'sugoc'],
  ])('%s → %s', (input, expected) => {
    expect(foldTurkish(input)).toBe(expected);
  });
});

describe('graphemeLength ve countEmoji', () => {
  it('birleşik emoji ve bayrakları tek karakter sayar', () => {
    const text = 'a👩‍❤️‍👨b🇹🇷';
    expect(text.length).toBe(14);
    expect(graphemeLength(text)).toBe(4);
    expect(countEmoji(text)).toBe(2);
  });

  it('Türkçe harfleri tek karakter sayar', () => {
    expect(graphemeLength('Günaydın')).toBe(8);
    expect(countEmoji('Harika bir gün ✨')).toBe(1);
  });
});

describe('looksTurkish', () => {
  it('Türkçe metni kabul eder, İngilizceyi reddeder', () => {
    expect(looksTurkish('Bugün yıldızlar senden yana, küçük bir sürpriz seni bekliyor.')).toBe(true);
    expect(looksTurkish('Today the stars are with you and your plans will work out with ease.')).toBe(false);
    expect(looksTurkish('Bugun yildizlar senden yana')).toBe(false);
  });
});
