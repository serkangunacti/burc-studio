import {describe,expect,it} from 'vitest';
import {musicVolume,voiceTimeline,narrationTiming,reelsFrameRanges} from './voice';
const voice = {intro:{file:'intro.mp3',durationSeconds:3.72},outro:{file:'outro.mp3',durationSeconds:3.12}};
describe('önbellekteki ses yerleşimi',()=>{
  it('burç konuşmaları bitmeden sonraki sahnenin geçişini başlatmaz',()=>{
    const narrated={...voice,signs:[{file:'koc.wav',durationSeconds:6.2},{file:'boga.wav',durationSeconds:7.64}]};
    const timing=narrationTiming(narrated,2,30);
    expect(timing).toEqual({introFrames:136,signFrames:[219,263],outroFrames:118});
    const timeline=voiceTimeline(narrated,691,30,timing);
    expect(timeline.signTracks).toEqual([{file:'koc.wav',from:130,durationInFrames:186},{file:'boga.wav',from:334,durationInFrames:230}]);
    expect(timeline.outroStart).toBe(588);
    expect(musicVolume(400,narrated,691,30,timing)).toBe(.2);
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


describe('kesilmeden Shorts parçaları',()=>{
  it('uzun konuşmanın özgün zamanlamasını korur ve yalnız sessiz sahne sınırlarından böler',()=>{
    const narrated={intro:{file:'intro.wav',durationSeconds:10},outro:{file:'outro.wav',durationSeconds:5},signs:[{file:'a.wav',durationSeconds:90},{file:'b.wav',durationSeconds:90}]};
    const timing=narrationTiming(narrated,2,30);
    expect(timing).toEqual({introFrames:324,signFrames:[2733,2733],outroFrames:174});
    const ranges=reelsFrameRanges(2,timing,30,narrated);
    expect(ranges).toEqual([[0,3026],[3027,5918]]);
    const timeline=voiceTimeline(narrated,5919,30,timing);
    const tracks=[{from:0,durationInFrames:300},...timeline.signTracks!,{from:timeline.outroStart,durationInFrames:150}];
    for(const track of tracks)expect(ranges.filter(([start,end])=>start<=track.from&&end>=track.from+track.durationInFrames-1)).toHaveLength(1);
  });
  it('tek videoya sığan içeriği bölmez',()=>{
    expect(reelsFrameRanges(2,undefined,30)).toEqual([[0,419]]);
  });
  it('tek bir konuşma güvenli tavana sığmıyorsa içeriği kesmek yerine hata verir',()=>{
    const narrated={intro:{file:'i.wav',durationSeconds:3},outro:{file:'o.wav',durationSeconds:3},signs:[{file:'a.wav',durationSeconds:176}]};
    const timing=narrationTiming(narrated,1,30);
    expect(()=>reelsFrameRanges(1,timing,30,narrated)).toThrow(/sığmıyor/);
  });
});
