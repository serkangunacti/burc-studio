import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {decodeVoiceAsset} from './voice';
const data = Buffer.from('generated-mp3-test');
const clip = {base64:data.toString('base64'),sha256:createHash('sha256').update(data).digest('hex'),durationSeconds:3.72};
describe('özel konuşma varlığı',()=>{
  it('anahtar yoksa eski sessiz konuşma düzenini korur, varsa bir kez çözümler',()=>{
    expect(decodeVoiceAsset(undefined)).toBeNull();
    const decoded=decodeVoiceAsset(JSON.stringify({version:1,intro:clip,outro:clip}));
    expect(decoded?.intro).toEqual({data,durationSeconds:3.72});
  });
  it('bozulmuş veya çok uzun klibi sessizce başka sesle değiştirmez',()=>{
    expect(()=>decodeVoiceAsset(JSON.stringify({version:1,intro:{...clip,sha256:'a'.repeat(64)},outro:clip}))).toThrow('doğrulanamadı');
    expect(()=>decodeVoiceAsset(JSON.stringify({version:1,intro:{...clip,durationSeconds:10},outro:clip}))).toThrow();
  });
});
