import { parseArgs } from 'node:util';
import { del, list, put } from '@vercel/blob';
import { closeDb, getDb } from '../src/db/client';
import { missingPosts, renderDay } from '../src/lib/automation/render-job';
import { hasPlanMessage, listPublications, savePublication } from '../src/lib/automation/repository';
import { istanbulInstant } from '../src/lib/automation/plan';
import { isDateKey, istanbulDateKey } from '../src/lib/date/istanbul';
import { getSettings } from '../src/lib/settings/repository';
import { automationStartReason } from '../src/lib/automation/start';
import { openMusicRenderer } from './automation/music';
import { openRemotionRenderers } from './automation/remotion';
import { createGoogleNarrator } from './automation/google-tts';
import { createFullNarration } from './automation/full-narration';
import { getCurrentPostsForDate } from '../src/lib/content/repository';
import { getPostDetail } from '../src/lib/posts/repository';
import { brandFromSettings } from '../src/lib/posts/slide-props';
import { buildReelsProps } from '../src/lib/posts/reels-props';
import { musicSeed } from '../src/lib/music/compose';
import { MAX_REELS_MP4_SECONDS } from '../src/remotion/reels';
import type { PublicationFormat } from '../src/db/schema';
import type { ReelsProps, ReelsSign } from '../src/remotion/slide-types';

// GitHub Actions'ta kota sıfırlanmasından sonra yalnız Reels/video hazırlar, sonucu Telegram'a bildirir.
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
  const availableVideoUrls = new Set<string>();
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
      for (const blob of page.blobs) if (blob.uploadedAt >= cutoff) availableVideoUrls.add(blob.url);
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

  // İçerik üretimi 04:30 TSİ'de biter; 05:00 renderında henüz eksik gönderi varsa otomatik tetikle.
  let missing = await missingPosts(db, date);
  if (missing.length > 0) {
    log(`İçerikler bekleniyor (${missing.join(', ')}). /api/cron/daily tetikleniyor...`);
    try {
      const appUrl = process.env.APP_URL || 'https://burc-studio.vercel.app';
      const secret = process.env.CRON_SECRET || process.env.AUTOMATION_SECRET;
      const res = await fetch(`${appUrl}/api/cron/daily`, {
        headers: secret ? { authorization: `Bearer ${secret}` } : {},
      });
      log(`Otomatik içerik üretim tetikleme yanıtı: HTTP ${res.status}`);
      await sleep(10_000);
      missing = await missingPosts(db, date);
    } catch (err) {
      log(`Otomatik içerik tetikleme hatası: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const deadline = Date.now() + Number(values['wait-minutes']) * 60_000;
  while (missing.length > 0 && Date.now() < deadline) {
    log(`Bekleniyor: ${missing.join(', ')}`);
    await sleep(30_000);
    missing = await missingPosts(db, date);
  }

  const music = await openMusicRenderer();
  const cacheDir = process.env.VOICE_CACHE_DIR || '.cache/voice';
  const renderers = await openRemotionRenderers({
    music,
    narrateFull: (reels) => {
      const narrator = createGoogleNarrator({
        cacheDir,
        log,
        audience: reels.audience as 'kadin' | 'erkek',
      });
      return createFullNarration(reels, { narrator, cacheDir });
    },
    log,
    upload: async (name, file) => {
      const blob = await put(`reels/${name}`, file, { access: 'public', contentType: 'video/mp4', addRandomSuffix: true });
      log(`REELS_VIDEO_URL: ${blob.url}`);
      return blob.url;
    },
  });
  renderers.hasVideo = async (videoUrl) => availableVideoUrls.has(videoUrl);
  try {
    const result = await renderDay(db, date, renderers, {
      force: values.force || process.env.RENDER_FORCE === 'true',
      only: values.only || process.env.RENDER_ONLY,
    });
    // Element Reels (Ateş, Toprak, Hava, Su) Üretimi (Seçenek C)
    const targetOnly = values.only || process.env.RENDER_ONLY;
    const shouldRenderElements = !targetOnly || targetOnly.startsWith('element');
    if (shouldRenderElements) {
      log('--- Element Reels (Ateş, Toprak, Hava, Su) Hazırlanıyor ---');
      const posts = await getCurrentPostsForDate(db, date);
      const horoscopePost = posts.find((p) => p.kind === 'horoscope' && p.audience === 'kadin') ?? posts.find((p) => p.kind === 'horoscope');
      if (horoscopePost) {
        const detail = await getPostDetail(db, horoscopePost.id);
        if (detail) {
          const settings = await getSettings(db);
          const brand = brandFromSettings(settings);
          const baseReels = buildReelsProps(detail, brand);
          const readingBySign = new Map(detail.slides.flatMap((s) => (s.reading ? [[s.reading.sign, s.reading] as const] : [])));

          const elements = [
            { key: 'ates', name: 'Ateş Grubu', part: 1, time: '10:40', hook: 'Ateş Grubu Bugün Neler Bekliyor? (Koç, Aslan, Yay) 🔥', signs: ['koc', 'aslan', 'yay'] as const },
            { key: 'toprak', name: 'Toprak Grubu', part: 2, time: '11:05', hook: 'Toprak Grubu Bugün Neler Bekliyor? (Boğa, Başak, Oğlak) 🌿', signs: ['boga', 'basak', 'oglak'] as const },
            { key: 'hava', name: 'Hava Grubu', part: 3, time: '11:30', hook: 'Hava Grubu Bugün Neler Bekliyor? (İkizler, Terazi, Kova) 💨', signs: ['ikizler', 'terazi', 'kova'] as const },
            { key: 'su', name: 'Su Grubu', part: 4, time: '11:55', hook: 'Su Grubu Bugün Neler Bekliyor? (Yengeç, Akrep, Balık) 🌊', signs: ['yengec', 'akrep', 'balik'] as const },
          ];

          const existingReels = (await listPublications(db, date)).filter((row) => row.postId === horoscopePost.id && row.format === 'reels');

          for (const el of elements) {
            if (targetOnly && targetOnly !== `element-${el.key}`) continue;

            const isMonday = new Date(`${date}T12:00:00+03:00`).getDay() === 1;
            const scheduledTime = isMonday
              ? (el.part === 1 ? '10:20' : el.part === 2 ? '10:45' : el.part === 3 ? '11:10' : '11:35')
              : el.time;

            const oldElement = existingReels.find((r) => r.part === el.part);
            const oldValid = oldElement?.media.videoUrl &&
              typeof oldElement.media.durationSeconds === 'number' &&
              oldElement.media.durationSeconds > 0 &&
              oldElement.media.durationSeconds <= MAX_REELS_MP4_SECONDS &&
              (availableVideoUrls.size === 0 || availableVideoUrls.has(oldElement.media.videoUrl));

            if (oldValid && !values.force && process.env.RENDER_FORCE !== 'true' && !targetOnly) {
              log(`Element Reels zaten mevcut ve geçerli: ${el.name} (${oldElement.media.videoUrl})`);
              result.kept.push(`element-${el.key}`);
              continue;
            }

            const elementSigns = el.signs.map((slug) => {
              const signData = baseReels.signs.find((s) => s.sign === slug);
              const reading = readingBySign.get(slug);
              return {
                ...(signData || {}),
                body: reading?.body ?? signData?.short,
              } as ReelsSign;
            }).filter(Boolean);

            const elementReels: ReelsProps = {
              ...baseReels,
              element: el.key,
              hook: el.hook,
              signs: elementSigns,
            };

            try {
              log(`Element Reels hazırlanıyor: ${el.name} (${date}-element-${el.key})`);
              const videoUrl = await renderers.renderReels({
                templateVersion: horoscopePost.templateVersion,
                reels: elementReels,
                musicSeed: musicSeed(elementReels),
                name: `${date}-element-${el.key}`,
              });
              const url = typeof videoUrl === 'string' ? videoUrl : videoUrl.videoUrl;
              const durationSeconds = typeof videoUrl === 'object' && videoUrl.durationSeconds ? videoUrl.durationSeconds : undefined;
              log(`ELEMENT REELS HAZIR [${el.name}]: ${url} (${durationSeconds ? durationSeconds.toFixed(1) + 's' : ''})`);

              const formats: PublicationFormat[] = ['reels', ...(settings.automation.tiktok.enabled ? ['tiktok' as const] : [])];
              for (const fmt of formats) {
                await savePublication(
                  db,
                  date,
                  {
                    postId: horoscopePost.id,
                    kind: 'horoscope',
                    audience: 'kadin',
                    format: fmt,
                    part: el.part,
                    scheduledAt: istanbulInstant(date, scheduledTime),
                    caption: `${el.name} Günlük Burç Yorumları ✨\n\n${el.hook}\n\n#burç #${el.key}grubu #astroloji #burçlar`,
                  },
                  {
                    videoUrl: url,
                    durationSeconds,
                    isAiGenerated: true,
                    partCount: 1,
                  },
                  { force: values.force || process.env.RENDER_FORCE === 'true' },
                );
              }

              result.rendered.push(`element-${el.key}`);
            } catch (err) {
              log(`HATA Element Reels [${el.name}]: ${err instanceof Error ? err.message : String(err)}`);
              result.failures.push(`element-${el.key}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    }

    log(`Çizilen: ${result.rendered.length}, korunan: ${result.kept.length}, hata: ${result.failures.length}`);
    for (const failure of result.failures) log(`HATA ${failure}`);
    const failures = [...missing.map((item) => `${item}: gönderi üretilmedi`), ...result.failures];
    // Yedek zamanlamalar aynı günü yeniden çalıştırır; onay bekleyen satır varsa veya yeni çizim varsa bildirim gönderilir.
    const hasPendingReady = (await listPublications(db, date)).some((row) => row.status === 'ready');
    if (result.rendered.length > 0 || failures.length > 0 || hasPendingReady || !(await hasPlanMessage(db, date))) await notifyReady(date, failures);
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
