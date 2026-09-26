import { REELS_FPS, REELS_SIZE, reelsDurationInFrames } from '@/remotion/reels';
import { withMusic } from '@/remotion/reels-music';
import type { ReelsProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';
import { createStallWatchdog } from './stall-watchdog';

export const REELS_STALLED = 'Video üretimi bir dakikadır ilerlemiyor ve durduruldu. Sayfayı yenileyip tekrar dene.';
const STALL_TIMEOUT_MS = 60_000;
const VIDEO_BITRATE = 5_000_000;

export const REELS_UNSUPPORTED = "Bu tarayıcı video üretemiyor. Bilgisayarda Chrome ya da iPhone'da Safari 26 ve üstünü kullan.";

export type ReelsSupport = { ok: true; music: boolean } | { ok: false; reason: string };

export async function checkReelsSupport(): Promise<ReelsSupport> {
  if (typeof VideoEncoder === 'undefined') return { ok: false, reason: REELS_UNSUPPORTED };
  const { canRenderMediaOnWeb } = await import('@remotion/web-renderer');
  const base = { ...REELS_SIZE, container: 'mp4', videoCodec: 'h264', videoBitrate: VIDEO_BITRATE } as const;
  // Instagram Reels sesi AAC ister; kodlayamayan tarayıcıda video müziksiz üretilir.
  if ((await canRenderMediaOnWeb({ ...base, audioCodec: 'aac', muted: false })).canRender) return { ok: true, music: true };
  const silent = await canRenderMediaOnWeb({ ...base, audioCodec: null, muted: true });
  return silent.canRender ? { ok: true, music: false } : { ok: false, reason: REELS_UNSUPPORTED };
}

export async function renderReelsMp4(input: {
  templateVersion: string;
  reels: ReelsProps;
  musicSrc?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}): Promise<Blob> {
  const { renderMediaOnWeb } = await import('@remotion/web-renderer');
  const template = getTemplate(input.templateVersion);
  const musicSrc = input.musicSrc ?? null;
  const inputProps = { ...input.reels, musicSrc };
  await template.waitForFonts();
  // Kodlayıcı nadiren hiç kare üretmeden askıda kalıyor; kullanıcı "%0"da sonsuza dek beklemesin.
  const controller = new AbortController();
  let stalled = false;
  const watchdog = createStallWatchdog(STALL_TIMEOUT_MS, () => {
    stalled = true;
    controller.abort();
  });
  // Kodlayıcı beklerken renderMediaOnWeb iptal sinyaline bakmıyor; askıda kalan üretimi beklemeden bırakırız.
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      'abort',
      () => reject(stalled ? new Error(REELS_STALLED) : new DOMException('Video üretimi iptal edildi.', 'AbortError')),
      { once: true },
    );
  });
  if (input.signal?.aborted) controller.abort();
  input.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const rendering = renderMediaOnWeb({
      composition: {
        id: 'reels',
        component: withMusic(template.Reels),
        durationInFrames: reelsDurationInFrames(input.reels.signs.length),
        fps: REELS_FPS,
        width: REELS_SIZE.width,
        height: REELS_SIZE.height,
        defaultProps: inputProps,
      },
      inputProps,
      container: 'mp4',
      videoCodec: 'h264',
      // Düşük bit hızında soluklaşarak kaybolan yazı, kodlayıcı blokları atladığı için sonraki sahnede iz bırakıyordu;
      // Instagram'ın önerdiği aralıkta bit hızı ve saniyede bir anahtar kare bu izi siler.
      videoBitrate: VIDEO_BITRATE,
      keyframeIntervalInSeconds: 1,
      ...(musicSrc ? { audioCodec: 'aac' as const, muted: false } : { muted: true }),
      signal: controller.signal,
      onProgress: ({ progress }) => {
        watchdog.progress();
        input.onProgress?.(progress);
      },
      // Tek kişilik, ticari olmayan kullanım Remotion'un ücretsiz lisansına girer (spec §12).
      licenseKey: 'free-license',
    }).then((result) => result.getBlob());
    return await Promise.race([rendering, aborted]);
  } catch (error) {
    if (stalled) throw new Error(REELS_STALLED);
    throw error;
  } finally {
    watchdog.stop();
  }
}
