import {INTRO_FRAMES,OUTRO_FRAMES,SIGN_FRAMES,TRANSITION_FRAMES} from './reels';
import type {ReelsSceneTiming} from './slide-types';
export type VoiceTrack = { file: string; durationSeconds: number };
export type ReelsVoice = { intro: VoiceTrack; outro: VoiceTrack; signs?:VoiceTrack[] };
type PositionedVoice = {file:string;from:number;durationInFrames:number};

export function narrationTiming(voice:ReelsVoice,signCount:number,fps:number):ReelsSceneTiming {
  if(!voice.signs || voice.signs.length!==signCount)throw new Error('Burç konuşmaları eksik');
  const clips=[voice.intro,...voice.signs,voice.outro];
  if(clips.some(clip=>!Number.isFinite(clip.durationSeconds)||clip.durationSeconds<=0))throw new Error('Konuşma süresi geçersiz');
  const tail=Math.ceil(fps*.7);
  return {
    introFrames:Math.max(INTRO_FRAMES,Math.ceil(voice.intro.durationSeconds*fps)+tail+TRANSITION_FRAMES),
    signFrames:voice.signs.map(clip=>Math.max(SIGN_FRAMES,Math.ceil(clip.durationSeconds*fps)+fps+tail+TRANSITION_FRAMES)),
    outroFrames:Math.max(OUTRO_FRAMES,Math.ceil(voice.outro.durationSeconds*fps)+TRANSITION_FRAMES+tail),
  };
}

export function voiceTimeline(voice: ReelsVoice, frames: number, fps: number,timing?:ReelsSceneTiming) {
  const introFrames = Math.ceil(voice.intro.durationSeconds * fps);
  const outroFrames = Math.ceil(voice.outro.durationSeconds * fps);
  if (introFrames + outroFrames >= frames) throw new Error('Konuşma videoya sığmıyor');
  if(!voice.signs)return { introFrames, outroFrames, outroStart: frames - outroFrames };
  if(!timing || voice.signs.length!==timing.signFrames.length)throw new Error('Burç konuşma zamanlaması eksik');
  const signTracks:PositionedVoice[]=[];
  let sceneStart=timing.introFrames-TRANSITION_FRAMES;
  voice.signs.forEach((clip,index)=>{
    const from=sceneStart+fps;
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
  const { introFrames, outroStart,signTracks } = voiceTimeline(voice, frames, fps,timing);
  // Konuşmada müziği düşür, ardından 0,4 sn içinde eski seviyesine getir.
  const ramp = Math.round(fps * 0.4);
  if(signTracks){
    const windows=[{from:0,durationInFrames:introFrames},...signTracks,{from:outroStart,durationInFrames:frames-outroStart}];
    const distance=Math.min(...windows.map(track=>frame<track.from ? track.from-frame : frame>=track.from+track.durationInFrames ? frame-track.from-track.durationInFrames : 0));
    return .2+.8*Math.min(1,distance/ramp);
  }
  if (frame < introFrames || frame >= outroStart) return 0.2;
  return 0.2 + 0.8 * Math.min(1, (frame - introFrames) / ramp, (outroStart - frame) / ramp);
}
