import {describe,expect,it} from 'vitest';
import {musicVolume,voiceTimeline,narrationTiming,reelsFrameRanges,fullNarrationTiming} from './voice';
const voice = {intro:{file:'intro.mp3',durationSeconds:3.72},outro:{file:'outro.mp3',durationSeconds:3.12}};
describe('tam sesin sahne zamanlaması',()=>{
  it('178,5 saniyelik tam sesi 14 sahnede eksiksiz tek videoya yerleştirir',()=>{
    const timing=fullNarrationTiming(178.5,Array.from({length:14},(_,i)=>i*12.5),12,30);
    const full={full:{file:'full.wav',durationSeconds:178.5}};
    expect(reelsFrameRanges(12,timing,30,full)).toEqual([[0,5360]]);
    expect(musicVolume(2500,full,5361,30,timing)).toBe(.2);
  });
  it.each([178.501,179,Infinity,NaN,0])('geçersiz veya bütçeyi aşan tam sesi reddeder: %s',duration=>{
    expect(()=>fullNarrationTiming(duration,Array.from({length:14},(_,i)=>i*12),12,30)).toThrow();
  });
  it('eksik, ters ve tek karelik sahne sınırlarını reddeder',()=>{
    for(const starts of [[0,5],[0,10,9,15],[0,.01,10,15]])expect(()=>fullNarrationTiming(20,starts,2,30)).toThrow();
  });
});
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

describe('tek parça Shorts videosu',()=>{
  it('177 saniyeyi aşmayan videonun bütün karelerini tek dosyada tutar',()=>{
    const timing={introFrames:300,signFrames:[2200,2200],outroFrames:655};
    expect(reelsFrameRanges(2,timing,30)).toEqual([[0,5309]]);
  });
  it('3 dakikaya yaklaşan uzun içeriği parçalamak yerine durdurur',()=>{
    const narrated={intro:{file:'intro.wav',durationSeconds:10},outro:{file:'outro.wav',durationSeconds:5},signs:[{file:'a.wav',durationSeconds:90},{file:'b.wav',durationSeconds:90}]};
    const timing=narrationTiming(narrated,2,30);
    expect(timing).toEqual({introFrames:324,signFrames:[2733,2733],outroFrames:174});
    expect(()=>reelsFrameRanges(2,timing,30,narrated)).toThrow(/tek parça/);
  });
  it('varsayılan kısa videoyu da tek dosya olarak döndürür',()=>{
    expect(reelsFrameRanges(2,undefined,30)).toEqual([[0,419]]);
  });
  it('içerik tek videoya sığmıyorsa konuşmayı kesmek veya parçalamak yerine hata verir',()=>{
    const narrated={intro:{file:'i.wav',durationSeconds:3},outro:{file:'o.wav',durationSeconds:3},signs:[{file:'a.wav',durationSeconds:176}]};
    const timing=narrationTiming(narrated,1,30);
    expect(()=>reelsFrameRanges(1,timing,30,narrated)).toThrow(/tek parça/);
  });
});
