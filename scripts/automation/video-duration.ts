import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {MAX_REELS_MP4_SECONDS} from '../../src/remotion/reels';

const execFileAsync=promisify(execFile);

export function parseVideoDuration(output:string):number {
  const duration=Number(output.trim());
  if(!Number.isFinite(duration)||duration<=0||duration>MAX_REELS_MP4_SECONDS) {
    throw new Error(`MP4 süresi geçersiz veya 178,9 saniyelik güvenli tavanı aşıyor: ${output.trim()} sn`);
  }
  return duration;
}

export async function probeVideoDuration(file:string):Promise<number> {
  const {stdout}=await execFileAsync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],{timeout:30_000});
  return parseVideoDuration(stdout);
}
