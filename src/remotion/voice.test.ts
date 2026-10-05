import {describe,expect,it} from 'vitest';
import {musicVolume,voiceTimeline,narrationTiming} from './voice';
const voice = {intro:{file:'intro.mp3',durationSeconds:3.72},outro:{file:'outro.mp3',durationSeconds:3.12}};
describe('önbellekteki ses yerleşimi',()=>{
  it('burç konuşmaları bitmeden sonraki sahnenin geçişini başlatmaz',()=>{
    const narrated={...voice,signs:[{file:'koc.wav',durationSeconds:6.2},{file:'boga.wav',durationSeconds:7.64}]};
    const timing=narrationTiming(narrated,2,30);
    expect(timing).toEqual({introFrames:148,signFrames:[252,296],outroFrames:130});
    const timeline=voiceTimeline(narrated,781,30,timing);
    expect(timeline.signTracks).toEqual([{file:'koc.wav',from:163,durationInFrames:186},{file:'boga.wav',from:400,durationInFrames:230}]);
    expect(timeline.outroStart).toBe(666);
    expect(musicVolume(500,narrated,781,30,timing)).toBe(.2);
    expect(()=>narrationTiming(narrated,12,30)).toThrow();
  });
  it('her iki konuşmayı son sözcüğü kesmeden 59 sn videoya yerleştirir',()=>{
    expect(voiceTimeline(voice,1770,30)).toEqual({introFrames:112,outroFrames:94,outroStart:1676});
    expect(()=>voiceTimeline(voice,120,30)).toThrow('sığmıyor');
  });
  it('yalnız konuşurken müziği düşürür ve geçişte yumuşakça geri getirir',()=>{
    expect(musicVolume(0,undefined,1770,30)).toBe(1);
    expect(musicVolume(0,voice,1770,30)).toBe(.2);
    expect(musicVolume(118,voice,1770,30)).toBeCloseTo(.6);
    expect(musicVolume(500,voice,1770,30)).toBe(1);
    expect(musicVolume(1670,voice,1770,30)).toBeCloseTo(.6);
    expect(musicVolume(1769,voice,1770,30)).toBe(.2);
  });
});
