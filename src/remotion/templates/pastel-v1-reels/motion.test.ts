import { describe, expect, it } from 'vitest';
import { drawProgress, enter } from './motion';

describe('Reels hareket yardımcıları', () => {
  it('giriş gecikmeden önce görünmez, sonra yerine oturur; konum tam pikseldir', () => {
    expect(enter(0, 30, 10)).toEqual({ opacity: 0, transform: 'translateY(40px)' });
    const settled = enter(60, 30, 10);
    expect(settled.opacity).toBeCloseTo(1, 2);
    expect(settled.transform).toBe('translateY(0px)');
    expect(enter(14, 30, 10).transform).toMatch(/^translateY\(\d+px\)$/);
  });

  it('çizim ilerlemesi 1den 0a iner ve sınırlarda kalır', () => {
    expect(drawProgress(0, 4, 34)).toBe(1);
    expect(drawProgress(19, 4, 34)).toBeCloseTo(0.5, 5);
    expect(drawProgress(80, 4, 34)).toBe(0);
  });
});
