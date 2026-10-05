import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const APPROVED_SHA256='421ffce7125ca2bb286519a5f45d98a8d2db4027b730ebeb61e75fee057e5016';
const PARTS=19;

// Encrypted GitHub secrets preserve the original reference without public storage.
export function decodeReferenceChunks(chunks:string[],expectedHash:string):Buffer {
  if(!chunks.length||chunks.some(chunk=>!chunk||!/^[A-Za-z0-9+/]+={0,2}$/.test(chunk)))throw new Error('Ses referansı parçaları geçersiz');
  const encoded=chunks.join('');
  if(encoded.length>2_000_000)throw new Error('Ses referansı boyutu geçersiz');
  const reference=gunzipSync(Buffer.from(encoded,'base64'),{maxOutputLength:2_000_000});
  if(createHash('sha256').update(reference).digest('hex')!==expectedHash)throw new Error('Kişisel ses referansı doğrulanamadı');
  return reference;
}

export function loadVoiceReference(env:NodeJS.ProcessEnv=process.env):Buffer {
  const chunks=Array.from({length:PARTS},(_,index)=>env[`SERKANSES_REFERENCE_${String(index+1).padStart(2,'0')}`]);
  if(chunks.some(chunk=>!chunk))throw new Error('Serkanses referansı tanımlı değil; başka ses kullanılmadı');
  return decodeReferenceChunks(chunks as string[],APPROVED_SHA256);
}
