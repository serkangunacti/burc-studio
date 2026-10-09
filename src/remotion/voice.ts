import {INTRO_FRAMES,MAX_REELS_NARRATION_SECONDS,MAX_REELS_FRAMES,REELS_FPS,OUTRO_FRAMES,reelsDurationInFrames,SIGN_FRAMES,TRANSITION_FRAMES} from './reels';
import type {ReelsSceneTiming} from './slide-types';
export type VoiceTrack = { file: string; durationSeconds: number };
export type LegacyReelsVoice = { intro: VoiceTrack; outro: VoiceTrack; signs?:VoiceTrack[] };
export type ReelsVoice = LegacyReelsVoice | {full:VoiceTrack};
type PositionedVoice = {file:string;from:number;durationInFrames:number};

export function narrationTiming(voice:LegacyReelsVoice,signCount:number,fps:number):ReelsSceneTiming {
  if(!voice.signs || voice.signs.length!==signCount)throw new Error('Burç konuşmaları eksik');
  const clips=[voice.intro,...voice.signs,voice.outro];
  if(clips.some(clip=>!Number.isFinite(clip.durationSeconds)||clip.durationSeconds<=0))throw new Error('Konuşma süresi geçersiz');
  const lead=Math.max(6,Math.round(fps*.3));
  const tail=Math.max(6,Math.round(fps*.3));
  const timing: ReelsSceneTiming = {
    introFrames:Math.max(INTRO_FRAMES,Math.ceil(voice.intro.durationSeconds*fps)+tail+TRANSITION_FRAMES),
    signFrames:voice.signs.map(clip=>Math.max(SIGN_FRAMES,Math.ceil(clip.durationSeconds*fps)+lead+tail+TRANSITION_FRAMES)),
    outroFrames:Math.max(OUTRO_FRAMES,Math.ceil(voice.outro.durationSeconds*fps)+TRANSITION_FRAMES+tail),
  };
  return timing;
}

export function voiceTimeline(voice: LegacyReelsVoice, frames: number, fps: number,timing?:ReelsSceneTiming) {
  const introFrames = Math.ceil(voice.intro.durationSeconds * fps);
  const outroFrames = Math.ceil(voice.outro.durationSeconds * fps);
  if (introFrames + outroFrames >= frames) throw new Error('Konuşma videoya sığmıyor');
  if(!voice.signs)return { introFrames, outroFrames, outroStart: frames - outroFrames };
  if(!timing || voice.signs.length!==timing.signFrames.length)throw new Error('Burç konuşma zamanlaması eksik');
  const signTracks:PositionedVoice[]=[];
  const lead = Math.max(3, Math.min(Math.round(fps * 0.3), ...timing.signFrames.map((f, i) => f - Math.ceil(voice.signs![i].durationSeconds * fps) - TRANSITION_FRAMES)));
  let sceneStart=timing.introFrames-TRANSITION_FRAMES;
  voice.signs.forEach((clip,index)=>{
    const from=sceneStart+lead;
    const durationInFrames=Math.ceil(clip.durationSeconds*fps);
    if(from+durationInFrames>sceneStart+timing.signFrames[index]-TRANSITION_FRAMES)throw new Error('Burç konuşması sahneye sığmıyor');
    signTracks.push({file:clip.file,from,durationInFrames});
    sceneStart+=timing.signFrames[index]-TRANSITION_FRAMES;
  });
  const outroStart=sceneStart+TRANSITION_FRAMES;
  if(outroStart+outroFrames>frames)throw new Error('Kapanış konuşması videoya sığmıyor');
  return {introFrames,outroFrames,outroStart,signTracks};
}

export function musicVolume(frame: number, voice: ReelsVoice | undefined, frames: number, fps: number,timing?:ReelsSceneTiming): number {
  if (!voice) return 1;
  if ('full' in voice) return frame < Math.ceil(voice.full.durationSeconds*fps) ? .2 : 1;
  const { introFrames, outroStart,signTracks } = voiceTimeline(voice, frames, fps,timing);
  const ramp = Math.round(fps * 0.4);
  if(signTracks){
    const windows=[{from:0,durationInFrames:introFrames},...signTracks,{from:outroStart,durationInFrames:frames-outroStart}];
    const distance=Math.min(...windows.map(track=>frame<track.from ? track.from-frame : frame>=track.from+track.durationInFrames ? frame-track.from-track.durationInFrames : 0));
    return .2+.8*Math.min(1,distance/ramp);
  }
  if (frame < introFrames || frame >= outroStart) return 0.2;
  return 0.2 + 0.8 * Math.min(1, (frame - introFrames) / ramp, (outroStart - frame) / ramp);
}

// One continuous MP4 only. Overlength content fails without cutting frames or narration.
export function reelsFrameRanges(signCount:number,timing:ReelsSceneTiming|undefined,fps:number,voice?:ReelsVoice):[number,number][] {
  if(!Number.isFinite(fps)||fps<=0)throw new Error('Video kare hızı geçersiz');
  const total=reelsDurationInFrames(signCount,timing);
  const limit=Math.floor(MAX_REELS_FRAMES*fps/REELS_FPS);
  if(total>limit)throw new Error('Video tek parça halinde 3 dakikanın altında oluşturulamıyor; içerik ve seslendirme kesilmedi');
  if(voice){
    if('full' in voice){
      if(!Number.isFinite(voice.full.durationSeconds)||voice.full.durationSeconds<=0||voice.full.durationSeconds>MAX_REELS_NARRATION_SECONDS||Math.ceil(voice.full.durationSeconds*fps)>total)throw new Error('Tam konuşma videoya sığmıyor');
    }else voiceTimeline(voice,total,fps,timing);
  }
  return [[0,total-1]];
}

export function fullNarrationTiming(durationSeconds:number,sceneStarts:number[],signCount:number,fps:number):ReelsSceneTiming{
  if(!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>MAX_REELS_NARRATION_SECONDS||!Number.isFinite(fps)||fps<=0)throw new Error('Tam konuşma süresi geçersiz veya 178,5 sn bütçesini aşıyor');
  if(!Array.isArray(sceneStarts)||sceneStarts.length!==signCount+2||sceneStarts[0]!==0||sceneStarts.some((s,i)=>!Number.isFinite(s)||s<0||s>=durationSeconds||(i>0&&s<=sceneStarts[i-1])))throw new Error('Tam konuşma sahne zamanlaması geçersiz');
  const starts=sceneStarts.map(s=>Math.round(s*fps));
  const total=Math.ceil(durationSeconds*fps)+Math.ceil(.2*fps);
  const scenes=starts.map((start,index)=>index===starts.length-1?total-start:starts[index+1]-start+TRANSITION_FRAMES);
  const timing={introFrames:scenes[0],signFrames:scenes.slice(1,-1),outroFrames:scenes.at(-1)!};
  if(reelsDurationInFrames(signCount,timing)>Math.floor(MAX_REELS_FRAMES*fps/REELS_FPS))throw new Error('Tam konuşma zamanlaması 178,9 sn video bütçesini aşıyor');
  return timing;
}
