import type { SignSlug } from '@/lib/zodiac/signs';

// 100×100 kutuda tek çizgi (stroke) burç sembolleri.
export const ZODIAC_PATHS: Record<SignSlug, string> = {
  koc: 'M50 88 V42 M50 42 C50 22 38 12 27 14 C16 16 12 28 16 36 C19 43 26 44 30 40 M50 42 C50 22 62 12 73 14 C84 16 88 28 84 36 C81 43 74 44 70 40',
  boga: 'M28 64 A22 22 0 1 0 72 64 A22 22 0 1 0 28 64 M16 18 C20 36 34 42 50 42 C66 42 80 36 84 18',
  ikizler: 'M20 16 C36 23 64 23 80 16 M20 84 C36 77 64 77 80 84 M38 20 V80 M62 20 V80',
  yengec: 'M84 34 C72 18 42 16 22 32 M22 40 A10 10 0 1 0 42 40 A10 10 0 1 0 22 40 M16 66 C28 82 58 84 78 68 M58 60 A10 10 0 1 0 78 60 A10 10 0 1 0 58 60',
  aslan: 'M17 62 A13 13 0 1 0 43 62 A13 13 0 1 0 17 62 M40 52 C34 36 38 16 56 14 C74 12 80 30 72 46 C64 62 62 76 70 84 C76 90 84 86 86 80',
  basak: 'M12 30 C16 22 24 22 24 34 V78 M24 36 C24 22 42 22 42 34 V78 M42 36 C42 22 60 22 60 34 V66 C60 82 72 88 82 78 M60 56 C68 42 86 46 84 60 C82 72 68 78 56 88',
  terazi: 'M14 80 H86 M14 64 H34 C26 56 26 36 38 28 C46 22 54 22 62 28 C74 36 74 56 66 64 H86',
  akrep: 'M10 30 C14 22 22 22 22 34 V76 M22 36 C22 22 40 22 40 34 V76 M40 36 C40 22 58 22 58 34 V70 C58 82 66 86 78 84 L90 80 M82 72 L90 80 L82 88',
  yay: 'M18 84 L84 18 M56 18 H84 V46 M30 50 L52 72',
  oglak: 'M12 28 L26 70 L38 28 C42 18 56 18 58 34 V64 C58 80 70 86 80 80 C90 74 88 58 78 56 C68 54 62 64 60 74 C58 84 50 90 42 88',
  kova: 'M10 42 L23 32 L36 42 L49 32 L62 42 L75 32 L90 42 M10 68 L23 58 L36 68 L49 58 L62 68 L75 58 L90 68',
  balik: 'M24 14 C44 34 44 66 24 86 M76 14 C56 34 56 66 76 86 M26 50 H74',
};

export function ZodiacGlyph({ sign, size, color, strokeWidth }: { sign: SignSlug; size: number; color: string; strokeWidth: number }) {
  return (
    <svg
      data-sign={sign}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ZODIAC_PATHS[sign]} />
    </svg>
  );
}
