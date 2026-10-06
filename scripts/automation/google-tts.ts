import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GOOGLE_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export type NarrationClip = {
  data: Buffer;
  durationSeconds: number;
  path: string;
  cached: boolean;
};

export function narrationText(sign: { signName: string; short: string }): string {
  let short = sign.short.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim();
  const prefix = new RegExp(`^${sign.signName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:.!,—–-]\\s*`, 'iu');
  short = short.replace(prefix, '').trim();
  if (!short) throw new Error(`${sign.signName}: kısa yorum boş`);
  const text = `${sign.signName}. ${short}`.normalize('NFC');
  if ([...text].length > 300) throw new Error(`${sign.signName}: ses metni 300 karakteri aşıyor; metin kesilmedi`);
  return text;
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
  if (!Number.isFinite(duration) || duration <= 0 || duration > 30) {
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
  const audience = options.audience || 'kadin';
  const voiceName = audience === 'erkek' ? 'tr-TR-Wavenet-B' : 'tr-TR-Wavenet-A';
  const ssmlGender = audience === 'erkek' ? 'MALE' : 'FEMALE';

  const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

  return {
    async speak(rawText: string): Promise<NarrationClip> {
      const text = rawText.trim().normalize('NFC');
      if (!text || [...text].length > 300) throw new Error('Ses metni 1–300 karakter olmalı');
      if (!apiKey) throw new Error('Google TTS API anahtarı tanımlı değil');

      await mkdir(cacheDir, { recursive: true });
      const key = hash(JSON.stringify({ text, voiceName, engine: 'google-tts-v1' }));
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

      // 2. Google Cloud Text-to-Speech API çağrısı
      const payload = {
        input: { text },
        voice: {
          languageCode: 'tr-TR',
          name: voiceName,
          ssmlGender,
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 24000,
          speakingRate: 1.05,
          pitch: 0.0,
        },
      };

      const url = `${GOOGLE_TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Google TTS hatası HTTP ${res.status}: ${errorText.slice(0, 300)}`);
      }

      const json = (await res.json()) as { audioContent?: string };
      if (!json.audioContent) throw new Error('Google TTS ses içeriği döndürmedi');

      const data = Buffer.from(json.audioContent, 'base64');
      const durationSeconds = wavDuration(data);

      await writeFile(`${audioPath}.tmp`, data, { mode: 0o600 });
      await rename(`${audioPath}.tmp`, audioPath);

      options.log?.(`Google TTS ile ses hazırlandı: ${durationSeconds.toFixed(2)} sn`);
      return { data, durationSeconds, path: audioPath, cached: false };
    },
  };
}
