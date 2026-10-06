import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';

const HOST='https://resembleai-chatterbox-multilingual-tts-v3.hf.space';
const BASE=`${HOST}/gradio_api`;
const API='generate_tts_audio';
const SETTINGS={language:'tr',exaggeration:.5,temperature:.8,seed:20261002,cfgWeight:.3};
const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
type Job={state:'submitting'|'submitted'|'failed'|'generated'|'completed';outputUrl?:string;eventId?:string;outputHash?:string;error?:string;quota?:boolean;sessionHash?:string;attempts?:number;retryAt?:number;retryable?:boolean};
export type NarrationClip={data:Buffer;durationSeconds:number;path:string;cached:boolean};

// The generated short already often begins with "Koç:"; pronounce the name once.
export function narrationText(sign:{signName:string;short:string}):string {
  let short=sign.short.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim();
  const prefix=new RegExp(`^${sign.signName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*[:.!,—–-]\\s*`,'iu');
  short=short.replace(prefix,'').trim();
  if(!short)throw new Error(`${sign.signName}: kısa yorum boş`);
  const text=`${sign.signName}. ${short}`.normalize('NFC');
  if([...text].length>300)throw new Error(`${sign.signName}: ses metni 300 karakteri aşıyor; metin kesilmedi`);
  return text;
}

function wavDuration(bytes:Buffer):number {
  if(bytes.length<44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw new Error('Servis geçerli WAV döndürmedi');
  let byteRate=0,dataBytes=0;
  for(let offset=12;offset+8<=bytes.length;){
    const id=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8;
    if(start+size>bytes.length)throw new Error('Servisin ses dosyası eksik');
    if(id==='fmt '&&size>=16)byteRate=bytes.readUInt32LE(start+8);
    if(id==='data')dataBytes=size;
    offset=start+size+(size%2);
  }
  const duration=dataBytes/byteRate;
  if(!Number.isFinite(duration)||duration<=0||duration>30)throw new Error('Servisin konuşma süresi geçersiz');
  return duration;
}

// These files are restored/saved by GitHub Actions, including after a failed run.
// A known event is resumed; an ambiguous submission is never submitted a second time.
export function createNarrator(input:{reference:Buffer;cacheDir:string;fetchImpl?:typeof fetch;log?:(message:string)=>void;now?:()=>number;recovered?:{key:string;url:string}}) {
  const fetchImpl=input.fetchImpl ?? fetch;
  let referencePath:Promise<string>|undefined;
  let quotaError:string|undefined;
  let dependency:{id?:number;inputs:number[];targets?:[number,string][]}|undefined;
  const now=input.now ?? Date.now;
  async function request(url:string,options:RequestInit={},timeout=30_000) {
    const response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(timeout)});
    if(!response.ok){
      if(response.status===429)quotaError='Ücretsiz ses servisinin kota/hız sınırına ulaşıldı';
      throw new Error(quotaError ?? `Ses servisi HTTP ${response.status}`);
    }
    return response;
  }
  async function uploadReference():Promise<string> {
    const config=await (await request(`${HOST}/config`)).json();
    dependency=config.dependencies?.find((item:{api_name?:string})=>item.api_name===API);
    const components=new Map<number,{type:string;props:{label:string}}>(((config.components ?? []) as {id:number;type:string;props:{label:string}}[]).map(c=>[c.id,c]));
    const patterns=[/^Text to synthesize/,/^Reference Audio/,/^Language$/,/^Exaggeration/,/^Temperature$/,/^Random seed/,/^CFG\/Pace$/];
    const types=['textbox','audio','dropdown','slider','slider','number','slider'];
    if(config.api_prefix!=='/gradio_api'||dependency?.inputs?.length!==7||!patterns.every((pattern,index)=>{const component=components.get(dependency!.inputs[index]);return component?.type===types[index]&&pattern.test(component.props?.label ?? '');}))throw new Error('Ücretsiz demo API sözleşmesi değişmiş; başka ses kullanılmadı');
    const form=new FormData();
    form.append('files',new Blob([new Uint8Array(input.reference)],{type:'audio/wav'}),'serkan-reference.wav');
    const uploaded=await (await request(`${BASE}/upload`,{method:'POST',body:form})).json();
    if(!Array.isArray(uploaded)||typeof uploaded[0]!=='string'||!uploaded[0])throw new Error('Ses referansı yüklenemedi');
    return uploaded[0];
  }
  return {
    async speak(rawText:string):Promise<NarrationClip> {
      const text=rawText.trim().normalize('NFC');
      if(!text||[...text].length>300)throw new Error('Ses metni 1–300 karakter olmalı');
      await mkdir(input.cacheDir,{recursive:true});
      const key=hash(JSON.stringify({text,settings:SETTINGS,reference:hash(input.reference),host:HOST}));
      const audioPath=path.join(input.cacheDir,`${key}.wav`),jobPath=path.join(input.cacheDir,`${key}.json`);
      async function save(job:Job){await writeFile(`${jobPath}.tmp`,JSON.stringify(job),{mode:0o600});await rename(`${jobPath}.tmp`,jobPath);}
      async function download(job:Job):Promise<NarrationClip> {
        if(!job.outputUrl || new URL(job.outputUrl).origin!==HOST)throw new Error('Beklenmeyen ses indirme sunucusu');
        const data=Buffer.from(await (await request(job.outputUrl)).arrayBuffer());
        const durationSeconds=wavDuration(data);
        await writeFile(`${audioPath}.tmp`,data,{mode:0o600});await rename(`${audioPath}.tmp`,audioPath);
        await save({...job,state:'completed',outputHash:hash(data)});
        input.log?.(`Ücretsiz serviste ses hazır: ${durationSeconds.toFixed(2)} sn.`);
        return {data,durationSeconds,path:audioPath,cached:false};
      }
      let job:Job|null=null;
      try{job=JSON.parse(await readFile(jobPath,'utf8')) as Job;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      if(job?.state==='failed' && input.recovered?.key===key){
        if(new URL(input.recovered.url).origin!==HOST)throw new Error('Beklenmeyen kurtarma sunucusu');
        job={...job,state:'generated',outputUrl:input.recovered.url};await save(job);
      }
      if(job?.state==='completed'){
        const data=await readFile(audioPath);
        if(hash(data)!==job.outputHash)throw new Error('Önbellekteki ses doğrulanamadı; yeni üretim açılmadı');
        input.log?.('Ses önbellekten alındı.');
        return {data,durationSeconds:wavDuration(data),path:audioPath,cached:true};
      }
      if(job?.state==='generated')return download(job);
      if(job?.state==='submitting')throw new Error('Önceki ses gönderiminin sonucu belirsiz; yeni üretim açılmadı');
      let attempts=job?.attempts ?? (job ? 1 : 0);
      if(job?.state==='failed'){

        const legacyNull=/hata verdi: "?null"?$/.test(job.error ?? '');
        const eligible=job.retryable || legacyNull;
        if(!eligible || attempts>=3 || now()<(job.retryAt ?? 0)){
          if(job.quota)quotaError ??= 'Ücretsiz ses servisinin kota sınırı için önceki iş bekliyor';
          else if(legacyNull || job.retryable)quotaError ??= 'Ses servisi geçici hata sonrası bekliyor; diğer yeni işler bekletildi';
          throw new Error(quotaError ?? `Önceki ses işi bekliyor: ${job.error}`);
        }
        if(quotaError)throw new Error(quotaError);
        input.log?.(`Sonuçlanmış başarısız ses işi kontrollü yeniden deneniyor (${attempts+1}/3).`);
        job=null;

      }
      if(!job){
        if(quotaError)throw new Error(quotaError);
        referencePath ??= uploadReference();
        const uploaded=await referencePath;
        const file={path:uploaded,orig_name:'serkan-reference.wav',mime_type:'audio/wav',meta:{_type:'gradio.FileData'}};
        const sessionHash=Number.isInteger(dependency?.id) ? randomUUID().replaceAll('-','') : undefined;
        job={state:'submitting',sessionHash,attempts:++attempts};await save(job);
        const data=[text,file,SETTINGS.language,SETTINGS.exaggeration,SETTINGS.temperature,SETTINGS.seed,SETTINGS.cfgWeight];
        const result=await (await request(sessionHash ? `${BASE}/queue/join` : `${BASE}/call/${API}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(sessionHash ? {data,fn_index:dependency!.id,session_hash:sessionHash,event_data:null,trigger_id:dependency?.targets?.[0]?.[0]} : {data})})).json();
        if(!result.event_id||typeof result.event_id!=='string')throw new Error('Ses işi kimliği alınamadı; gönderim sonucu belirsiz');
        job={...job,state:'submitted',eventId:result.event_id};await save(job);
      }
      if(!job.eventId)throw new Error('İzlenecek ses işi kimliği yok');
      const response=await request(job.sessionHash ? `${BASE}/queue/data?session_hash=${encodeURIComponent(job.sessionHash)}` : `${BASE}/call/${API}/${encodeURIComponent(job.eventId)}`,{},180_000);
      if(!response.body)throw new Error('Ses işi izleme akışı boş');
      const decoder=new TextDecoder();let buffer='';
      const reader=response.body.getReader();
      let lastError:string|undefined;
      try { while(true){
        const {done,value:chunk}=await reader.read();
        if(done)break;
        buffer=(buffer+decoder.decode(chunk,{stream:true})).replace(/\r\n/g,'\n');
        let end:number;
        while((end=buffer.indexOf('\n\n'))>=0){
          const lines=buffer.slice(0,end).split('\n');buffer=buffer.slice(end+2);
          let event=lines.find(line=>line.startsWith('event:'))?.slice(6).trim();
          let raw=lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('\n');
          if(job.sessionHash){
            if(!raw)continue;
            const message=JSON.parse(raw);
            if(message.event_id && message.event_id!==job.eventId)continue;
            if(message.msg==='log' && (message.level==='error'||message.level==='warning'))lastError=String(message.log ?? '').slice(0,500);
            if(message.msg!=='process_completed')continue;
            event=message.success ? 'complete' : 'error';
            raw=message.success ? JSON.stringify(message.output?.data) : String(message.output?.error ?? lastError ?? 'null');
          }
          if(event==='error'){

            const quota=/quota|rate.?limit|too many requests|exceeded.*GPU/i.test(raw);
            const message=quota ? `Ücretsiz ses servisinin kota sınırına ulaşıldı: ${raw.slice(0,500)}` : `Ücretsiz ses servisi hata verdi: ${raw.slice(0,300)}`;
            if(quota)quotaError=message;
            const reset=raw.match(/(?:again in|retry.*?in)\s*(\d+):(\d{2}):(\d{2})/i);
            const delay=reset ? (Number(reset[1])*3600+Number(reset[2])*60+Number(reset[3]))*1000 : 300_000;
            const transient=/^"?null"?$/.test(raw.trim());
            const retryable=transient || Boolean(quota && reset);
            if(transient)quotaError='Ses servisi geçici hata sonrası bekliyor; diğer yeni işler bekletildi';
            await save({...job,state:'failed',error:message,quota,retryable,retryAt:now()+delay});throw new Error(message);

          }
          if(event!=='complete')continue;
          const file=JSON.parse(raw)?.[0];
          if(!file?.url&&!file?.path)throw new Error('Servis ses dosyası döndürmedi');
          const url=new URL(file.url ?? `${BASE}/file=${encodeURIComponent(file.path)}`);
          if(url.origin!==HOST)throw new Error('Beklenmeyen ses indirme sunucusu');
          job={...job,state:'generated',outputUrl:url.href};await save(job);
          return await download(job);
        }
      }} finally {reader.releaseLock();}
      throw new Error('Ses işi henüz tamamlanmadı; yedek tetikleme aynı işi izleyecek');
    },
  };
}
