import { parseArgs } from 'node:util';
import { del, list, put } from '@vercel/blob';
import { closeDb, getDb } from '../src/db/client';
import { missingPosts, renderDay } from '../src/lib/automation/render-job';
import { hasPlanMessage } from '../src/lib/automation/repository';
import { isDateKey, istanbulDateKey } from '../src/lib/date/istanbul';
import { getSettings } from '../src/lib/settings/repository';
import { automationStartReason } from '../src/lib/automation/start';
import { openMusicRenderer } from './automation/music';
import { openRemotionRenderers } from './automation/remotion';
import { decodeVoiceAsset } from './automation/voice';
import { createGoogleNarrator, introNarrationText, narrationText, outroNarrationText } from './automation/google-tts';
import type { ReelsProps, ReelsSign } from '../src/remotion/slide-types';

// GitHub Actions'ta 04:00 TSİ başlar: yalnız Reels/video hazırlar, sonucu Telegram'a bildirir.
const { values } = parseArgs({
  options: {
    date: { type: 'string' },
    force: { type: 'boolean', default: false },
    'wait-minutes': { type: 'string', default: '60' },
    only: { type: 'string' },
  },
});

const log = (message: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function notifyReady(date: string, failures: string[]) {
  const appUrl = process.env.APP_URL;
  const secret = process.env.AUTOMATION_SECRET;
  if (!appUrl || !secret) throw new Error('APP_URL ve AUTOMATION_SECRET tanımlı olmalı');
  const response = await fetch(`${appUrl}/api/automation/ready`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ date, failures }),
  });
  log(`Onay mesajı: ${response.status} ${await response.text()}`);
  // 409: Telegram henüz bağlanmadı; paylaşımlar hazır bekler, Paylaşımlar sayfasından yeniden gönderilebilir.
  if (!response.ok && response.status !== 409) throw new Error('Onay mesajı gönderilemedi');
}

async function main() {
  const date = values.date ?? (process.env.RENDER_DATE || istanbulDateKey());
  if (!isDateKey(date)) throw new Error(`Geçersiz tarih: ${date}`);
  const db = getDb();
  // Vercel Blob ücretsiz kotasını (1 GB) korumak için 24 saatten eski geçici videoları temizle.
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
    let cursor: string | undefined;
    let totalDeleted = 0;
    do {
      const page = await list({ prefix: 'reels/', cursor, limit: 1000 });
      const old = page.blobs.filter((b) => b.uploadedAt < cutoff).map((b) => b.url);
      if (old.length > 0) {
        await del(old);
        totalDeleted += old.length;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    if (totalDeleted > 0) log(`Vercel Blob temizliği: ${totalDeleted} eski video silindi.`);
  } catch (cleanError) {
    log(`Vercel Blob temizliği atlandı: ${cleanError instanceof Error ? cleanError.message : String(cleanError)}`);
  }
  const { automation } = await getSettings(db);
  const paused = automationStartReason(automation.startDate, date);
  if (!automation.enabled || paused) {
    log(paused ?? 'Otomatik paylaşım kapalı; bugün hazırlık yapılmadı.');
    await closeDb();
    return;
  }

  // Üretim ve render 04:00 TSİ tetiklenir; üretim tamamlanana kadar beklenir.
  const deadline = Date.now() + Number(values['wait-minutes']) * 60_000;
  let missing = await missingPosts(db, date);
  while (missing.length > 0 && Date.now() < deadline) {
    log(`Bekleniyor: ${missing.join(', ')}`);
    await sleep(60_000);
    missing = await missingPosts(db, date);
  }

  const music = await openMusicRenderer();
  const googleApiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  let narrator: ReturnType<typeof createGoogleNarrator> | undefined;

  const narrate = googleApiKey
    ? async (sign: ReelsSign) => {
        narrator ??= createGoogleNarrator({
          apiKey: googleApiKey,
          cacheDir: process.env.VOICE_CACHE_DIR || '.cache/voice',
          log,
        });
        return await narrator.speak(narrationText(sign));
      }
    : undefined;

  const narrateIntro = googleApiKey
    ? async (reels: ReelsProps) => {
        narrator ??= createGoogleNarrator({
          apiKey: googleApiKey,
          cacheDir: process.env.VOICE_CACHE_DIR || '.cache/voice',
          log,
        });
        return await narrator.speak(introNarrationText(reels));
      }
    : undefined;

  const narrateOutro = googleApiKey
    ? async () => {
        narrator ??= createGoogleNarrator({
          apiKey: googleApiKey,
          cacheDir: process.env.VOICE_CACHE_DIR || '.cache/voice',
          log,
        });
        return await narrator.speak(outroNarrationText());
      }
    : undefined;

  if (!googleApiKey) {
    log('Google TTS anahtarı tanımlı değil; Reels müzik ve onaylı giriş/kapanış sesiyle hazırlanıyor.');
  }

  const renderers = await openRemotionRenderers({
    music,
    voice: undefined,
    narrate,
    narrateIntro,
    narrateOutro,
    log,
    upload: async (name, file) => {
      const blob = await put(`reels/${name}`, file, { access: 'public', contentType: 'video/mp4', addRandomSuffix: true });
      log(`REELS_VIDEO_URL: ${blob.url}`);
      return blob.url;
    },
  });
  try {
    const result = await renderDay(db, date, renderers, {
      force: values.force || process.env.RENDER_FORCE === 'true',
      only: values.only || process.env.RENDER_ONLY,
    });
    log(`Çizilen: ${result.rendered.length}, korunan: ${result.kept.length}, hata: ${result.failures.length}`);
    for (const failure of result.failures) log(`HATA ${failure}`);
    const failures = [...missing.map((item) => `${item}: gönderi üretilmedi`), ...result.failures];
    // Yedek zamanlamalar aynı günü yeniden çalıştırır; yeni bir şey yoksa ikinci onay mesajı gönderilmez.
    if (result.rendered.length > 0 || failures.length > 0 || !(await hasPlanMessage(db, date))) await notifyReady(date, failures);
    else log('Onay mesajı zaten gönderilmiş; yeni paylaşım yok.');
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    await renderers.close();
    await music.close();
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
