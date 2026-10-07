import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createGoogleNarrator, narrationText } from './google-tts';

const dirs: string[] = [];
async function cache() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'google-tts-test-'));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

function mockWav() {
  const b = Buffer.alloc(44 + 24000 * 2);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(b.length - 44, 40);
  return b;
}

describe('Google Gemini TTS seslendirme motoru', () => {
  it('burç adını bir kez söyler, emojiyi okumaz ve yorum metnini korur', () => {
    expect(narrationText({ signName: 'Koç', short: 'Koç: Bugün enerjin yüksek. ✨' })).toBe('Koç. Bugün enerjin yüksek.');
    expect(narrationText({ signName: 'Boğa', short: 'Küçük adımlarla ilerle.' })).toBe('Boğa. Küçük adımlarla ilerle.');
    expect(
      narrationText({
        signName: 'Koç',
        short: 'Bugün enerjin yüksek.',
        body: 'Yıldızlar bugün seninle. Yeni adımlar atmaktan çekinme.',
        headline: 'Günün enerjisi',
        luckyNumber: 7,
        luckyColor: { name: 'Altın' },
      })
    ).toBe(
      'Sevgili Koç burçları; Günün enerjisi. Yıldızlar bugün seninle. Yeni adımlar atmaktan çekinme. Şanslı sayınız 7, uğurlu renginiz Altın!'
    );
    expect(() => narrationText({ signName: 'Koç', short: '' })).toThrow();
  });

  it('Gemini TTS API ile ses üretir ve önbelleğe yazar', async () => {
    const cacheDir = await cache();
    const calls: unknown[] = [];
    const fetchImpl: typeof fetch = async (_url, options) => {
      calls.push(JSON.parse(String(options?.body)));
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: mockWav().toString('base64'),
                  },
                },
              ],
            },
          },
        ],
      });
    };

    const narrator = createGoogleNarrator({ apiKey: 'test-key', cacheDir, fetchImpl });
    const clip1 = await narrator.speak('Koç. Bugün enerjin yüksek.');
    expect(clip1.durationSeconds).toBe(1);
    expect(clip1.cached).toBe(false);
    expect(calls).toHaveLength(1);

    // Aynı metin tekrar istendiğinde API çağrısı yapmaz, önbellekten alır
    const clip2 = await narrator.speak('Koç. Bugün enerjin yüksek.');
    expect(clip2.durationSeconds).toBe(1);
    expect(clip2.cached).toBe(true);
    expect(calls).toHaveLength(1); // yeni çağrı yok
  });

  it('API anahtarı yoksa hata fırlatır', async () => {
    const cacheDir = await cache();
    const narrator = createGoogleNarrator({ apiKey: '', cacheDir });
    await expect(narrator.speak('Koç. Test.')).rejects.toThrow('API anahtarı');
  });

  it('Gemini API hata döndüğünde hatayı iletir', async () => {
    const cacheDir = await cache();
    const fetchImpl: typeof fetch = async () => new Response('Quota exceeded', { status: 429 });
    const narrator = createGoogleNarrator({ apiKey: 'test-key', cacheDir, fetchImpl });
    await expect(narrator.speak('Koç. Test.')).rejects.toThrow('Google Gemini TTS hatası HTTP 429');
  });
});
