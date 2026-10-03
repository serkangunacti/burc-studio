import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {LONGEST_WEEKLY_BODY,SAMPLE_COVER,sampleProps,sampleReels,sampleSign} from '../src/remotion/fixtures';
import {openMusicRenderer} from './automation/music';
import {openRemotionRenderers} from './automation/remotion';
import {decodeVoiceAsset} from './automation/voice';

async function main() {
  const output=process.argv[2],assetFile=process.argv[3];
  if(!output || !assetFile) throw new Error('Çıktı klasörü ve özel ses varlığı dosyası gerekli');
  await mkdir(output,{recursive:true});
  const music=await openMusicRenderer();
  const renderer=await openRemotionRenderers({music,voice:decodeVoiceAsset(await readFile(assetFile,'utf8')),log:console.log,upload:async(name,file)=>{const dest=path.join(output,name);await writeFile(dest,file);return dest;}});
  const brand={handle:'kozmikarkan',enabled:true,position:'bottom-center' as const,opacity:.55};
  try {
    const samples=[
      {name:'pastel-kozmik-burc-kapak',version:'pastel@2',props:sampleProps({...SAMPLE_COVER,dateLabel:'5 EKİM 2026 PAZARTESİ',hook:'Mesajı göndermeden önce burcuna bak.'},{brand,variant:0})},
      {name:'pastel-kozmik-burc-kadin',version:'pastel@2',props:sampleProps({...sampleSign('koc','kadin'),dateLabel:'5 EKİM'},{brand,variant:0})},
      {name:'pastel-kozmik-burc-erkek',version:'pastel@2',props:sampleProps({...sampleSign('oglak','erkek'),dateLabel:'5 EKİM'},{brand,variant:0})},
      {name:'pastel-kozmik-tarot-kadin',version:'pastel-tarot@2',props:sampleProps({...sampleSign('yay','kadin'),dateLabel:'5 EKİM',headline:'Umut küçük bir adımla başlar',body:'Yıldız kartı bugün sana sakin bir güven duygusunu hatırlatıyor. Ertelediğin bir fikri yazıya dök; her ayrıntıyı çözmeden de ilk adımı atabilirsin. Yakın bir arkadaşınla kuracağın açık bir konuşma, aklındaki soruyu hafifletebilir. Akşam kendine kısa bir mola ver ve bugün ilerlediğin yolu fark et ✨',tarotCard:{id:'yildiz',name:'Yıldız'}},{brand,variant:0})},
      {name:'pastel-kozmik-tarot-erkek',version:'pastel-tarot@2',props:sampleProps({...sampleSign('balik','erkek'),dateLabel:'5 EKİM',headline:'Kendine ayırdığın zaman değerli',body:'Tılsım Kraliçesi bugün günlük düzenine özen göstermeyi öneriyor. İşlerini küçük parçalara böl, harcamalarını gözden geçir ve kendine rahat bir alan aç. Sevdiğin biriyle paylaşacağın sade bir öğün, uzun bir konuşmadan daha iyi gelebilir. Günün sonunda kendi ihtiyaçlarına da kulak ver ✨',tarotCard:{id:'tilsim-kralice',name:'Tılsım Kraliçesi'}},{brand,variant:0})},
      {name:'pastel-kozmik-haftalik',version:'pastel-weekly@2',props:sampleProps({...sampleSign('yay','kadin'),dateLabel:'5–11 EKİM',headline:'Yeni haftaya yer aç',body:'Bu hafta planlarını sadeleştirmek sana iyi gelebilir. Pazartesi önceliklerini belirle ve hepsini aynı güne sığdırmaya çalışma. İşte yeni bir fikir ortaya çıktığında önce küçük bir deneme yap; geri bildirimler yönünü netleştirsin. İlişkilerde söylemek istediğini açık ama yumuşak bir dille paylaş. Hafta ortasında kısa bir yürüyüş veya sevdiğin bir uğraş zihnini dinlendirebilir. Hafta sonuna doğru tamamladıklarını gözden geçir ve kendine dinlenme zamanı bırak ✨'},{brand,variant:0})},
    ];
    for(const sample of samples){const [bytes]=await renderer.renderStills(sample.version,[sample.props]);await writeFile(path.join(output,`${sample.name}.jpg`),bytes);console.log(`${sample.name}.jpg hazır`);}
    const [stress]=await renderer.renderStills('pastel-weekly@2',[sampleProps({...sampleSign('yay','kadin'),dateLabel:'5–11 EKİM',body:LONGEST_WEEKLY_BODY},{brand,variant:0})]);
    await writeFile(path.join(output,'pastel-kozmik-haftalik-uzun.jpg'),stress);
    const reels={...sampleReels('erkek'),dateLabel:'5 EKİM 2026 PAZARTESİ',hook:'Günün kartından sana hangi mesaj düşüyor?',brand,variant:0,signs:sampleReels('erkek').signs.map(sign=>({...sign,tarotCard:{id:'yildiz',name:'Yıldız'}}))};
    if(!process.argv.includes('--stills-only')) console.log(await renderer.renderReels({templateVersion:'pastel-tarot@2',reels,musicSeed:20261005,name:'pastel-kozmik-serkanses-59sn'}));
    const cards=samples.map(s=>`<a href="${s.name}.jpg"><img alt="${s.name}" src="${s.name}.jpg"></a>`).join('');
    await writeFile(path.join(output,'secili-pastel-kozmik.html'),`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Onaylanan Pastel Kozmik</title><style>body{background:#eee8f7;color:#302044;font:18px/1.6 system-ui;margin:40px auto;max-width:1150px;padding:20px}section{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}img{width:100%;border-radius:14px}video{display:block;margin:30px auto;max-height:720px;max-width:100%}@media(max-width:700px){section{grid-template-columns:1fr}}</style><h1>Seçtiğin Pastel Kozmik — üretim uyarlaması</h1><p>Kadın ve erkek burç/tarot kartları ile uzun haftalık yorum. Aşağıdaki 59 saniyelik video aynı render akışı, mevcut müzik ve bir kez hazırlanmış serkanses giriş/kapanışı ile çizildi. Bunlar örnek metinlerdir; sosyal medyada paylaşılmadı.</p><section>${cards}</section><video controls src="pastel-kozmik-serkanses-59sn.mp4" poster="pastel-kozmik-tarot-erkek.jpg"></video></html>`);
  } finally {await renderer.close();await music.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
