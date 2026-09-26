import { REELS_FPS, REELS_SIZE, reelsDurationInFrames } from '@/remotion/reels';
import type { ReelsProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';
import { createStallWatchdog } from './stall-watchdog';

export const REELS_STALLED = 'Video üretimi bir dakikadır ilerlemiyor ve durduruldu. Sekmeyi açık tutup tekrar dene.';
const STALL_TIMEOUT_MS = 60_000;

export const REELS_UNSUPPORTED = "Bu tarayıcı video üretemiyor. Bilgisayarda Chrome ya da iPhone'da Safari 26 ve üstünü kullan.";

export async function checkReelsSupport(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof VideoEncoder === 'undefined') return { ok: false, reason: REELS_UNSUPPORTED };
  const { canRenderMediaOnWeb } = await import('@remotion/web-renderer');
  const result = await canRenderMediaOnWeb({ ...REELS_SIZE, container: 'mp4', videoCodec: 'h264', audioCodec: null, muted: true });
  return result.canRender ? { ok: true } : { ok: false, reason: REELS_UNSUPPORTED };
}

export async function renderReelsMp4(input: {
  templateVersion: string;
  reels: ReelsProps;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}): Promise<Blob> {
  const { renderMediaOnWeb } = await import('@remotion/web-renderer');
  const template = getTemplate(input.templateVersion);
  await template.waitForFonts();
  // Kodlayıcı nadiren hiç kare üretmeden askıda kalıyor; kullanıcı "%0"da sonsuza dek beklemesin.
  const controller = new AbortController();
  let stalled = false;
  const watchdog = createStallWatchdog(STALL_TIMEOUT_MS, () => {
    stalled = true;
    controller.abort();
  });
  if (input.signal?.aborted) controller.abort();
  input.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const result = await renderMediaOnWeb({
      composition: {
        id: 'reels',
        component: template.Reels,
        durationInFrames: reelsDurationInFrames(input.reels.signs.length),
        fps: REELS_FPS,
        width: REELS_SIZE.width,
        height: REELS_SIZE.height,
        defaultProps: input.reels,
      },
      inputProps: input.reels,
      container: 'mp4',
      videoCodec: 'h264',
      // Düşük bit hızında soluklaşarak kaybolan yazı, kodlayıcı blokları atladığı için sonraki sahnede iz bırakıyordu;
      // Instagram'ın önerdiği aralıkta bit hızı ve saniyede bir anahtar kare bu izi siler.
      videoBitrate: 5_000_000,
      keyframeIntervalInSeconds: 1,
      muted: true,
      signal: controller.signal,
      onProgress: ({ progress }) => {
        watchdog.progress();
        input.onProgress?.(progress);
      },
      // Tek kişilik, ticari olmayan kullanım Remotion'un ücretsiz lisansına girer (spec §12).
      licenseKey: 'free-license',
    });
    return await result.getBlob();
  } catch (error) {
    if (stalled) throw new Error(REELS_STALLED);
    throw error;
  } finally {
    watchdog.stop();
  }
}
