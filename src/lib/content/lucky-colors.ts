import { foldTurkish } from '@/lib/text/turkish';

export const LUCKY_COLORS = [
  { id: 'lila', name: 'Lila', hex: '#C8B6E2' },
  { id: 'pudra', name: 'Pudra Pembe', hex: '#F4C2C2' },
  { id: 'bebek-mavisi', name: 'Bebek Mavisi', hex: '#BFD7ED' },
  { id: 'adacayi', name: 'Adaçayı Yeşili', hex: '#B7C9A8' },
  { id: 'seftali', name: 'Şeftali', hex: '#FFD1B3' },
  { id: 'lavanta', name: 'Lavanta', hex: '#D9C6F0' },
  { id: 'krem', name: 'Krem', hex: '#F6EEDF' },
  { id: 'nane', name: 'Nane Yeşili', hex: '#BEE3D3' },
  { id: 'mercan', name: 'Mercan', hex: '#F7A99C' },
  { id: 'limon', name: 'Limon Sarısı', hex: '#FFF1A8' },
  { id: 'altin', name: 'Altın', hex: '#D9B870' },
  { id: 'gumus', name: 'Gümüş', hex: '#C9CDD2' },
] as const;

export type LuckyColorId = (typeof LUCKY_COLORS)[number]['id'];
export const LUCKY_COLOR_IDS: readonly LuckyColorId[] = LUCKY_COLORS.map((color) => color.id);

export function getLuckyColor(id: LuckyColorId) {
  return LUCKY_COLORS.find((color) => color.id === id)!;
}

export function normalizeLuckyColor(input: string): LuckyColorId | null {
  const folded = foldTurkish(input);
  return LUCKY_COLORS.find((color) => foldTurkish(color.id) === folded || foldTurkish(color.name) === folded)?.id ?? null;
}
