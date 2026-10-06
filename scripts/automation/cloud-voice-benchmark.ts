// Only invoked by the manual GitHub Actions benchmark; never starts a local model.
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {getDb,closeDb} from '../../src/db/client';
import {sql} from 'drizzle-orm';
import {loadVoiceReference} from './voice-reference';
import {narrationText} from './narration';
async function main(){
  if(process.env.GITHUB_ACTIONS!=='true')throw new Error('Bu ölçüm yalnız GitHub bulut runnerında çalışır');
  const db=getDb();
  try{
    const result=await db.execute(sql`select short from readings where date='2026-10-06' and kind='horoscope' and audience='kadin' and sign='akrep' and is_current=true limit 1`);
    if(!result.rows.length)throw new Error('Günün Akrep yorumu yok');
    const text=narrationText({signName:'Akrep',short:String(result.rows[0].short)}),reference=loadVoiceReference();
    const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
    const key=hash(JSON.stringify({text,settings:{language:'tr',exaggeration:.5,temperature:.8,seed:20261002,cfgWeight:.3},reference:hash(reference),host:'https://resembleai-chatterbox-multilingual-tts-v3.hf.space'}));
    await mkdir('.cache/serkanses',{recursive:true});
    await writeFile('/tmp/serkanses-reference.wav',reference,{mode:0o600});
    await writeFile('/tmp/serkanses-benchmark.json',JSON.stringify({text,key}),{mode:0o600});
    console.log('Bulut ölçümü için tek eksik yorum ve onaylı referans hazır.');
  }finally{await closeDb();}
}
main().catch(()=>{console.error('Bulut ölçümü hazırlığı başarısız');process.exitCode=1;});
