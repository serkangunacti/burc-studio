import { FORMAT_SIZES, SLIDE_FPS, type SlideProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';

export const JPEG_QUALITY = 0.92;

export async function renderSlideJpeg(templateVersion: string, props: SlideProps, signal?: AbortSignal): Promise<Blob> {
  const { renderStillOnWeb } = await import('@remotion/web-renderer');
  const template = getTemplate(templateVersion);
  await template.waitForFonts();
  const { width, height } = FORMAT_SIZES[props.format];
  const still = await renderStillOnWeb({
    composition: { id: 'slide', component: template.Slide, durationInFrames: 1, fps: SLIDE_FPS, width, height, defaultProps: props },
    inputProps: props,
    frame: 0,
    signal: signal ?? null,
  });
  return still.blob({ format: 'jpeg', quality: JPEG_QUALITY });
}

export async function renderPostImages(input: {
  templateVersion: string;
  slides: readonly SlideProps[];
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}): Promise<Blob[]> {
  const blobs: Blob[] = [];
  for (const props of input.slides) {
    input.signal?.throwIfAborted();
    blobs.push(await renderSlideJpeg(input.templateVersion, props, input.signal));
    input.onProgress?.(blobs.length, input.slides.length);
  }
  return blobs;
}
