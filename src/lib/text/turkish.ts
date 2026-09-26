const segmenter = new Intl.Segmenter('tr', { granularity: 'grapheme' });
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;
const ENGLISH_WORDS = /\b(the|and|you|your|today|will|with|this|that)\b/gi;

export function foldTurkish(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşüâîû]/g, (char) => FOLD[char])
    .replace(/[^a-z]/g, '');
}

export function graphemeLength(text: string): number {
  let count = 0;
  for (const _ of segmenter.segment(text)) count++;
  return count;
}

export function countEmoji(text: string): number {
  let count = 0;
  for (const { segment } of segmenter.segment(text)) if (EMOJI.test(segment)) count++;
  return count;
}

export function looksTurkish(text: string): boolean {
  return TURKISH_LETTERS.test(text) && (text.match(ENGLISH_WORDS)?.length ?? 0) < 3;
}
