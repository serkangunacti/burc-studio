import { describe, expect, it } from 'vitest';
import { SIGN_SLUGS, SIGNS, getSign, normalizeSignName, signFromLongitude } from './signs';

describe('burç verisi', () => {
  it('12 burç doğru sırada tanımlıdır', () => {
    expect(SIGNS.map((s) => s.slug)).toEqual([...SIGN_SLUGS]);
    expect(getSign('ikizler')).toMatchObject({ name: 'İkizler', element: 'hava' });
  });
});

describe('signFromLongitude', () => {
  it.each([
    [0, 'koc'],
    [29.99, 'koc'],
    [30, 'boga'],
    [180.36, 'terazi'],
    [359.9, 'balik'],
    [-1, 'balik'],
    [360, 'koc'],
  ])('%s° → %s', (longitude, expected) => {
    expect(signFromLongitude(longitude)).toBe(expected);
  });
});

describe('normalizeSignName', () => {
  it.each([
    ['Koç', 'koc'],
    ['KOÇ', 'koc'],
    ['İkizler', 'ikizler'],
    ['IKIZLER', 'ikizler'],
    ['Yengeç Burcu', 'yengec'],
    ['♓ Balık', 'balik'],
    ['oglak', 'oglak'],
    ['Aries', 'koc'],
    ['Pisces', 'balik'],
    ['Ejderha', null],
    ['', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeSignName(input)).toBe(expected);
  });
});
