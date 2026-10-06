import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import {createNarrator,narrationText} from './narration';

const dirs:string[]=[];
async function cache(){const dir=await mkdtemp(path.join(os.tmpdir(),'voice-test-'));dirs.push(dir);return dir;}
afterEach(async()=>{for(const dir of dirs.splice(0)) await rm(dir,{recursive:true,force:true});});
const host='https://resembleai-chatterbox-multilingual-tts-v3.hf.space';
function wav(){const b=Buffer.alloc(44+24000*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b;}
const labels=['Text to synthesize','Reference Audio','Language','Exaggeration','Temperature','Random seed','CFG/Pace'];
const types=['textbox','audio','dropdown','slider','slider','number','slider'];
function server(error?:string){
  const submissions:unknown[]=[];
  let rejectSubmission=false;
  const fetchImpl:typeof fetch=async(url,options)=>{
    const u=String(url);
    if(u.endsWith('/config'))return Response.json({api_prefix:'/gradio_api',dependencies:[{api_name:'generate_tts_audio',inputs:[0,1,2,3,4,5,6]}],components:labels.map((label,id)=>({id,type:types[id],props:{label}}))});
    if(u.endsWith('/upload'))return Response.json(['/tmp/reference.wav']);
    if(u.endsWith('/call/generate_tts_audio')){submissions.push(JSON.parse(String(options?.body)));if(rejectSubmission)throw new Error('connection lost');return Response.json({event_id:'event-1'});}
    if(u.endsWith('/event-1'))return new Response(error?`event: error\ndata: ${JSON.stringify(error)}\n\n`:`event: complete\ndata: [{"url":"${host}/gradio_api/file=voice.wav"}]\n\n`);
    if(u.includes('/file='))return new Response(new Uint8Array(wav()));
    throw new Error('unexpected request');
  };
  return {fetchImpl,submissions,disconnect:()=>{rejectSubmission=true;}};
}
describe('burç yorumlarının ücretsiz ses üretimi',()=>{
  it('burç adını bir kez söyler, emojiyi okumaz ve yorum metnini korur',()=>{
    expect(narrationText({signName:'Koç',short:'Koç: Bugün acele etme. ✨'})).toBe('Koç. Bugün acele etme.');
    expect(narrationText({signName:'Boğa',short:'Küçük bir adım at.'})).toBe('Boğa. Küçük bir adım at.');
    expect(()=>narrationText({signName:'Koç',short:''})).toThrow();
  });
  it('aynı metni yedek süreçte dosyadan alır, ikinci GPU işi açmaz',async()=>{
    const cacheDir=await cache(),s=server();
    const first=createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:s.fetchImpl});
    const a=await first.speak('Koç. Bugün acele etme.');
    const again=createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:s.fetchImpl});
    const b=await again.speak('Koç. Bugün acele etme.');
    expect(a.durationSeconds).toBe(1);expect(b.data.equals(a.data)).toBe(true);
    expect(s.submissions).toEqual([{data:['Koç. Bugün acele etme.',{path:'/tmp/reference.wav',orig_name:'serkan-reference.wav',mime_type:'audio/wav',meta:{_type:'gradio.FileData'}},'tr',0.5,0.8,20261002,0.3]}]);
  });
  it('kota reddinden sonra aynı süreçte diğer burçlar için yeni GPU işi açmaz',async()=>{
    const cacheDir=await cache(),s=server('You have exceeded your GPU quota');
    const narrator=createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:s.fetchImpl});
    await expect(narrator.speak('Koç. Bugün acele etme.')).rejects.toThrow('kota');
    await expect(narrator.speak('Boğa. Küçük bir adım at.')).rejects.toThrow('kota');
    expect(s.submissions).toHaveLength(1);
  });
  it('indirme kesildiğinde yedek süreç aynı işi izler, yeniden göndermez',async()=>{
    const cacheDir=await cache(),s=server();let interrupted=true;
    const fetchImpl:typeof fetch=async(url,options)=>{
      if(String(url).includes('/file=')&&interrupted){interrupted=false;throw new Error('download interrupted');}
      return s.fetchImpl(url,options);
    };
    await expect(createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl}).speak('Koç. Bekle.')).rejects.toThrow('download interrupted');
    const resumedFetch:typeof fetch=async(url,options)=>{if(String(url).includes('/call/'))throw new Error('Old event polling forbidden');return fetchImpl(url,options);};
    const clip=await createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:resumedFetch}).speak('Koç. Bekle.');
    expect(clip.durationSeconds).toBe(1);expect(s.submissions).toHaveLength(1);
  });
  it('sonucu belirsiz gönderimi yedek çalıştırmada yeniden açmaz',async()=>{
    const cacheDir=await cache(),s=server();s.disconnect();
    const narrator=createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:s.fetchImpl});
    await expect(narrator.speak('Koç. Bekle.')).rejects.toThrow();
    const retry=createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:s.fetchImpl});
    await expect(retry.speak('Koç. Bekle.')).rejects.toThrow('belirsiz');
    expect(s.submissions).toHaveLength(1);
  });
  it('ayrıntılı kuyruk kota nedenini kaybetmez ve diğer işi göndermez',async()=>{
    const cacheDir=await cache(),s=server();let queueSubmissions=0;
    const fetchImpl:typeof fetch=async(url,options)=>{
      const u=String(url);
      if(u.endsWith('/config')){const c=await(await s.fetchImpl(url,options)).json();c.dependencies[0].id=1;c.dependencies[0].targets=[[14,'click']];return Response.json(c);}
      if(u.endsWith('/queue/join')){queueSubmissions++;return Response.json({event_id:'queue-1'});}
      if(u.includes('/queue/data?'))return new Response('data: '+JSON.stringify({msg:'process_completed',event_id:'queue-1',success:false,output:{error:'You have exceeded your GPU quota. Try again in 0:12:00'}})+'\n\n');
      return s.fetchImpl(url,options);
    };
    const narrator=createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl});
    await expect(narrator.speak('Koç. Bekle.')).rejects.toThrow('kota');
    await expect(narrator.speak('Boğa. Bekle.')).rejects.toThrow('kota');
    expect(queueSubmissions).toBe(1);
  });
  it('eski null hatasını bekleme sonrası sınırlı dener, başarılı sesleri korur',async()=>{
    const cacheDir=await cache(),s=server('null');
    await expect(createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:s.fetchImpl}).speak('Koç. Bekle.')).rejects.toThrow();
    const good=server();
    const clip=await createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:good.fetchImpl,now:()=>Date.now()+600_000}).speak('Koç. Bekle.');
    expect(clip.durationSeconds).toBe(1);expect(good.submissions).toHaveLength(1);
  });
  it('null hatasına hemen veya üçüncü denemeden sonra tekrar iş açmaz',async()=>{
    const cacheDir=await cache(),s=server('null');let time=Date.now();
    const make=()=>createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:s.fetchImpl,now:()=>time});
    await expect(make().speak('Koç. Bekle.')).rejects.toThrow();
    await expect(make().speak('Koç. Bekle.')).rejects.toThrow('bekliyor');
    time+=600_000;await expect(make().speak('Koç. Bekle.')).rejects.toThrow();
    time+=600_000;await expect(make().speak('Koç. Bekle.')).rejects.toThrow();
    time+=600_000;await expect(make().speak('Koç. Bekle.')).rejects.toThrow('bekliyor');
    expect(s.submissions).toHaveLength(3);
  });
  it('önbellekte bekleyen null hatası yedek süreçte diğer yeni işleri de durdurur',async()=>{
    const cacheDir=await cache(),s=server('null');
    await expect(createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:s.fetchImpl}).speak('Koç. Bekle.')).rejects.toThrow();
    const good=server(),retry=createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:good.fetchImpl});
    await expect(retry.speak('Koç. Bekle.')).rejects.toThrow('bekliyor');
    await expect(retry.speak('Boğa. Bekle.')).rejects.toThrow();
    expect(good.submissions).toHaveLength(0);
  });
  it('kuyruk tamamlanma olayından WAV alır, oturumu ve aynı olayı korur',async()=>{
    const cacheDir=await cache(),s=server();let joinBody:Record<string,unknown>|undefined;
    const fetchImpl:typeof fetch=async(url,options)=>{
      const u=String(url);
      if(u.endsWith('/config')){const c=await(await s.fetchImpl(url,options)).json();c.dependencies[0].id=1;c.dependencies[0].targets=[[14,'click']];return Response.json(c);}
      if(u.endsWith('/queue/join')){joinBody=JSON.parse(String(options?.body));return Response.json({event_id:'queue-1'});}
      if(u.includes('/queue/data?')){
        expect(new URL(u).searchParams.get('session_hash')).toBe(joinBody?.session_hash);
        return new Response('data: '+JSON.stringify({msg:'process_completed',event_id:'queue-1',success:true,output:{data:[{url:host+'/gradio_api/file=voice.wav'}]}})+'\n\n');
      }
      return s.fetchImpl(url,options);
    };
    const clip=await createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl}).speak('Koç. Bekle.');
    expect(clip.durationSeconds).toBe(1);expect(joinBody?.fn_index).toBe(1);expect(s.submissions).toHaveLength(0);
  });
  it('kanıtlanmış kurtarma çıktısını indirir; başarılı bulut işini tekrar açmaz',async()=>{
    const cacheDir=await cache(),s=server('null');
    await expect(createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:s.fetchImpl}).speak('Koç. Bekle.')).rejects.toThrow();
    const job=(await readdir(cacheDir)).find(file=>file.endsWith('.json'))!;
    const fetchImpl:typeof fetch=async(url,options)=>{if(!String(url).includes('/file='))throw new Error('New job forbidden');return server().fetchImpl(url,options);};
    const clip=await createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl,recovered:{key:job.slice(0,-5),url:host+'/gradio_api/file=voice.wav'}}).speak('Koç. Bekle.');
    expect(clip.durationSeconds).toBe(1);expect(s.submissions).toHaveLength(1);
  });
  it('tamamlanan dosyanın bozulması halinde sessizce yeni ses üretmez',async()=>{
    const cacheDir=await cache(),s=server();const narrator=createNarrator({reference:Buffer.from('reference'),cacheDir,fetchImpl:s.fetchImpl});
    const a=await narrator.speak('Koç. Bekle.');await writeFile(a.path,'bad');
    await expect(narrator.speak('Koç. Bekle.')).rejects.toThrow('doğrulanamadı');
    expect(s.submissions).toHaveLength(1);
    expect(await readFile(a.path,'utf8')).toBe('bad');
  });
});
