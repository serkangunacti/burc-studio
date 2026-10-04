import {describe,expect,it} from 'vitest';
import {musicVolume,voiceTimeline} from './voice';
const voice = {intro:{file:'intro.mp3',durationSeconds:3.72},outro:{file:'outro.mp3',durationSeconds:3.12}};
describe('önbellekteki ses yerleşimi',()=>{
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
