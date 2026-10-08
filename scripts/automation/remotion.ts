import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import type { Renderers } from '@/lib/automation/render-job';
import { REELS_FPS, reelsDurationInFrames } from '@/remotion/reels';
import type { MusicRenderer } from './music';
import type { ReelsProps } from '@/remotion/slide-types';
import {fullNarrationTiming,reelsFrameRanges,type ReelsVoice} from '@/remotion/voice';
import type {FullNarration} from './full-narration';
import {MAX_REELS_SECONDS} from '@/remotion/reels';
import {probeVideoDuration} from './video-duration';

export type RemotionRenderers = Renderers & { close: () => Promise<void> };

export async function openRemotionRenderers(input: {
  music: MusicRenderer;
  upload: (name: string, file: Buffer) => Promise<string>;
  log: (message: string) => void;
  narrateFull: (reels: ReelsProps) => Promise<FullNarration>;
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
      if (!['pastel@2', 'pastel-tarot@2', 'pastel-weekly@2'].includes(templateVersion)) {
        throw new Error('Bu eski şablon tam konuşma zamanlamasını desteklemiyor');
      }
      input.log(`${name}: giriş, 12 yorum ve kapanış tek TTS isteğiyle seslendiriliyor`);
      const narration = await input.narrateFull(reels);
      const voiceFile = `voice-${name}-full.wav`;
      await writeFile(path.join(serveUrl, 'public', voiceFile), narration.data);
      const videoVoice: ReelsVoice = {full:{file:voiceFile,durationSeconds:narration.durationSeconds}};
      reels = {...reels,sceneTiming:fullNarrationTiming(narration.durationSeconds,narration.sceneStarts,reels.signs.length,REELS_FPS)};
      const seconds = reelsDurationInFrames(reels.signs.length, reels.sceneTiming) / REELS_FPS;
      const musicFile = `music-${name}.wav`;
      // Paket klasörü sunucuda statik olarak sunulur; müzik staticFile() ile buradan okunur.
      await writeFile(path.join(serveUrl, 'public', musicFile), await input.music.render(musicSeed, seconds));
      const inputProps = { templateVersion, reels, musicFile, voice:videoVoice };
      const composition = await selectComposition({ serveUrl, id: 'Post-Reels', inputProps, puppeteerInstance: browser });
      const ranges = reelsFrameRanges(reels.signs.length, reels.sceneTiming, REELS_FPS, videoVoice);
      if (composition.durationInFrames !== reelsDurationInFrames(reels.signs.length, reels.sceneTiming)) {
        throw new Error('Video kompozisyon süresi konuşma zamanlamasıyla uyuşmuyor');
      }
      if (ranges.length!==1) throw new Error('Render tek MP4 olmak zorunda');
      const outputs: {fileName: string; output: string; durationSeconds: number}[] = [];
      for (const frameRange of ranges) {
        const fileName = `${name}.mp4`;
        const output = path.join(work, fileName);
        const started = Date.now();
        await renderMedia({
          serveUrl,
          composition,
          inputProps,
          frameRange,
          codec: 'h264',
          audioCodec: 'aac',
          crf: 22,
          imageFormat: 'jpeg',
          jpegQuality: 82,
          concurrency: 2,
          pixelFormat: 'yuv420p',
          outputLocation: output,
          puppeteerInstance: browser,
        });
        // Measure the encoded file, rather than assuming its requested frame count is its duration.
        const durationSeconds = await probeVideoDuration(output);
        if (!Number.isFinite(durationSeconds) || durationSeconds<=0 || durationSeconds>=MAX_REELS_SECONDS) throw new Error('MP4 179 saniyelik kesin süre sınırını geçemedi');
        input.log(`${fileName}: ${durationSeconds.toFixed(2)} sn video, ${Math.round((Date.now() - started) / 1000)} sn render`);
        outputs.push({fileName, output, durationSeconds});
      }
      // Upload only after ffprobe has verified the single encoded MP4.
      const parts: {videoUrl: string; durationSeconds: number}[] = [];
      for (const output of outputs) {
        const file = await readFile(output.output);
        parts.push({videoUrl: await input.upload(output.fileName, file), durationSeconds: output.durationSeconds});
      }
      return {...parts[0],isAiGenerated:true};
    },
    async close() {
      await browser.close({ silent: true });
      await rm(work, { recursive: true, force: true });
    },
  };
}
