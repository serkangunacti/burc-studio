import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildZip } from './zip';

describe('buildZip', () => {
  it('dosyaları adlarıyla ve içerikleriyle paketler', () => {
    const files = unzipSync(
      buildZip([
        { name: 'a.jpg', data: new Uint8Array([1, 2, 3]) },
        { name: 'caption.txt', data: new TextEncoder().encode('Merhaba ğüşıöç') },
      ]),
    );
    expect(Object.keys(files)).toEqual(['a.jpg', 'caption.txt']);
    expect([...files['a.jpg']]).toEqual([1, 2, 3]);
    expect(new TextDecoder().decode(files['caption.txt'])).toBe('Merhaba ğüşıöç');
  });

  it('aynı adlı iki dosyayı reddeder', () => {
    const entry = { name: 'a.jpg', data: new Uint8Array([1]) };
    expect(() => buildZip([entry, entry])).toThrow('Aynı adlı iki dosya: a.jpg');
  });
});
