import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleReels } from '@/remotion/fixtures';

const renderMediaOnWeb = vi.hoisted(() => vi.fn());
vi.mock('@remotion/web-renderer', () => ({ renderMediaOnWeb }));
vi.mock('@/remotion/templates', () => ({ getTemplate: () => ({ Reels: () => null, waitForFonts: async () => {} }) }));

const { REELS_STALLED, renderReelsMp4 } = await import('./render-reels');

describe('renderReelsMp4 askıda kalan kodlayıcıyla', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Kodlayıcı askıda kaldığında renderMediaOnWeb iptal sinyaline hiç yanıt vermeden bekler.
    renderMediaOnWeb.mockImplementation(() => new Promise(() => {}));
  });
  afterEach(() => vi.useRealTimers());

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

describe('renderReelsMp4 müzikle', () => {
  beforeEach(() => {
    renderMediaOnWeb.mockReset();
    renderMediaOnWeb.mockResolvedValue({ getBlob: async () => new Blob(['mp4']) });
  });

  it('müzik verilince AAC sesle ve müzik bileşeniyle, verilmezse sessiz üretir', async () => {
    await renderReelsMp4({ templateVersion: 'pastel@1', reels: sampleReels('kadin'), musicSrc: 'blob:muzik' });
    const [withMusic] = renderMediaOnWeb.mock.calls[0];
    expect(withMusic).toMatchObject({ audioCodec: 'aac', muted: false, inputProps: { musicSrc: 'blob:muzik', audience: 'kadin' } });
    await renderReelsMp4({ templateVersion: 'pastel@1', reels: sampleReels('kadin') });
    const [silent] = renderMediaOnWeb.mock.calls[1];
    expect(silent).toMatchObject({ muted: true, inputProps: { musicSrc: null } });
  });
});
