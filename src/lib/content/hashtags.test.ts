import { describe, expect, it } from 'vitest';
import { mergeHashtags, normalizeHashtag } from './hashtags';

describe('normalizeHashtag', () => {
  it.each([
    ['#İkizler Burcu', '#ikizlerburcu'],
    ['Günlük Burç', '#günlükburç'],
    ['##Astroloji!', '#astroloji'],
    ['###', null],
    ['   ', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeHashtag(input)).toBe(expected);
  });
});

describe('mergeHashtags', () => {
  it('temel etiketler önce gelir, tekrar yok, en fazla 5', () => {
    expect(mergeHashtags(['#burç', '#astroloji'], ['#Burç', '#günlükburç', '#terazi', '#dolunay', '#ekstra'])).toEqual([
      '#burç', '#astroloji', '#günlükburç', '#terazi', '#dolunay',
    ]);
  });
});
