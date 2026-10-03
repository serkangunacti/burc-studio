import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';

async function main() {
const output = process.argv[2];
const approvedVoice = process.argv[3];
if (!output || !approvedVoice) throw new Error('Kullanım: tsx scripts/design-lab-preview.ts <çıktı-klasörü> <onaylı-örnek.wav>');
await mkdir(output, { recursive:true });
const serveUrl = await bundle({ entryPoint:path.resolve('src/remotion/design-lab.tsx') });
await writeFile(path.join(serveUrl,'public','approved-preview.wav'),await readFile(approvedVoice));
const browser = await openBrowser('chrome');
try {
  for (const direction of ['pastel','editorial','night']) {
    for (const page of ['cover','horoscope','tarot']) {
      const id = `${direction}-${page}`;
      const composition = await selectComposition({serveUrl,id,puppeteerInstance:browser});
      await renderStill({serveUrl,composition,output:path.join(output,`${id}.png`),imageFormat:'png',puppeteerInstance:browser});
      console.log(`${id}.png hazır`);
    }
    const id = `${direction}-video`;
    const inputProps = {direction,voiceFile:'approved-preview.wav'};
    const composition = await selectComposition({serveUrl,id,inputProps,puppeteerInstance:browser});
    await renderMedia({serveUrl,composition,inputProps,outputLocation:path.join(output,`${id}.mp4`),codec:'h264',audioCodec:'aac',pixelFormat:'yuv420p',crf:20,scale:0.5,concurrency:2,puppeteerInstance:browser});
    console.log(`${id}.mp4 hazır`);
  }
} finally { await browser.close({silent:true}); }
const names = {pastel:'A · Pastel Kozmik',editorial:'B · Krem Editoryal',night:'C · Gece Laciverti'};
const cards = Object.entries(names).map(([id,name])=>`<section><h2>${name}</h2><p>${id==='pastel'?'Yumuşak geçişler, dönen yörünge ve kademeli metin.':id==='editorial'?'Yana açılan sayfa, serif başlıklar ve numaralı günlük notlar.':'Beliren yıldızlar, derin lacivert zemin ve dönen tarot kartı.'}</p><div class="images">${['cover','horoscope','tarot'].map(page=>`<a href="${id}-${page}.png"><img src="${id}-${page}.png" alt="${name} ${page}"></a>`).join('')}</div><video controls preload="metadata" poster="${id}-cover.png" src="${id}-video.mp4"></video><p><a href="${id}-video.mp4">Videoyu aç / indir</a></p></section>`).join('');
await writeFile(path.join(output,'index.html'),`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kozmik Arkan — Tasarım Seçimi</title><style>body{margin:0;background:#f4f1eb;color:#252336;font:17px/1.6 system-ui}main{max-width:1180px;margin:auto;padding:40px 24px}h1{font-size:38px;line-height:1.2}h2{margin:0;font-size:28px}section{background:white;border-radius:18px;margin:30px 0;padding:28px}.images{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}img{width:100%;display:block;border-radius:10px}video{display:block;max-height:640px;max-width:100%;margin:24px auto;background:#161323;border-radius:12px}a{color:#613e84}@media(max-width:700px){.images{grid-template-columns:1fr}h1{font-size:29px}}</style><main><h1>Burç ve tarot için üç tasarım yönü</h1><p>Her seçenek: kapak + kadın burç kartı + erkek tarot kartı + 18 saniyelik sesli animasyon. Görsele tıklayarak tam boy açabilirsin.</p><p>Bu dosyalar yalnız seçim örneği. Canlı paylaşım tasarımı henüz değiştirilmedi. Ses, daha önce onayladığın serkanses örneğidir. Örnek metinler gerçek günlük yorum değildir.</p>${cards}</main></html>`);
console.log(`Galeri: ${path.join(output,'index.html')}`);
}

main().catch(error=>{ console.error(error); process.exitCode=1; });
