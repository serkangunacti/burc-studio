import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleReels } from '@/remotion/fixtures';

// Kodlayıcı askıda kaldığında renderMediaOnWeb iptal sinyaline hiç yanıt vermeden bekler.
vi.mock('@remotion/web-renderer', () => ({ renderMediaOnWeb: () => new Promise(() => {}) }));
vi.mock('@/remotion/templates', () => ({ getTemplate: () => ({ Reels: () => null, waitForFonts: async () => {} }) }));

const { REELS_STALLED, renderReelsMp4 } = await import('./render-reels');

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('renderReelsMp4 askıda kalan kodlayıcıyla', () => {
  it('kullanıcı iptal edince bekleme sona erer', async () => {
    const controller = new AbortController();
    const rendering = renderReelsMp4({ templateVersion: 'pastel@1', reels: sampleReels('kadin'), signal: controller.signal });
    const settled = expect(rendering).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    await settled;
  });

  it('bir dakika ilerleme olmazsa sayfayı yenilemeyi öneren hatayla biter', async () => {
    const rendering = renderReelsMp4({ templateVersion: 'pastel@1', reels: sampleReels('erkek') });
    const settled = expect(rendering).rejects.toThrow(REELS_STALLED);
    await vi.advanceTimersByTimeAsync(60_000);
    await settled;
    expect(REELS_STALLED).toContain('Sayfayı yenile');
  });
});
