import path from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';

// Müzik tarayıcıdakiyle birebir aynı kodla (OfflineAudioContext) başsız Chromium'da üretilir; ses karakteri değişmesin.
const ENTRY = `
import { composeAmbient } from './src/lib/music/compose';
import { renderScoreToWav } from './src/lib/music/synth';
window.renderMusic = async (seed, seconds) => {
  const bytes = new Uint8Array(await (await renderScoreToWav(composeAmbient(seed, seconds))).arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};
`;

export type MusicRenderer = { render: (seed: number, seconds: number) => Promise<Buffer>; close: () => Promise<void> };

export async function openMusicRenderer(): Promise<MusicRenderer> {
  const bundled = await build({
    stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    alias: { '@': path.resolve('src') },
  });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  return {
    render: async (seed, seconds) =>
      Buffer.from(
        await page.evaluate(
          ([s, d]) => (window as unknown as { renderMusic: (seed: number, seconds: number) => Promise<string> }).renderMusic(s, d),
          [seed, seconds] as const,
        ),
        'base64',
      ),
    close: () => browser.close(),
  };
}
