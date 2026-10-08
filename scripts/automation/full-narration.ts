import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import type {ReelsProps} from '../../src/remotion/slide-types';
import {fullNarrationTiming} from '../../src/remotion/voice';
import {MIN_REELS_SCENE_AUDIO_GAP_SECONDS,REELS_FPS} from '../../src/remotion/reels';
import {introNarrationText, narrationText, outroNarrationText, wavDuration, type NarrationClip} from './google-tts';

const execFileAsync=promisify(execFile);
export const NARRATION_BUDGET_SECONDS=178.5;
export type FullNarration=NarrationClip & {sceneStarts:number[];timingPath:string};

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

async function alignOnActions(audio:string,scenes:string[],manifest:string,durationSeconds:number):Promise<number[]>{
  if(process.env.GITHUB_ACTIONS!=='true')throw new Error('Konuşma analizi yalnız GitHub Actions üzerinde çalışır');
  await writeFile(manifest,JSON.stringify({scenes,durationSeconds,minimumSceneGapSeconds:MIN_REELS_SCENE_AUDIO_GAP_SECONDS}),{mode:0o600});
  const output=`${manifest}.aligned.json`;
  await execFileAsync('python3',['scripts/automation/align-narration.py',audio,manifest,output],{timeout:15*60_000,maxBuffer:4*1024*1024});
  return (JSON.parse(await readFile(output,'utf8')) as {sceneStarts:number[]}).sceneStarts;
}

export async function createFullNarration(reels:ReelsProps,input:{
  narrator:{speak:(text:string)=>Promise<NarrationClip>};
  cacheDir:string;
  align?:(audio:string,scenes:string[],manifest:string)=>Promise<number[]>;
}):Promise<FullNarration>{
  if(reels.signs.length!==12)throw new Error('Tam ses için 12 burç yorumu zorunlu');
  const scenes=[introNarrationText(reels),...reels.signs.map(narrationText),outroNarrationText()].map(text=>text.trim().normalize('NFC'));
  const raw=await input.narrator.speak(scenes.join('\n\n'));
  const audio=await fitNarrationToBudget(raw.path,input.cacheDir);
  const key=createHash('sha256').update(audio.data).update(JSON.stringify({scenes,engine:'stable-ts-small-tr-v1'})).digest('hex');
  const timingPath=path.join(input.cacheDir,`${key}-timing.json`);
  try{
    const cached=JSON.parse(await readFile(timingPath,'utf8')) as {sceneStarts:number[]};
    fullNarrationTiming(audio.durationSeconds,cached.sceneStarts,12,REELS_FPS);
    return {...audio,sceneStarts:cached.sceneStarts,timingPath};
  }catch{/* Timing cache is validated against this exact waveform and transcript. */}
  const manifest=`${timingPath}.manifest.json`;
  const sceneStarts=input.align
    ? await input.align(audio.path,scenes,manifest)
    : await alignOnActions(audio.path,scenes,manifest,audio.durationSeconds);
  fullNarrationTiming(audio.durationSeconds,sceneStarts,12,REELS_FPS);
  await writeFile(`${timingPath}.tmp`,JSON.stringify({sceneStarts}),{mode:0o600});
  await rename(`${timingPath}.tmp`,timingPath);
  return {...audio,sceneStarts,timingPath};
}
