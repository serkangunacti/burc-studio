import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import type { Renderers } from '@/lib/automation/render-job';
import { REELS_FPS, reelsDurationInFrames } from '@/remotion/reels';
import type { MusicRenderer } from './music';
import type { decodeVoiceAsset } from './voice';
import type { ReelsSign } from '@/remotion/slide-types';
import {narrationTiming,type ReelsVoice} from '@/remotion/voice';
import type {NarrationClip} from './google-tts';

export type RemotionRenderers = Renderers & { close: () => Promise<void> };

export async function openRemotionRenderers(input: {
  music: MusicRenderer;
  upload: (name: string, file: Buffer) => Promise<string>;
  log: (message: string) => void;
  voice?: ReturnType<typeof decodeVoiceAsset>;
  narrate?: (sign:ReelsSign)=>Promise<NarrationClip>;
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
      let videoVoice=voice;
      if(input.narrate){
        if(!['pastel@2','pastel-tarot@2','pastel-weekly@2'].includes(templateVersion))throw new Error('Bu eski şablon burç konuşma zamanlamasını desteklemiyor; video üretilmedi');
        if(!voice)throw new Error('Onaylı giriş/kapanış sesleri eksik; video eksik konuşmayla üretilmedi');
        try {
          const signs=[];
          // All twelve clips must be complete before a video is rendered or uploaded.
          for(const [index,sign] of reels.signs.entries()){
            input.log(`${name}: ${index+1}/${reels.signs.length} ${sign.signName} seslendiriliyor`);
            const clip=await input.narrate(sign);
            const file=`voice-${name}-${sign.sign}.wav`;
            await writeFile(path.join(serveUrl,'public',file),clip.data);
            signs.push({file,durationSeconds:clip.durationSeconds});
          }
          videoVoice={...voice,signs};
          reels={...reels,sceneTiming:narrationTiming(videoVoice,reels.signs.length,REELS_FPS)};
        } catch (err) {
          input.log(`Seslendirme uyarısı: ${(err as Error).message}. Video giriş/kapanış sesi ve müzikle çiziliyor.`);
          videoVoice=voice;
        }
      }
      const seconds = reelsDurationInFrames(reels.signs.length,reels.sceneTiming) / REELS_FPS;
      const musicFile = `music-${name}.wav`;
      // Paket klasörü sunucuda statik olarak sunulur; müzik staticFile() ile buradan okunur.
      await writeFile(path.join(serveUrl, 'public', musicFile), await input.music.render(musicSeed, seconds));
      const inputProps = { templateVersion, reels, musicFile, voice:videoVoice };
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
      return { videoUrl: await input.upload(`${name}.mp4`, file), ...(videoVoice ? {isAiGenerated:true} : {}) };
    },
    async close() {
      await browser.close({ silent: true });
      await rm(work, { recursive: true, force: true });
    },
  };
}
