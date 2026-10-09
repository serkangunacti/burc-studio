import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {sampleReels} from '../../src/remotion/fixtures';
import {createWavFromPcm, introNarrationText, narrationText, outroNarrationText, wavDuration} from './google-tts';
import {createFullNarration, fitNarrationToBudget} from './full-narration';

const dirs:string[]=[];
async function work(){const dir=await mkdtemp(path.join(os.tmpdir(),'full-narration-test-'));dirs.push(dir);return dir;}
afterEach(async()=>{vi.unstubAllEnvs(); for(const dir of dirs.splice(0)) await rm(dir,{recursive:true,force:true});});

describe('tek video, tam ses ve önbellekte zamanlama',()=>{
  it('12 uzun yorumun tamamını giriş ve kapanışla tek TTS isteğine verir',async()=>{
    const reels=sampleReels('kadin');
    const bodies=Array.from({length:12},(_,i)=>`Yorum ${i+1}: ${'Bu cümle tam okunacak ve hiçbir bölümü atlanmayacak. '.repeat(4)}Son cümle ${i+1}.`);
    reels.signs=reels.signs.map((sign,i)=>({...sign,body:bodies[i]}));
    const dir=await work();const audio=createWavFromPcm(Buffer.alloc(20*48000));const raw=path.join(dir,'raw.wav');await writeFile(raw,audio);
    const speak=vi.fn(async(_text:string)=>({data:audio,path:raw,durationSeconds:20,cached:false}));
    await createFullNarration(reels,{narrator:{speak},cacheDir:dir,align:async()=>Array.from({length:14},(_,i)=>i*1.4)});
    expect(speak).toHaveBeenCalledTimes(1);
    for(const body of bodies)expect(speak.mock.calls[0][0]).toContain(body);
    expect(speak.mock.calls[0][0]).toContain(introNarrationText(reels));
    expect(speak.mock.calls[0][0]).toContain(outroNarrationText());
  });

  it.each(['horoscope','tarot','weekly'])('%s kadın ve erkek için giriş, 12 yorum ve kapanışı tek istekte korur', async kind=>{
    for(const audience of ['kadin','erkek'] as const){
      const reels=sampleReels(audience);
      if(kind==='weekly')reels.signs=reels.signs.map(s=>({...s,body:'Bu haftanın mevcut yorumu.'}));
      if(kind==='tarot')reels.signs=reels.signs.map(s=>({...s,tarotCard:{id:'fool',name:'Deli'}}));
      const dir=await work(); const audio=createWavFromPcm(Buffer.alloc(20*48000)); const audioPath=path.join(dir,'raw.wav'); await writeFile(audioPath,audio);
      const speak=vi.fn(async(_text:string)=>({data:audio,path:audioPath,durationSeconds:20,cached:false}));
      const align=vi.fn(async()=>Array.from({length:14},(_,i)=>i*1.4));
      const input={narrator:{speak},cacheDir:dir,align};
      const result=await createFullNarration(reels,input);
      expect(speak.mock.calls[0][0]).toBe([introNarrationText(reels),...reels.signs.map(narrationText),outroNarrationText()].join('\n\n'));
      expect(speak).toHaveBeenCalledTimes(1);
      expect(result.durationSeconds).toBe(20);
      expect(result.sceneStarts).toHaveLength(14);
      expect(createHash('sha256').update(result.data).digest('hex')).toBe(createHash('sha256').update(audio).digest('hex'));
      const again=await createFullNarration(reels,input);
      expect(again.sceneStarts).toEqual(result.sceneStarts);
      expect(align).toHaveBeenCalledTimes(1);
      // A corrupt timing cache must be recomputed; the voice stays reusable.
      await writeFile(result.timingPath,'{"sceneStarts":[0]}');
      await createFullNarration(reels,input); expect(align).toHaveBeenCalledTimes(2);
    }
  });

  it('uzun sesi kesmeden ve perdeyi değiştirmeden 178,5 sn bütçeye uyarlar',async()=>{
    const dir=await work(); const pcm=Buffer.alloc(210*16000*2);
    for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round(8000*Math.sin(2*Math.PI*440*i/16000)),i*2);
    const raw=path.join(dir,'raw.wav'); await writeFile(raw,createWavFromPcm(pcm,16000));
    const output=await fitNarrationToBudget(raw,dir);
    expect(output.durationSeconds).toBeGreaterThan(178);
    expect(output.durationSeconds).toBeLessThanOrEqual(178.5);
    expect(wavDuration(await readFile(raw))).toBe(210);
    // Count positive zero crossings in a middle second: tempo changes, pitch stays 440 Hz.
    const data=output.data;const rate=data.readUInt32LE(24);let start=data.indexOf(Buffer.from('data'))+8;start+=Math.floor(rate*70)*2;
    let crossings=0;for(let i=start+2;i<start+rate*2;i+=2)if(data.readInt16LE(i-2)<0&&data.readInt16LE(i)>=0)crossings++;
    expect(crossings).toBeGreaterThan(435);expect(crossings).toBeLessThan(445);
    expect((await fitNarrationToBudget(raw,dir)).cached).toBe(true);
  });

  it('eksik veya sırası bozuk zamanlamada video üretmez',async()=>{
    const dir=await work();const data=createWavFromPcm(Buffer.alloc(20*48000));const raw=path.join(dir,'raw.wav');await writeFile(raw,data);
    const narrator={speak:async()=>({data,path:raw,durationSeconds:20,cached:false})};
    await expect(createFullNarration(sampleReels(),{narrator,cacheDir:dir,align:async()=>[0,10]})).rejects.toThrow(/zamanlama/i);
  });
  it('Actions dışında konuşma analizi çalıştırmayı reddeder',async()=>{
    vi.stubEnv('GITHUB_ACTIONS','false');const dir=await work();const data=createWavFromPcm(Buffer.alloc(20*48000));const raw=path.join(dir,'raw.wav');await writeFile(raw,data);
    await expect(createFullNarration(sampleReels(),{narrator:{speak:async()=>({data,path:raw,durationSeconds:20,cached:false})},cacheDir:dir})).rejects.toThrow(/GitHub Actions/);
  });

  it('konuşma zamanlaması eşleşmediğinde bozuk sesi geçersiz sayıp yeni TTS isteğiyle kurtarır', async () => {
    const dir = await work();
    const data1 = createWavFromPcm(Buffer.alloc(20 * 48000));
    const data2 = createWavFromPcm(Buffer.alloc(22 * 48000));
    const raw1 = path.join(dir, 'raw1.wav');
    const raw2 = path.join(dir, 'raw2.wav');
    await writeFile(raw1, data1);
    await writeFile(raw2, data2);
    let calls = 0;
    const speak = vi.fn(async (_text: string, _opts?: { force?: boolean }) => {
      calls++;
      if (calls === 1) return { data: data1, path: raw1, durationSeconds: 20, cached: false };
      return { data: data2, path: raw2, durationSeconds: 22, cached: false };
    });
    let alignCalls = 0;
    const align = vi.fn(async () => {
      alignCalls++;
      if (alignCalls === 1) throw new Error('Konuşma zamanlaması iki analizde doğrulanamadı');
      return Array.from({ length: 14 }, (_, i) => i * 1.5);
    });
    const result = await createFullNarration(sampleReels(), { narrator: { speak }, cacheDir: dir, align });
    expect(calls).toBe(2);
    expect(speak.mock.calls[1][1]).toEqual({ force: true });
    expect(alignCalls).toBe(2);
    expect(result.durationSeconds).toBe(22);
    expect(result.sceneStarts).toHaveLength(14);
  });
});
