import {describe,expect,it} from 'vitest';
import {parseVideoDuration} from './video-duration';

describe('yüklemeden önce gerçek MP4 süresi',()=>{
  it('ffprobe süresini sayı olarak döndürür',()=>{
    expect(parseVideoDuration('178.999\n')).toBe(178.999);
    expect(parseVideoDuration('178.9')).toBe(178.9);
  });
  it.each(['179.00','179.001','180','0','-1','NaN','Infinity','','N/A'])('geçersiz veya uzun videoyu reddeder: %s',value=>{
    expect(()=>parseVideoDuration(value)).toThrow();
  });
});
