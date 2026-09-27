import { describe, expect, it } from 'vitest';
import { composeAmbient, musicSeed } from './compose';

const pitchClass = (frequency: number, root: number) => ((Math.round(12 * Math.log2(frequency / root)) % 12) + 12) % 12;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PENTATONIC = [0, 2, 4, 7, 9];

describe('composeAmbient', () => {
  it('aynı tohumla aynı eseri, farklı tohumla farklı eseri üretir', () => {
    expect(composeAmbient(7, 59)).toEqual(composeAmbient(7, 59));
    expect(composeAmbient(8, 59).notes).not.toEqual(composeAmbient(7, 59).notes);
  });

  it('bütün notalar gamın içinde ve süre içinde; çanlar pentatonik; en az 8 akor ve 20 çan notası var', () => {
    for (const seed of [1, 2, 3, 20722, 20725]) {
      const score = composeAmbient(seed, 59);
      expect(score.durationSeconds).toBe(59);
      for (const note of score.notes) {
        expect(MAJOR).toContain(pitchClass(note.frequency, score.rootFrequency));
        expect(note.start).toBeGreaterThanOrEqual(0);
        expect(note.start + note.duration).toBeLessThanOrEqual(59);
        expect(note.frequency).toBeGreaterThan(50);
        expect(note.frequency).toBeLessThan(2000);
      }
      const bells = score.notes.filter((note) => note.voice === 'bell');
      expect(bells.every((note) => PENTATONIC.includes(pitchClass(note.frequency, score.rootFrequency)))).toBe(true);
      expect(bells.length).toBeGreaterThanOrEqual(20);
      expect(new Set(score.notes.filter((note) => note.voice === 'pad').map((note) => note.start)).size).toBeGreaterThanOrEqual(8);
    }
  });

  it('aynı anda çalan notaların toplam kazancı 0,8’i aşmaz', () => {
    const score = composeAmbient(20722, 59);
    for (let time = 0; time < 59; time += 0.25) {
      const sum = score.notes.filter((note) => note.start <= time && time < note.start + note.duration).reduce((total, note) => total + note.gain, 0);
      expect(sum).toBeLessThanOrEqual(0.8);
    }
  });

  it('tohum gönderiye özgüdür: kitle, tarih etiketi ve zemin varyantı ayırt eder', () => {
    const daily = { variant: 20724, audience: 'kadin' as const, dateLabel: '27 EYLÜL 2026 PAZAR' };
    expect(musicSeed(daily)).toBe(musicSeed({ ...daily }));
    expect(musicSeed(daily)).not.toBe(musicSeed({ ...daily, audience: 'erkek' }));
    expect(musicSeed(daily)).not.toBe(musicSeed({ ...daily, variant: 20725 }));
    // Pazar günlük ile pazartesi haftalık aynı zemin varyantına denk gelir; müzikleri yine farklı olmalı.
    expect(musicSeed(daily)).not.toBe(musicSeed({ ...daily, dateLabel: '28 EYLÜL – 4 EKİM' }));
  });
});
