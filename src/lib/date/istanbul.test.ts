import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatDateLongTr,
  formatDateShortTr,
  isDateKey,
  istanbulDateKey,
  istanbulDayStart,
  istanbulNoon,
} from './istanbul';

describe('istanbulDateKey', () => {
  it("UTC 22:30 İstanbul'da ertesi gündür", () => {
    expect(istanbulDateKey(new Date('2026-09-25T22:30:00Z'))).toBe('2026-09-26');
  });

  it("UTC 20:59 İstanbul'da hâlâ aynı gündür", () => {
    expect(istanbulDateKey(new Date('2026-09-25T20:59:00Z'))).toBe('2026-09-25');
  });
});

describe('isDateKey', () => {
  it.each([
    ['2026-09-26', true],
    ['2026-02-30', false],
    ['26.09.2026', false],
    ['2026-9-26', false],
    [20260926, false],
    [null, false],
  ])('%s → %s', (value, expected) => {
    expect(isDateKey(value)).toBe(expected);
  });
});

describe('addDays', () => {
  it('yıl ve ay sınırlarını aşar', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('İstanbul saatleri', () => {
  it('gün başlangıcı ve öğlen UTC+3 hesaplanır', () => {
    expect(istanbulDayStart('2026-09-26').toISOString()).toBe('2026-09-25T21:00:00.000Z');
    expect(istanbulNoon('2026-09-26').toISOString()).toBe('2026-09-26T09:00:00.000Z');
  });
});

describe('Türkçe tarih biçimleri', () => {
  it('uzun ve kısa biçim', () => {
    expect(formatDateLongTr('2026-09-26')).toBe('26 Eylül 2026 Cumartesi');
    expect(formatDateShortTr('2026-09-26')).toBe('26 Eylül');
  });
});
