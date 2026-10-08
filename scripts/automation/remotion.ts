import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import type { Renderers } from '@/lib/automation/render-job';
import { REELS_FPS, reelsDurationInFrames } from '@/remotion/reels';
import type { MusicRenderer } from './music';
import type { decodeVoiceAsset } from './voice';
import type { ReelsSign, ReelsProps } from '@/remotion/slide-types';
import {narrationTiming,reelsFrameRanges,type ReelsVoice} from '@/remotion/voice';
import type {NarrationClip} from './google-tts';
import {probeVideoDuration} from './video-duration';

export type RemotionRenderers = Renderers & { close: () => Promise<void> };

export async function openRemotionRenderers(input: {
  music: MusicRenderer;
  upload: (name: string, file: Buffer) => Promise<string>;
  log: (message: string) => void;
  voice?: ReturnType<typeof decodeVoiceAsset>;
  narrate?: (sign: ReelsSign) => Promise<NarrationClip>;
  narrateIntro?: (reels: ReelsProps) => Promise<NarrationClip>;
  narrateOutro?: () => Promise<NarrationClip>;
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
  const voice:ReelsVoice|undefined = input.voice ? {
    intro: {file:'serkanses-intro.mp3',durationSeconds:input.voice.intro.durationSeconds},
    outro: {file:'serkanses-outro.mp3',durationSeconds:input.voice.outro.durationSeconds},
  } : undefined;
  if (input.voice) {
    await writeFile(path.join(serveUrl,'public','serkanses-intro.mp3'),input.voice.intro.data);
    await writeFile(path.join(serveUrl,'public','serkanses-outro.mp3'),input.voice.outro.data);
  }

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
      let videoVoice: typeof voice = undefined;
      if (input.narrate) {
        if (!['pastel@2', 'pastel-tarot@2', 'pastel-weekly@2'].includes(templateVersion)) {
          throw new Error('Bu eski şablon burç konuşma zamanlamasını desteklemiyor; video üretilmedi');
        }

        let introVoice: { file: string; durationSeconds: number } | undefined;
        let outroVoice: { file: string; durationSeconds: number } | undefined;

        if (input.narrateIntro) {
          input.log(`${name}: sıcak giriş Google TTS ile seslendiriliyor`);
          const introClip = await input.narrateIntro(reels);
          const file = `voice-${name}-intro.wav`;
          await writeFile(path.join(serveUrl, 'public', file), introClip.data);
          introVoice = { file, durationSeconds: introClip.durationSeconds };
        }

        if (input.narrateOutro) {
          input.log(`${name}: samimi kapanış Google TTS ile seslendiriliyor`);
          const outroClip = await input.narrateOutro();
          const file = `voice-${name}-outro.wav`;
          await writeFile(path.join(serveUrl, 'public', file), outroClip.data);
          outroVoice = { file, durationSeconds: outroClip.durationSeconds };
        }

        if (!introVoice || !outroVoice) {
          throw new Error('Google TTS giriş ve kapanış sesleri üretilemedi; video eksik konuşmayla üretilmeyecek');
        }

        const signs = [];
        // Tüm burç yorumları Google TTS ile seslendirilmelidir
        for (const [index, sign] of reels.signs.entries()) {
          input.log(`${name}: ${index + 1}/${reels.signs.length} ${sign.signName} Google TTS ile seslendiriliyor`);
          const clip = await input.narrate(sign);
          const file = `voice-${name}-${sign.sign}.wav`;
          await writeFile(path.join(serveUrl, 'public', file), clip.data);
          signs.push({ file, durationSeconds: clip.durationSeconds });
        }

        videoVoice = { intro: introVoice, outro: outroVoice, signs };
        reels = { ...reels, sceneTiming: narrationTiming(videoVoice, reels.signs.length, REELS_FPS) };
      }
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
      const outputs: {fileName: string; output: string; durationSeconds: number}[] = [];
      for (const [index, frameRange] of ranges.entries()) {
        const fileName = ranges.length === 1 ? `${name}.mp4` : `${name}-part-${index + 1}.mp4`;
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
        input.log(`${fileName}: ${durationSeconds.toFixed(2)} sn video, ${Math.round((Date.now() - started) / 1000)} sn render`);
        outputs.push({fileName, output, durationSeconds});
      }
      // No part is exposed for publishing until all parts have passed the duration gate.
      const parts: {videoUrl: string; durationSeconds: number}[] = [];
      for (const output of outputs) {
        const file = await readFile(output.output);
        parts.push({videoUrl: await input.upload(output.fileName, file), durationSeconds: output.durationSeconds});
      }
      return { ...parts[0], ...(videoVoice ? {isAiGenerated:true} : {}), ...(parts.length > 1 ? {parts} : {}) };
    },
    async close() {
      await browser.close({ silent: true });
      await rm(work, { recursive: true, force: true });
    },
  };
}
