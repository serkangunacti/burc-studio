import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GEMINI_TTS_MODELS = [
  'gemini-3.8-flash-lite-tts',
  'gemini-2.5-flash-preview-tts',
  'gemini-3.8-flash-tts',
];

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
    const maxBodyChars = 110;
    let bodyText = cleanBody;
    if ([...bodyText].length > maxBodyChars) {
      const sentences = cleanBody.split(/(?<=[.!?])\s+/);
      let accumulated = '';
      for (const s of sentences) {
        if ([...(accumulated ? `${accumulated} ${s}` : s)].length <= maxBodyChars) {
          accumulated = accumulated ? `${accumulated} ${s}` : s;
        } else {
          break;
        }
      }
      bodyText = accumulated || [...cleanBody].slice(0, 105).join('') + '...';
    }
    parts.push(bodyText);
    if (sign.luckyNumber && sign.luckyColor) {
      parts.push(`Şanslı sayınız ${sign.luckyNumber}, uğurlu renginiz ${sign.luckyColor.name}!`);
    }
    const text = parts.join(' ').normalize('NFC');
    if ([...text].length > 185) {
      return [...text].slice(0, 180).join('') + '...';
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
  return 'Yarın yepyeni yorumlarla yine buradayız canlarım, kendinize çok iyi bakın! Takip etmeyi unutmayın!';
}

export function createWavFromPcm(pcm: Buffer, sampleRate = 24000, channels = 1): Buffer<any> {
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
  const apiKeys = [
    ...new Set(
      [options.apiKey, process.env.GOOGLE_TTS_API_KEY, process.env.GOOGLE_GENERATIVE_AI_API_KEY]
        .filter((k): k is string => Boolean(k?.trim()))
        .flatMap((k) => k.split(/[,;\s]+/))
        .map((k) => k.trim())
        .filter(Boolean)
    ),
  ];

  const cacheDir = options.cacheDir || '.cache/voice';
  const fetchImpl = options.fetchImpl || fetch;

  const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

  return {
    async speak(rawText: string): Promise<NarrationClip> {
      const text = rawText.trim().normalize('NFC');
      if (!text || [...text].length > 750) throw new Error('Ses metni 1–750 karakter olmalı');
      if (apiKeys.length === 0) throw new Error('Google Gemini TTS API anahtarı tanımlı değil');

      await mkdir(cacheDir, { recursive: true });
      const legacyKey = hash(JSON.stringify({ text, model: 'gemini-3.8-flash-tts', engine: 'gemini-tts-v2' }));
      const unifiedKey = hash(JSON.stringify({ text, engine: 'gemini-tts-v2' }));
      const legacyAudioPath = path.join(cacheDir, `${legacyKey}.wav`);
      const unifiedAudioPath = path.join(cacheDir, `${unifiedKey}.wav`);

      // 1. Önbellek kontrolü (hem yeni anahtar hem eski model önbelleği)
      for (const p of [unifiedAudioPath, legacyAudioPath]) {
        try {
          const cachedData = await readFile(p);
          const durationSeconds = wavDuration(cachedData);
          options.log?.(`Ses önbellekten alındı: ${path.basename(p, '.wav').slice(0, 8)} (${durationSeconds.toFixed(2)} sn)`);
          return { data: cachedData, durationSeconds, path: p, cached: true };
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            options.log?.(`Önbellekteki ses dosyası geçersiz (${path.basename(p)}): ${err instanceof Error ? err.message : String(err)}, yeniden üretilecek`);
          }
        }
      }

      // 2. Google Gemini TTS API çağrısı (çoklu API anahtarı ve model yedekleme)
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

      let res: Response | null = null;
      let lastError: Error | null = null;

      keyLoop: for (const apiKey of apiKeys) {
        for (const model of GEMINI_TTS_MODELS) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const maxRetries = 6;

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              if (attempt > 0) {
                const delayMs = Math.min(3000 * Math.pow(2, attempt - 1), 20000);
                options.log?.(`Google Gemini TTS (${model}) yeniden deneniyor (${attempt}/${maxRetries - 1}), bekleme: ${delayMs}ms`);
                await new Promise((r) => setTimeout(r, delayMs));
              }

              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              };

              res = await fetchImpl(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(45_000),
              });

              if (res.status === 429) {
                const errBody = await res.text().catch(() => '');
                const retryMatch = errBody.match(/"retryDelay":\s*"(\d+)s"/);
                const retrySec = retryMatch ? parseInt(retryMatch[1], 10) : 0;
                if (retrySec > 120) {
                  options.log?.(`Google Gemini API anahtarının günlük kotası doldu (${Math.round(retrySec / 3600)} saat sonra sıfırlanacak), sonraki anahtara geçiliyor...`);
                  lastError = new Error(`Google Gemini TTS günlük kotası doldu (${Math.round(retrySec / 3600)} saat sonra sıfırlanacak)`);
                  continue keyLoop;
                }
                const waitMs = Math.min(60_000, Math.max(retrySec * 1000, 30_000 + attempt * 5_000));
                lastError = new Error(`Google Gemini TTS kota sınırı (429): ${errBody.slice(0, 200)}`);
                options.log?.(`Google Gemini TTS (${model}) kota sınırına (429) takıldı, kota penceresinin açılması için ${waitMs / 1000} sn bekleniyor (${attempt + 1}/${maxRetries})...`);
                await new Promise((r) => setTimeout(r, waitMs));
                continue;
              }

              if (res.status >= 500) {
                const errText = await res.text();
                lastError = new Error(`Google Gemini TTS HTTP ${res.status} (${model}): ${errText.slice(0, 300)}`);
                continue;
              }

              if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Google Gemini TTS hatası HTTP ${res.status} (${model}): ${errorText.slice(0, 300)}`);
              }

              break;
            } catch (err) {
              lastError = err as Error;
              if (attempt === maxRetries - 1) break;
            }
          }

          if (res && res.ok) break keyLoop;
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

      let data: Buffer<any> = Buffer.from(base64Data, 'base64');
      // Eğer model RIFF WAVE başlığı olmadan ham PCM (L16) döndürdüyse standart WAV başlığı ekle
      if (data.length >= 4 && data.toString('ascii', 0, 4) !== 'RIFF') {
        const mime = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType ?? '';
        const rateMatch = mime.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        data = createWavFromPcm(data, sampleRate);
        options.log?.(`Ham ses WAV formatına dönüştürüldü (${sampleRate} Hz)`);
      }

      const durationSeconds = wavDuration(data);

      await writeFile(`${unifiedAudioPath}.tmp`, data, { mode: 0o600 });
      await rename(`${unifiedAudioPath}.tmp`, unifiedAudioPath);

      options.log?.(`Google Gemini TTS ile ses hazırlandı: ${durationSeconds.toFixed(2)} sn`);
      // Dakika başına istek (RPM) sınırına çarpmamak için çağrılar arası 6 saniye bekle
      await new Promise((r) => setTimeout(r, 6000));
      return { data, durationSeconds, path: unifiedAudioPath, cached: false };
    },
  };
}
