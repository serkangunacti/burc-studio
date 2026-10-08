import {describe,expect,it} from 'vitest';
import {parseVideoDuration} from './video-duration';

describe('yüklemeden önce gerçek MP4 süresi',()=>{
  it('ffprobe süresini sayı olarak döndürür',()=>{
    expect(parseVideoDuration('174.999\n')).toBe(174.999);
    expect(parseVideoDuration('175')).toBe(175);
  });
  it.each(['175.001','180','0','-1','NaN','Infinity','','N/A'])('geçersiz veya uzun videoyu reddeder: %s',value=>{
    expect(()=>parseVideoDuration(value)).toThrow();
  });
});
