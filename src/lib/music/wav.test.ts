import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav';

describe('encodeWav', () => {
  it('16 bit stereo PCM WAV başlığı yazar, örnekleri serpiştirir ve taşan değerleri kırpar', () => {
    const left = new Float32Array([0, 1, -1, 2]);
    const right = new Float32Array([0.5, -0.5, 0, -2]);
    const view = new DataView(encodeWav([left, right], 44_100));
    const text = (offset: number) => String.fromCharCode(...new Uint8Array(view.buffer, offset, 4));
    expect([text(0), text(8), text(12), text(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(view.getUint32(4, true)).toBe(36 + 16);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44_100);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(16);
    const samples = Array.from({ length: 8 }, (_, index) => view.getInt16(44 + index * 2, true));
    expect(samples).toEqual([0, 16384, 32767, -16384, -32768, 0, 32767, -32768]);
  });
});
