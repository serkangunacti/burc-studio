import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShareFiles } from './deliver';

afterEach(() => vi.unstubAllGlobals());

describe('canShareFiles', () => {
  const files = [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })];

  it('Web Share dosya paylaşımı yoksa false döner', () => {
    vi.stubGlobal('navigator', {});
    expect(canShareFiles(files)).toBe(false);
  });

  it('tarayıcı dosyaları paylaşabiliyorsa true döner', () => {
    vi.stubGlobal('navigator', { share: async () => undefined, canShare: (data: { files?: File[] }) => (data.files?.length ?? 0) > 0 });
    expect(canShareFiles(files)).toBe(true);
    expect(canShareFiles([])).toBe(false);
  });
});
