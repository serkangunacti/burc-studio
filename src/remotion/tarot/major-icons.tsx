import { circle } from './symbols';

const r = (value: number) => Math.round(value * 10) / 10;

function star(cx: number, cy: number, points: number, outer: number, inner: number): string {
  const corners = Array.from({ length: points * 2 }, (_, index) => {
    const angle = (index * Math.PI) / points - Math.PI / 2;
    const radius = index % 2 === 0 ? outer : inner;
    return `${r(cx + Math.cos(angle) * radius)} ${r(cy + Math.sin(angle) * radius)}`;
  });
  return `M${corners.join(' L')} Z`;
}

function rays(cx: number, cy: number, count: number, from: number, to: (index: number) => number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index * 2 * Math.PI) / count - Math.PI / 2;
    const end = to(index);
    return `M${r(cx + Math.cos(angle) * from)} ${r(cy + Math.sin(angle) * from)} L${r(cx + Math.cos(angle) * end)} ${r(cy + Math.sin(angle) * end)}`;
  });
}

const SPARK = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy - s} C${r(cx + s * 0.12)} ${r(cy - s * 0.12)} ${r(cx + s * 0.12)} ${r(cy - s * 0.12)} ${cx + s} ${cy} C${r(cx + s * 0.12)} ${r(cy + s * 0.12)} ${r(cx + s * 0.12)} ${r(cy + s * 0.12)} ${cx} ${cy + s} C${r(cx - s * 0.12)} ${r(cy + s * 0.12)} ${r(cx - s * 0.12)} ${r(cy + s * 0.12)} ${cx - s} ${cy} C${r(cx - s * 0.12)} ${r(cy - s * 0.12)} ${r(cx - s * 0.12)} ${r(cy - s * 0.12)} ${cx} ${cy - s} Z`;

// 100×100 kutuda Büyük Arkana ikonları; burç sembolleriyle aynı tek çizgi stili.
export const MAJOR_ICONS: Record<string, string[]> = {
  deli: ['M28 86 C34 60 50 36 76 14 C82 34 72 58 46 72 C40 76 34 80 28 86 Z', 'M28 86 L62 38', 'M44 64 L34 60', 'M52 52 L44 46', 'M60 42 L54 34', SPARK(78, 72, 8)],
  buyucu: ['M18 32 C18 18 36 18 50 32 C64 46 82 46 82 32 C82 18 64 18 50 32 C36 46 18 46 18 32 Z', 'M50 52 V90', 'M42 56 H58', SPARK(50, 52, 6)],
  basrahibe: ['M20 18 V86', 'M32 18 V86', 'M68 18 V86', 'M80 18 V86', 'M16 18 H36', 'M64 18 H84', 'M16 86 H36', 'M64 86 H84', 'M56 38 A13 13 0 1 0 56 64 A10 10 0 1 1 56 38 Z'],
  imparatorice: [circle(50, 34, 18), 'M50 52 V88', 'M38 72 H62', 'M26 88 C28 76 34 68 44 66', 'M74 88 C72 76 66 68 56 66'],
  imparator: ['M28 46 H72 V86 H28 Z', 'M28 46 C18 38 16 22 28 18 C38 16 40 28 34 32', 'M72 46 C82 38 84 22 72 18 C62 16 60 28 66 32', 'M40 62 H60', 'M40 74 H60'],
  basrahip: ['M26 82 L66 42', 'M74 82 L34 42', circle(72, 32, 10), circle(28, 32, 10), 'M34 74 L40 80', 'M40 68 L46 74', 'M66 74 L60 80', 'M60 68 L54 74'],
  asiklar: [circle(38, 60, 20), circle(62, 60, 20), 'M50 30 C44 20 32 24 36 32 L50 44 L64 32 C68 24 56 20 50 30 Z'],
  'savas-arabasi': [circle(30, 70, 14), circle(70, 70, 14), 'M14 52 H86', 'M30 70 V52', 'M70 70 V52', star(50, 28, 5, 12, 5)],
  guc: ['M30 20 C30 10 42 10 50 20 C58 30 70 30 70 20 C70 10 58 10 50 20 C42 30 30 30 30 20 Z', 'M34 76 C34 62 66 62 66 76 C66 88 34 88 34 76 Z', circle(28, 56, 6), circle(42, 46, 6), circle(58, 46, 6), circle(72, 56, 6)],
  ermis: ['M38 34 H62 L66 44 V74 H34 V44 Z', 'M44 24 H56 V34', 'M50 14 V24', 'M34 74 L40 84 H60 L66 74', SPARK(50, 58, 9)],
  'kader-carki': [circle(50, 50, 36), circle(50, 50, 10), ...rays(50, 50, 8, 10, () => 36)],
  adalet: ['M50 14 V86', 'M34 86 H66', 'M16 30 H84', 'M16 30 L8 56', 'M16 30 L26 56', 'M84 30 L74 56', 'M84 30 L94 56', 'M6 56 C10 66 24 66 28 56 Z', 'M72 56 C76 66 90 66 94 56 Z', circle(50, 14, 3)],
  'asilan-adam': ['M26 28 H74 L50 70 Z', 'M50 70 V90', 'M50 10 V28', 'M38 16 H62', circle(50, 46, 6)],
  olum: ['M50 40 C40 40 38 28 50 24 C62 20 66 36 56 42 C48 46 42 38 48 34', 'M34 32 C30 50 44 58 50 58 C56 58 70 50 66 32', 'M50 58 V90', 'M50 70 L40 64', 'M50 80 L60 74', 'M44 76 L40 80', 'M56 66 L60 62'],
  olculuk: ['M14 28 H40 C40 44 34 50 27 50 C20 50 14 44 14 28 Z', 'M27 50 V60', 'M20 62 H34', 'M60 48 H86 C86 64 80 70 73 70 C66 70 60 64 60 48 Z', 'M73 70 V80', 'M66 82 H80', 'M40 34 C52 34 58 40 62 48'],
  seytan: ['M8 50 A14 10 0 1 0 36 50 A14 10 0 1 0 8 50', 'M36 50 A14 10 0 1 0 64 50 A14 10 0 1 0 36 50', 'M64 50 A14 10 0 1 0 92 50 A14 10 0 1 0 64 50', 'M50 22 V36', 'M50 64 V78'],
  kule: ['M36 88 V38 H64 V88', 'M32 38 H68', 'M34 38 V26 H42 V32 H48 V26 H52 V32 H58 V26 H66 V38', 'M46 58 H54 V70 H46 Z', 'M28 88 H72', 'M84 8 L70 30 H80 L64 52'],
  yildiz: [star(50, 44, 8, 30, 12), SPARK(18, 80, 6), SPARK(82, 82, 6), SPARK(50, 88, 5), SPARK(18, 18, 5)],
  ay: ['M58 16 A34 34 0 1 0 58 84 A27 27 0 1 1 58 16 Z', 'M80 56 C76 63 76 67 80 69 C84 67 84 63 80 56 Z', 'M72 76 C69 81 69 84 72 85 C75 84 75 81 72 76 Z'],
  gunes: [circle(50, 50, 18), ...rays(50, 50, 12, 24, (index) => (index % 2 === 0 ? 40 : 32))],
  yargi: ['M24 74 L68 44', 'M68 44 L80 30 L86 54 Z', 'M20 42 C26 24 42 18 54 22 C46 26 42 34 42 42', 'M20 42 C28 48 36 48 42 42', 'M18 60 C22 52 30 50 36 52'],
  dunya: ['M50 14 A24 36 0 1 0 50 86 A24 36 0 1 0 50 14', 'M26 42 L20 38', 'M26 58 L20 62', 'M74 42 L80 38', 'M74 58 L80 62', circle(14, 14, 4), circle(86, 14, 4), circle(14, 86, 4), circle(86, 86, 4)],
};
