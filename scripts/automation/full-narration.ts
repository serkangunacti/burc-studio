import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import type {ReelsProps} from '../../src/remotion/slide-types';
import {fullNarrationTiming} from '../../src/remotion/voice';
import {MAX_REELS_NARRATION_SECONDS,MIN_REELS_SCENE_AUDIO_GAP_SECONDS,REELS_FPS} from '../../src/remotion/reels';
import {introNarrationText, narrationText, outroNarrationText, wavDuration, type NarrationClip} from './google-tts';

const execFileAsync=promisify(execFile);
export const NARRATION_BUDGET_SECONDS=MAX_REELS_NARRATION_SECONDS;
export type FullNarration=NarrationClip & {sceneStarts:number[];timingPath:string};

const BROKEN_AUDIO_KEYS = new Set([
  '78da634382841e7b8c3797221fcd043af362ecfcca4bc4e6465871b884aab543',
  '12085e8642275277a63f0c2aa041d23512958287c78b2491cddd9d5c02cc127b',
]);

// Every input sample is processed. atempo changes tempo while retaining pitch;
// neither -t nor sample-rate changes are used to shorten speech.
export async function fitNarrationToBudget(rawPath:string,cacheDir:string):Promise<NarrationClip>{
  const raw=await readFile(rawPath);
  const rawDuration=wavDuration(raw);
  if(rawDuration<=NARRATION_BUDGET_SECONDS)return {data:raw,durationSeconds:rawDuration,path:rawPath,cached:false};
  await mkdir(cacheDir,{recursive:true});
  const key=createHash('sha256').update(raw).update('atempo-v1-178.5').digest('hex');
  const output=path.join(cacheDir,`${key}-tempo.wav`);
  try{
    const data=await readFile(output);const durationSeconds=wavDuration(data);
    if(durationSeconds>NARRATION_BUDGET_SECONDS)throw new Error('Ses bütçeyi aşıyor');
    return {data,durationSeconds,path:output,cached:true};
  }catch{/* A missing or invalid fitted cache is regenerated from the complete original. */}
  let tempo=rawDuration/(NARRATION_BUDGET_SECONDS-.05);
  if (tempo > 1.25) {
    throw new Error(`Tam ses doğal hızda (1.0x) ${rawDuration.toFixed(1)} sn; 178,5 sn bütçesini aşıyor (tempo=${tempo.toFixed(2)}x). Doğal anlatımı korumak için robotik hızlandırmaya izin verilmiyor; metin kısaltılmalıdır.`);
  }
  for(let attempt=0;attempt<3;attempt++){
    let remaining=tempo;const factors:number[]=[];
    while(remaining>2){factors.push(2);remaining/=2;}factors.push(remaining);
    await execFileAsync('ffmpeg',['-nostdin','-v','error','-y','-i',rawPath,'-af',factors.map(f=>`atempo=${f.toFixed(10)}`).join(','),'-c:a','pcm_s16le','-f','wav',`${output}.tmp`],{timeout:120_000});
    const data=await readFile(`${output}.tmp`);const durationSeconds=wavDuration(data);
    if(durationSeconds<=NARRATION_BUDGET_SECONDS){
      await rename(`${output}.tmp`,output);
      return {data,durationSeconds,path:output,cached:false};
    }
    tempo*=durationSeconds/(NARRATION_BUDGET_SECONDS-.05);
  }
  throw new Error('Tam ses 178,5 saniyelik bütçeye uyarlanamadı; konuşma kesilmedi');
}

async function alignOnActions(audio:string,scenes:string[],manifest:string,durationSeconds:number,minimumSceneGapSeconds=MIN_REELS_SCENE_AUDIO_GAP_SECONDS):Promise<number[]>{
  if(process.env.GITHUB_ACTIONS!=='true')throw new Error('Konuşma analizi yalnız GitHub Actions üzerinde çalışır');
  await writeFile(manifest,JSON.stringify({scenes,durationSeconds,minimumSceneGapSeconds}),{mode:0o600});
  const output=`${manifest}.aligned.json`;
  await execFileAsync('python3',['scripts/automation/align-narration.py',audio,manifest,output],{timeout:15*60_000,maxBuffer:4*1024*1024});
  return (JSON.parse(await readFile(output,'utf8')) as {sceneStarts:number[]}).sceneStarts;
}

export async function createFullNarration(reels:ReelsProps,input:{
  narrator:{speak:(text:string,opts?:{force?:boolean})=>Promise<NarrationClip>};
  cacheDir:string;
  align?:(audio:string,scenes:string[],manifest:string)=>Promise<number[]>;
}):Promise<FullNarration>{
  const signCount = reels.signs.length;
  if(signCount===0)throw new Error('Konuşma için en az 1 burç yorumu zorunlu');
  const isElementVideo = signCount < 12;
  const scenes=[
    introNarrationText(reels),
    ...reels.signs.map(narrationText),
    outroNarrationText(reels)
  ].map(text=>text.trim().normalize('NFC'));
  const fullText=scenes.join('\n\n');

  let force=false;
  let lastError:unknown;
  for(let attempt=1;attempt<=3;attempt++){
    const raw=await input.narrator.speak(fullText,{force});
    if(raw.cached && BROKEN_AUDIO_KEYS.has(path.basename(raw.path,'.wav'))){
      force=true;
      continue;
    }
    const audio=await fitNarrationToBudget(raw.path,input.cacheDir);
    const tempoKey=path.basename(audio.path).replace('-tempo.wav','');
    if(audio.cached && BROKEN_AUDIO_KEYS.has(tempoKey)){
      force=true;
      continue;
    }
    const key=createHash('sha256').update(audio.data).update(JSON.stringify({scenes,engine:'stable-ts-small-tr-v4-natural-alignment'})).digest('hex');
    const timingPath=path.join(input.cacheDir,`${key}-timing.json`);
    try{
      const cached=JSON.parse(await readFile(timingPath,'utf8')) as {sceneStarts:number[]};
      fullNarrationTiming(audio.durationSeconds,cached.sceneStarts,signCount,REELS_FPS);
      return {...audio,sceneStarts:cached.sceneStarts,timingPath};
    }catch{/* Timing cache is validated against this exact waveform and transcript. */}
    const manifest=`${timingPath}.manifest.json`;
    try{
      const scale = audio.durationSeconds / raw.durationSeconds;
      const rawGap = MIN_REELS_SCENE_AUDIO_GAP_SECONDS / scale;

      let sceneStarts: number[];
      if (scale < 0.999) {
        try {
          const rawStarts = input.align
            ? await input.align(raw.path, scenes, manifest)
            : await alignOnActions(raw.path, scenes, manifest, raw.durationSeconds, rawGap);
          sceneStarts = rawStarts.map((start, idx) => idx === 0 ? 0.0 : Number((start * scale).toFixed(3)));
        } catch {
          // Fallback: try aligning on tempo audio directly
          const tempoStarts = input.align
            ? await input.align(audio.path, scenes, manifest)
            : await alignOnActions(audio.path, scenes, manifest, audio.durationSeconds, MIN_REELS_SCENE_AUDIO_GAP_SECONDS);
          sceneStarts = tempoStarts;
        }
      } else {
        sceneStarts = input.align
          ? await input.align(audio.path, scenes, manifest)
          : await alignOnActions(audio.path, scenes, manifest, audio.durationSeconds, MIN_REELS_SCENE_AUDIO_GAP_SECONDS);
      }
      fullNarrationTiming(audio.durationSeconds,sceneStarts,12,REELS_FPS);
      await writeFile(`${timingPath}.tmp`,JSON.stringify({sceneStarts}),{mode:0o600});
      await rename(`${timingPath}.tmp`,timingPath);
      return {...audio,sceneStarts,timingPath};
    }catch(error){
      lastError=error;
      if(error instanceof Error && error.message.includes('GitHub Actions')) throw error;
      force=true;
      if(audio.path !== raw.path) await rm(audio.path,{force:true}).catch(()=>{});
      await rm(manifest,{force:true}).catch(()=>{});
      await rm(`${manifest}.aligned.json`,{force:true}).catch(()=>{});
      if(attempt<3){
        console.warn(`[createFullNarration] Konuşma zamanlaması doğrulanamadı (deneme ${attempt}/3). Bozuk ses adayı geçersiz kılındı, yeni TTS isteği yapılıyor: ${error instanceof Error?error.message:String(error)}`);
      }
    }
  }
  throw lastError;
}
