import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import type { Renderers } from '@/lib/automation/render-job';
import { REELS_FPS, reelsDurationInFrames } from '@/remotion/reels';
import type { MusicRenderer } from './music';

export type RemotionRenderers = Renderers & { close: () => Promise<void> };

export async function openRemotionRenderers(input: {
  music: MusicRenderer;
  upload: (name: string, file: Buffer) => Promise<string>;
  log: (message: string) => void;
}): Promise<RemotionRenderers> {
  const serveUrl = await bundle({
    entryPoint: path.resolve('src/remotion/index.ts'),
    webpackOverride: (config) => ({
      ...config,
      resolve: { ...config.resolve, alias: { ...(config.resolve?.alias as Record<string, string>), '@': path.resolve('src') } },
    }),
  });
  const browser = await openBrowser('chrome');
  const work = await mkdtemp(path.join(os.tmpdir(), 'kozmik-'));

  return {
    async renderStills(templateVersion, slides) {
      const composition = await selectComposition({ serveUrl, id: 'Post-Slide', inputProps: { templateVersion, props: slides[0] }, puppeteerInstance: browser });
      const images: Uint8Array[] = [];
      for (const props of slides) {
        const inputProps = { templateVersion, props };
        // Bileşen composition.props ile çizilir; seçimde kullanılan ilk slaytın yerine bu slayt verilir.
        const { buffer } = await renderStill({
          serveUrl,
          composition: { ...composition, props: inputProps },
          inputProps,
          imageFormat: 'jpeg',
          jpegQuality: 92,
          puppeteerInstance: browser,
        });
        if (!buffer) throw new Error('Görsel üretilemedi');
        images.push(new Uint8Array(buffer));
      }
      return images;
    },
    async renderReels({ templateVersion, reels, musicSeed, name }) {
      const seconds = reelsDurationInFrames(reels.signs.length) / REELS_FPS;
      const musicFile = `music-${name}.wav`;
      // Paket klasörü sunucuda statik olarak sunulur; müzik staticFile() ile buradan okunur.
      await writeFile(path.join(serveUrl, 'public', musicFile), await input.music.render(musicSeed, seconds));
      const inputProps = { templateVersion, reels, musicFile };
      const composition = await selectComposition({ serveUrl, id: 'Post-Reels', inputProps, puppeteerInstance: browser });
      const output = path.join(work, `${name}.mp4`);
      const started = Date.now();
      await renderMedia({
        serveUrl,
        composition,
        inputProps,
        codec: 'h264',
        audioCodec: 'aac',
        crf: 18,
        pixelFormat: 'yuv420p',
        outputLocation: output,
        puppeteerInstance: browser,
      });
      const file = await readFile(output);
      input.log(`${name}.mp4: ${(file.length / 1e6).toFixed(1)} MB, ${Math.round((Date.now() - started) / 1000)} sn`);
      return input.upload(`${name}.mp4`, file);
    },
    async close() {
      await browser.close({ silent: true });
      await rm(work, { recursive: true, force: true });
    },
  };
}
