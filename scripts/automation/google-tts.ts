import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GEMINI_TTS_MODEL = 'gemini-3.8-flash-tts';
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`;

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
    if ([...text].length > 700) {
      return [...text].slice(0, 695).join('') + '...';
    }
    return text;
  }

  const text = `${sign.signName}. ${short}`.normalize('NFC');
  if ([...text].length > 300) throw new Error(`${sign.signName}: ses metni 300 karakteri aşıyor; metin kesilmedi`);
  return text;
}

export function introNarrationText(reels?: { audience?: string; dateLabel?: string; hook?: string }): string {
  return 'Canlarım ciğerlerim, günün enerjilerine hazır mısınız? Yıldızlar bakalım bugün bize neler fısıldıyor...';
}

export function outroNarrationText(): string {
  return 'Yarın yepyeni yorumlarla yine buradayız canlarım, kendinize çok iyi bakın!';
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
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60) {
    throw new Error('Servisin konuşma süresi geçersiz');
  }
  return duration;
}

export function createGoogleNarrator(options: {
  apiKey?: string;
  cacheDir?: string;
  audience?: 'kadin' | 'erkek';
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}) {
  const apiKey = options.apiKey || process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const cacheDir = options.cacheDir || '.cache/voice';
  const fetchImpl = options.fetchImpl || fetch;

  const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

  return {
    async speak(rawText: string): Promise<NarrationClip> {
      const text = rawText.trim().normalize('NFC');
      if (!text || [...text].length > 750) throw new Error('Ses metni 1–750 karakter olmalı');
      if (!apiKey) throw new Error('Google Gemini TTS API anahtarı tanımlı değil');

      await mkdir(cacheDir, { recursive: true });
      const key = hash(JSON.stringify({ text, model: GEMINI_TTS_MODEL, engine: 'gemini-tts-v2' }));
      const audioPath = path.join(cacheDir, `${key}.wav`);

      // 1. Önbellek kontrolü
      try {
        const cachedData = await readFile(audioPath);
        const durationSeconds = wavDuration(cachedData);
        options.log?.(`Ses önbellekten alındı: ${key.slice(0, 8)} (${durationSeconds.toFixed(2)} sn)`);
        return { data: cachedData, durationSeconds, path: audioPath, cached: true };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }

      // 2. Google Gemini TTS API çağrısı (rate-limit / backoff destekli)
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
        },
      };

      const url = `${GEMINI_API_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
      const maxRetries = 4;
      let lastError: Error | null = null;
      let res: Response | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delayMs = Math.min(1000 * Math.pow(2, attempt), 10_000);
            options.log?.(`Google Gemini TTS yeniden deneniyor (${attempt}/${maxRetries - 1}), bekleme: ${delayMs}ms`);
            await new Promise((r) => setTimeout(r, delayMs));
          }

          res = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30_000),
          });

          if (res.status === 429 || res.status >= 500) {
            const errText = await res.text();
            lastError = new Error(`Google Gemini TTS HTTP ${res.status}: ${errText.slice(0, 300)}`);
            continue;
          }

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Google Gemini TTS hatası HTTP ${res.status}: ${errorText.slice(0, 300)}`);
          }

          break;
        } catch (err) {
          lastError = err as Error;
          if (attempt === maxRetries - 1) throw lastError;
        }
      }

      if (!res || !res.ok) {
        throw lastError || new Error('Google Gemini TTS isteği başarısız oldu');
      }

      const json = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: {
                mimeType?: string;
                data?: string;
              };
            }>;
          };
        }>;
      };

      const base64Data = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Data) {
        throw new Error('Google Gemini TTS geçerli ses verisi döndürmedi');
      }

      const data = Buffer.from(base64Data, 'base64');
      const durationSeconds = wavDuration(data);

      await writeFile(`${audioPath}.tmp`, data, { mode: 0o600 });
      await rename(`${audioPath}.tmp`, audioPath);

      options.log?.(`Google Gemini TTS ile ses hazırlandı: ${durationSeconds.toFixed(2)} sn`);
      // Rate-limit'e takılmamak için çağrılar arası 1.5 saniye soluklan
      await new Promise((r) => setTimeout(r, 1500));
      return { data, durationSeconds, path: audioPath, cached: false };
    },
  };
}
