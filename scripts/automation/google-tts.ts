import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {nextGoogleDailyQuotaReset} from './quota-reset.mjs';

const GEMINI_TTS_MODEL = 'gemini-3.8-flash-lite-tts';

export type NarrationClip = {
  data: Buffer;
  durationSeconds: number;
  path: string;
  cached: boolean;
};

export function narrationText(sign: {
  signName: string;
  short: string;
  body?: string;
  headline?: string;
  scores?: { love: number; money: number; health: number };
  luckyColor?: { name: string; hex?: string };
  luckyNumber?: number;
}): string {
  let short = sign.short.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim();
  const prefix = new RegExp(`^${sign.signName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:.!,—–-]\\s*`, 'iu');
  short = short.replace(prefix, '').trim();
  if (!short && !sign.body) throw new Error(`${sign.signName}: kısa yorum boş`);

  if (sign.body) {
    const rawBody = sign.body.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim();
    const cleanBody = rawBody.replace(prefix, '').trim();
    const parts: string[] = [`Sevgili ${sign.signName} burçları;`];
    if (sign.headline) {
      parts.push(`${sign.headline.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim()}.`);
    }
    parts.push(cleanBody);
    if (sign.luckyNumber && sign.luckyColor) {
      parts.push(`Şanslı sayınız ${sign.luckyNumber}, uğurlu renginiz ${sign.luckyColor.name}!`);
    }
    const text = parts.join(' ').normalize('NFC');
    return text;
  }

  return `${sign.signName}. ${short}`.normalize('NFC');
}

export function introNarrationText(reels?: { audience?: string; dateLabel?: string; hook?: string; element?: string }): string {
  if (reels?.element) {
    const el = reels.element.toLowerCase();
    if (el === 'ates') return 'Ateş grubu burçları; Koç, Aslan ve Yay! Günün enerjilerine hazır mısınız? Yıldızların mesajlarına hep birlikte bakalım...';
    if (el === 'toprak') return 'Toprak grubu burçları; Boğa, Başak ve Oğlak! Günün kararlı enerjilerine hazır mısınız? Yıldızların mesajlarına hep birlikte bakalım...';
    if (el === 'hava') return 'Hava grubu burçları; İkizler, Terazi ve Kova! Günün hareketli enerjilerine hazır mısınız? Yıldızların mesajlarına hep birlikte bakalım...';
    if (el === 'su') return 'Su grubu burçları; Yengeç, Akrep ve Balık! Günün sezgisel enerjilerine hazır mısınız? Yıldızların mesajlarına hep birlikte bakalım...';
  }
  return 'Kozmik yolcular, günün enerjilerine hazır mısınız? Yıldızlar bakalım bugün bize neler fısıldıyor...';
}

export function outroNarrationText(reels?: { audience?: string; element?: string }): string {
  if (reels?.element) {
    return 'Günün element yorumları böyleydi. Burcunu veya yükselenini dinlemesini istediğin arkadaşınla paylaşmayı ve takip etmeyi unutma!';
  }
  return 'Yarın yepyeni yorumlarla yine buradayız canlarım, kendinize çok iyi bakın! Takip etmeyi unutmayın!';
}

export function createWavFromPcm(pcm: Buffer, sampleRate = 24000, channels = 1): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34); // 16-bit
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function wavDuration(bytes: Buffer): number {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Servis geçerli WAV döndürmedi');
  }
  let byteRate = 0;
  let dataBytes = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > bytes.length) throw new Error('Servisin ses dosyası eksik');
    if (id === 'fmt ' && size >= 16) byteRate = bytes.readUInt32LE(start + 8);
    if (id === 'data') dataBytes = size;
    offset = start + size + (size % 2);
  }
  const duration = dataBytes / byteRate;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1800) {
    throw new Error('Servisin konuşma süresi geçersiz');
  }
  return duration;
}

export function createGoogleNarrator(options: {
  apiKey?: string;
  apiKeys?: string[];
  cacheDir?: string;
  audience?: 'kadin' | 'erkek';
  voiceName?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (message: string) => void;
}) {
  const apiKeys = [...new Set((options.apiKeys ?? [options.apiKey, process.env.GOOGLE_TTS_API_KEY, process.env.GOOGLE_GENERATIVE_AI_API_KEY, process.env.GOOGLE_TTS_API_KEY_3])
    .filter((k): k is string => Boolean(k?.trim())).flatMap(k=>k.split(/[,;\s]+/)).filter(Boolean))];
  const cacheDir = options.cacheDir || '.cache/voice';
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now ?? (() => new Date());
  const blockedUntil = new Map<string, number>();
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const sanitize = (value: string) => apiKeys.reduce((s,key)=>s.replaceAll(key,'[gizli]'),value);

  const voiceName = options.voiceName ?? (options.audience === 'erkek' ? 'Fenrir' : 'Aoede');

  return {
    async speak(rawText: string, opts?: { force?: boolean }): Promise<NarrationClip> {
      const text = rawText.trim().normalize('NFC');
      if (!text || [...text].length > 20_000) throw new Error('Ses metni 1–20000 karakter olmalı; metin kesilmedi');
      const key = hash(JSON.stringify({text,model:GEMINI_TTS_MODEL,voiceName,engine:'gemini-full-tts-v4-natural'}));
      await mkdir(cacheDir, {recursive:true});
      const audioPath = path.join(cacheDir, `${key}.wav`);
      if (!opts?.force) {
        try {
          const data = await readFile(audioPath);
          return {data, durationSeconds:wavDuration(data), path:audioPath, cached:true};
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') options.log?.('Geçersiz tam ses önbelleği yeniden üretilecek');
        }
      }
      if (!apiKeys.length) throw new Error('Google Gemini TTS API anahtarı tanımlı değil');
      const payload = {
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`;
      let response: Response | undefined;
      let lastError = new Error('Google Gemini TTS anahtarlarının kotası henüz açılmadı');
      keyLoop: for (const [index, apiKey] of apiKeys.entries()) {
        if ((blockedUntil.get(apiKey) ?? 0) > now().getTime()) continue;
        for (let attempt=0; attempt<3; attempt++) {
          try {
            response = await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(240_000)});
          } catch {
            lastError = new Error('Google Gemini TTS bağlantısı kurulamadı veya zaman aşımına uğradı');
            if (attempt<2) { await new Promise(r=>setTimeout(r,1000*(attempt+1))); continue; }
            continue keyLoop;
          }
          if (response.ok) break keyLoop;
          const body = sanitize(await response.text());
          lastError = new Error(`Google Gemini TTS hatası HTTP ${response.status}: ${body.slice(0,300)}`);
          const keyError = response.status===401 || response.status===403 || (response.status===400 && /API.?key|API_KEY_INVALID/i.test(body));
          if (response.status===429 || keyError) {
            const retrySeconds = Number(body.match(/"retryDelay"\s*:\s*"([\d.]+)s"/)?.[1] ?? 60);
            blockedUntil.set(apiKey, keyError || /PerDay|per_day|daily|günlük/i.test(body) ? nextGoogleDailyQuotaReset(now()).getTime() : now().getTime()+Math.max(1,retrySeconds)*1000);
            options.log?.(`TTS anahtar ${index+1}: HTTP ${response.status}; sıradaki anahtara geçiliyor`);
            continue keyLoop;
          }
          if (response.status>=500 && attempt<2) { await new Promise(r=>setTimeout(r,1000*(attempt+1))); continue; }
          throw lastError;
        }
      }
      if (!response?.ok) throw lastError;
      const json = await response.json() as {candidates?:{content?:{parts?:{inlineData?:{data?:string;mimeType?:string}}[]}}[]};
      const inline = json.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.data)?.inlineData;
      if (!inline?.data) throw new Error('Google Gemini TTS geçerli ses verisi döndürmedi');
      let data: Buffer = Buffer.from(inline.data,'base64');
      if (data.toString('ascii',0,4)!=='RIFF') {
        const sampleRate = Number(inline.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000);
        data = createWavFromPcm(data,sampleRate);
      }
      const durationSeconds = wavDuration(data);
      await writeFile(`${audioPath}.tmp`, data, {mode:0o600});
      await rename(`${audioPath}.tmp`,audioPath);
      options.log?.(`Tam video tek TTS isteğiyle seslendirildi: ${durationSeconds.toFixed(2)} sn`);
      return {data,durationSeconds,path:audioPath,cached:false};
    },
  };
}
