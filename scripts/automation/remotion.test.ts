import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {sampleReels} from '../../src/remotion/fixtures';
import {createWavFromPcm} from './google-tts';
import {reelsDurationInFrames} from '../../src/remotion/reels';
import {openRemotionRenderers} from './remotion';

const fake=vi.hoisted(()=>({dir:'',duration:20.2,render:vi.fn(),upload:vi.fn(),narrate:vi.fn()}));
vi.mock('@remotion/bundler',()=>({bundle:async()=>fake.dir}));
vi.mock('@remotion/renderer',()=>({
  openBrowser:async()=>({close:async()=>{}}),renderStill:vi.fn(),
  selectComposition:async({inputProps}:{inputProps:{reels:ReturnType<typeof sampleReels>}})=>({durationInFrames:reelsDurationInFrames(12,inputProps.reels.sceneTiming)}),
  renderMedia:async(options:{outputLocation:string})=>{fake.render(options);await writeFile(options.outputLocation,Buffer.from('encoded MP4'));},
}));
vi.mock('./video-duration',()=>({probeVideoDuration:async()=>fake.duration}));
afterEach(async()=>{await rm(fake.dir,{recursive:true,force:true});vi.clearAllMocks();});

describe('render sonrası yükleme kapısı',()=>{
  it.each([20.2,178.9,178.901])('tek tam ses kullanır ve ffprobe ölçümü %s olan MP4 üzerinde sınırı uygular',async duration=>{
    fake.dir=await mkdtemp(path.join(os.tmpdir(),'remotion-test-'));await mkdir(path.join(fake.dir,'public'));fake.duration=duration;
    fake.upload.mockResolvedValue('https://blob.test/video.mp4');
    fake.narrate.mockResolvedValue({data:createWavFromPcm(Buffer.alloc(20*48000)),durationSeconds:20,sceneStarts:Array.from({length:14},(_,i)=>i*1.4)});
    const renderers=await openRemotionRenderers({music:{render:async()=>Buffer.from('music'),close:async()=>{}},upload:fake.upload,narrateFull:fake.narrate,log:()=>{}});
    try{
      const job=renderers.renderReels({templateVersion:'pastel@2',reels:sampleReels(),musicSeed:1,name:'full'});
      if(duration>178.9){await expect(job).rejects.toThrow(/178,9/);expect(fake.upload).not.toHaveBeenCalled();}
      else{
        expect(await job).toMatchObject({durationSeconds:duration,videoUrl:'https://blob.test/video.mp4'});
        expect(fake.upload).toHaveBeenCalledTimes(1);
        expect(fake.render.mock.calls[0][0].inputProps.voice).toEqual({full:{file:'voice-full-full.wav',durationSeconds:20}});
        expect(fake.render.mock.calls[0][0].frameRange).toEqual([0,605]);
      }
      expect(fake.narrate).toHaveBeenCalledTimes(1);expect(fake.render).toHaveBeenCalledTimes(1);
    }finally{await renderers.close();}
  });
});
