import type { TarotSuit } from '@/lib/tarot/deck';

export const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy}`;

// 100×100 kutuda tek çizgi takım sembolleri.
export const SUIT_PATHS: Record<TarotSuit, string[]> = {
  kupa: ['M26 20 H74 C74 46 64 60 50 62 C36 60 26 46 26 20 Z', 'M50 62 V80', 'M34 84 H66', 'M32 32 H68'],
  degnek: ['M50 92 V8', 'M50 30 C58 20 70 22 70 32 C62 36 54 36 50 30 Z', 'M50 58 C42 48 30 50 30 60 C38 64 46 64 50 58 Z', 'M44 8 H56'],
  kilic: ['M50 8 L57 22 V64 H43 V22 Z', 'M30 64 H70', 'M50 64 V86', 'M42 90 H58'],
  tilsim: [circle(50, 50, 38), 'M50 22 L57 42 L78 42 L61 54 L67 75 L50 63 L33 75 L39 54 L22 42 L43 42 Z'],
};

export const COURT_RANKS = ['prens', 'sovalye', 'kralice', 'kral'] as const;
export type CourtRank = (typeof COURT_RANKS)[number];

// Saray işaretleri: prens tüy kalem, şövalye kalkan, kraliçe yuvarlak taç, kral sivri taç.
export const COURT_PATHS: Record<CourtRank, string[]> = {
  prens: ['M30 84 C36 56 56 30 80 16 C74 42 58 62 30 84 Z', 'M30 84 L20 94', 'M46 64 L58 52'],
  sovalye: ['M50 12 L82 24 V48 C82 68 68 82 50 90 C32 82 18 68 18 48 V24 Z', 'M50 30 V72', 'M34 46 H66'],
  kralice: ['M18 74 H82', 'M20 74 L16 38 L36 54 L50 30 L64 54 L84 38 L80 74', circle(16, 34, 4), circle(50, 26, 4), circle(84, 34, 4)],
  kral: ['M18 76 H82 L86 34 L68 52 L50 24 L32 52 L14 34 Z', 'M50 24 V10', 'M44 16 H56'],
};

export function Glyph({ paths, size, color, strokePx }: { paths: readonly string[]; size: number; color: string; strokePx: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth={Math.round((strokePx * 1000) / size) / 10} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
