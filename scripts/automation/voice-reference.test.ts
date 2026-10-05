import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {describe,expect,it} from 'vitest';
import {decodeReferenceChunks,loadVoiceReference} from './voice-reference';
const reference=Buffer.from('private reference WAV');
const packed=gzipSync(reference).toString('base64');
const sha256=createHash('sha256').update(reference).digest('hex');
describe('runner için gizli ses referansı',()=>{
  it('yalnız doğrulanmış parçalardan aynı referansı çözer',()=>{
    expect(decodeReferenceChunks([packed.slice(0,20),packed.slice(20)],sha256)).toEqual(reference);
    expect(()=>decodeReferenceChunks([packed],'0'.repeat(64))).toThrow('doğrulanamadı');
  });
  it('eksik veya bozulmuş parçayla başka bir sese geçmez',()=>{
    expect(()=>decodeReferenceChunks([packed,''],sha256)).toThrow();
    expect(()=>decodeReferenceChunks([packed.slice(4)],sha256)).toThrow();
    expect(()=>loadVoiceReference({})).toThrow('tanımlı değil');
  });
});
