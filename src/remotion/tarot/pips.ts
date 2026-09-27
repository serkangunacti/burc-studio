export type Pip = { x: number; y: number; flip: boolean };

// İskambil düzeni (100×100 kutu): iki yan sütun ve orta sütun; alt yarıdaki pipler ters durur.
const LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[50, 20], [50, 80]],
  3: [[50, 20], [50, 50], [50, 80]],
  4: [[30, 20], [70, 20], [30, 80], [70, 80]],
  5: [[30, 20], [70, 20], [50, 50], [30, 80], [70, 80]],
  6: [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]],
  7: [[30, 20], [70, 20], [50, 35], [30, 50], [70, 50], [30, 80], [70, 80]],
  8: [[30, 20], [70, 20], [50, 35], [30, 50], [70, 50], [50, 65], [30, 80], [70, 80]],
  9: [[30, 15], [70, 15], [30, 38], [70, 38], [50, 50], [30, 62], [70, 62], [30, 85], [70, 85]],
  10: [[30, 15], [70, 15], [50, 27], [30, 38], [70, 38], [30, 62], [70, 62], [50, 73], [30, 85], [70, 85]],
};

export function pipLayout(count: number): Pip[] {
  const layout = LAYOUTS[count];
  if (!layout) throw new Error(`Pip sayısı 1–10 olmalı: ${count}`);
  return layout.map(([x, y]) => ({ x, y, flip: y > 50 }));
}
