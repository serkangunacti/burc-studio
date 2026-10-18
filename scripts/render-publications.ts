import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { closeDb, getDb } from '../src/db/client';
import { publications as publicationsTable, type PublicationFormat } from '../src/db/schema';
import { missingPosts, renderDay, type RenderDayResult } from '../src/lib/automation/render-job';
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

function pushOrphanMediaCommit(mediaWorkdir: string, message: string) {
  execFileSync('git', ['checkout', '--orphan', 'next-media'], { cwd: mediaWorkdir, stdio: 'pipe' });
  execFileSync('git', ['add', '-A'], { cwd: mediaWorkdir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', message], { cwd: mediaWorkdir, stdio: 'pipe' });
  execFileSync('git', ['branch', '-M', 'next-media', 'reels-media'], { cwd: mediaWorkdir, stdio: 'pipe' });
  execFileSync('git', ['push', '--force', 'origin', 'reels-media'], { cwd: mediaWorkdir, stdio: 'pipe' });
}

async function main() {
  const date = values.date ?? (process.env.RENDER_DATE || istanbulDateKey());
  if (!isDateKey(date)) throw new Error(`Geçersiz tarih: ${date}`);
  const db = getDb();
  const availableVideoUrls = new Set<string>();

  const repo = process.env.GITHUB_REPOSITORY || 'serkangunacti/burc-studio';
  const [repoOwner, repoName] = repo.split('/');
  const pagesBaseUrl = `https://${repoOwner}.github.io/${repoName}/reels`;
  const mediaWorkdir = '/tmp/reels-media-worktree';
  const gitToken = process.env.GITHUB_TOKEN;
  const remoteUrl = gitToken
    ? `https://x-access-token:${gitToken}@github.com/${repo}.git`
    : `https://github.com/${repo}.git`;

  // GitHub Pages (reels-media dalı) hazırlığı ve 48 saatten eski geçici videoların temizliği.
  try {
    rmSync(mediaWorkdir, { recursive: true, force: true });
    try {
      execFileSync('git', ['clone', '--depth=1', '--branch', 'reels-media', remoteUrl, mediaWorkdir], { stdio: 'pipe' });
    } catch {
      mkdirSync(mediaWorkdir, { recursive: true });
      execFileSync('git', ['init'], { cwd: mediaWorkdir, stdio: 'pipe' });
      execFileSync('git', ['remote', 'add', 'origin', remoteUrl], { cwd: mediaWorkdir, stdio: 'pipe' });
    }
    execFileSync('git', ['config', 'user.name', 'github-actions[bot]'], { cwd: mediaWorkdir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { cwd: mediaWorkdir, stdio: 'pipe' });

    const reelsDir = path.join(mediaWorkdir, 'reels');
    mkdirSync(reelsDir, { recursive: true });
    const nojekyllPath = path.join(mediaWorkdir, '.nojekyll');
    if (!existsSync(nojekyllPath)) writeFileSync(nojekyllPath, '');

    const cutoffDateKey = new Date(Date.now() - 48 * 60 * 60_000).toISOString().slice(0, 10);
    let totalDeleted = 0;
    for (const entry of readdirSync(reelsDir)) {
      if (!entry.endsWith('.mp4')) continue;
      const dateMatch = entry.match(/^(\d{4}-\d{2}-\d{2})-/);
      if (!dateMatch || dateMatch[1] < cutoffDateKey) {
        unlinkSync(path.join(reelsDir, entry));
        totalDeleted++;
      } else {
        availableVideoUrls.add(`${pagesBaseUrl}/${entry}`);
      }
    }
    if (totalDeleted > 0) {
      pushOrphanMediaCommit(mediaWorkdir, `chore(media): cleanup ${totalDeleted} expired reels`);
      log(`GitHub Pages medya temizliği: ${totalDeleted} eski video silindi.`);
    }
  } catch (cleanError) {
    log(`GitHub Pages medya hazırlığı uyarısı: ${cleanError instanceof Error ? cleanError.message : String(cleanError)}`);
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
      const baseName = name.replace(/\.mp4$/i, '');
      const suffix = createHash('sha1').update(file).digest('hex').slice(0, 10);
      const fileName = `${baseName}-${suffix}.mp4`;
      const reelsDir = path.join(mediaWorkdir, 'reels');
      mkdirSync(reelsDir, { recursive: true });
      for (const existing of readdirSync(reelsDir)) {
        if (existing.startsWith(`${baseName}-`) && existing.endsWith('.mp4')) {
          unlinkSync(path.join(reelsDir, existing));
          availableVideoUrls.delete(`${pagesBaseUrl}/${existing}`);
        }
      }
      writeFileSync(path.join(reelsDir, fileName), file);
      pushOrphanMediaCommit(mediaWorkdir, `chore(media): upload ${fileName}`);

      const publicUrl = `${pagesBaseUrl}/${fileName}`;
      log(`GitHub Pages yayını bekleniyor: ${publicUrl}`);
      const waitDeadline = Date.now() + 120_000;
      let live = false;
      while (Date.now() < waitDeadline) {
        try {
          const headRes = await fetch(publicUrl, { method: 'HEAD', cache: 'no-store' });
          if (headRes.status === 200) {
            live = true;
            break;
          }
        } catch {}
        await sleep(3_000);
      }
      if (!live) log(`UYARI: GitHub Pages 120s içinde 200 dönmedi, URL yine de kaydediliyor: ${publicUrl}`);
      availableVideoUrls.add(publicUrl);
      log(`REELS_VIDEO_URL: ${publicUrl}`);
      return publicUrl;
    },
  });
  renderers.hasVideo = async (videoUrl) => availableVideoUrls.has(videoUrl);
  try {
    const forceRender = values.force || process.env.RENDER_FORCE === 'true';
    const targetOnly = values.only || process.env.RENDER_ONLY;
    const isMonday = new Date(`${date}T12:00:00+03:00`).getDay() === 1;
    const result: RenderDayResult = { rendered: [], kept: [], failures: [] };

    // Günlük tam (part 0) horoscope ve tarot videoları artık paylaşılmıyor; yalnızca Pazartesi haftalık (weekly) + her gün 4 Element paylaşılır.
    await db
      .delete(publicationsTable)
      .where(
        and(
          eq(publicationsTable.date, date),
          inArray(publicationsTable.kind, ['horoscope', 'tarot']),
          eq(publicationsTable.part, 0),
          inArray(publicationsTable.status, ['ready', 'approved', 'failed', 'expired']),
        ),
      );

    // Pazartesi günleri ilk sırada haftalık burç yorumları (11:00 Kadın, 11:15 Erkek) hazırlanır.
    if (isMonday && (!targetOnly || targetOnly.startsWith('weekly'))) {
      const weeklyTargets = targetOnly ? [targetOnly] : ['weekly-kadin', 'weekly-erkek'];
      for (const weeklyOnly of weeklyTargets) {
        const sub = await renderDay(db, date, renderers, { force: forceRender, only: weeklyOnly });
        result.rendered.push(...sub.rendered);
        result.kept.push(...sub.kept);
        result.failures.push(...sub.failures);
      }
    } else if (targetOnly && !targetOnly.startsWith('element') && !targetOnly.startsWith('weekly')) {
      const sub = await renderDay(db, date, renderers, { force: forceRender, only: targetOnly });
      result.rendered.push(...sub.rendered);
      result.kept.push(...sub.kept);
      result.failures.push(...sub.failures);
    }

    // Element Reels (Ateş, Toprak, Hava, Su) Üretimi — Her gün sabit saatlerde (11:30, 12:40, 13:50, 15:00)
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
            { key: 'ates', name: 'Ateş Grubu', part: 1, time: '11:30', hook: 'Ateş Grubu Bugün Neler Bekliyor? (Koç, Aslan, Yay) 🔥', signs: ['koc', 'aslan', 'yay'] as const },
            { key: 'toprak', name: 'Toprak Grubu', part: 2, time: '12:40', hook: 'Toprak Grubu Bugün Neler Bekliyor? (Boğa, Başak, Oğlak) 🌿', signs: ['boga', 'basak', 'oglak'] as const },
            { key: 'hava', name: 'Hava Grubu', part: 3, time: '13:50', hook: 'Hava Grubu Bugün Neler Bekliyor? (İkizler, Terazi, Kova) 💨', signs: ['ikizler', 'terazi', 'kova'] as const },
            { key: 'su', name: 'Su Grubu', part: 4, time: '15:00', hook: 'Su Grubu Bugün Neler Bekliyor? (Yengeç, Akrep, Balık) 🌊', signs: ['yengec', 'akrep', 'balik'] as const },
          ];

          const existingRows = (await listPublications(db, date)).filter((row) => row.postId === horoscopePost.id && row.part > 0);
          const formats: PublicationFormat[] = ['reels', ...(settings.automation.tiktok.enabled ? ['tiktok' as const] : [])];

          for (const el of elements) {
            if (targetOnly && targetOnly !== `element-${el.key}`) continue;

            const scheduledTime = el.time;
            const groupRows = existingRows.filter((r) => r.part === el.part);
            const isAllPublished = formats.every((fmt) => groupRows.some((r) => r.format === fmt && r.status === 'published'));
            if (isAllPublished && !forceRender && !targetOnly) {
              log(`Element Reels zaten paylaşılmış, korunuyor: ${el.name}`);
              result.kept.push(`element-${el.key}`);
              continue;
            }

            const oldElement = groupRows.find((r) => r.format === 'reels');
            const allFormatsExist = formats.every((fmt) => groupRows.some((r) => r.format === fmt));
            const hasFailed = groupRows.some((r) => r.status === 'failed');
            const oldValid =
              !hasFailed &&
              allFormatsExist &&
              oldElement?.media.videoUrl &&
              typeof oldElement.media.durationSeconds === 'number' &&
              oldElement.media.durationSeconds > 0 &&
              oldElement.media.durationSeconds <= MAX_REELS_MP4_SECONDS &&
              availableVideoUrls.has(oldElement.media.videoUrl);

            if (oldValid && !forceRender && !targetOnly) {
              log(`Element Reels zaten mevcut ve geçerli: ${el.name} (${oldElement.media.videoUrl})`);
              result.kept.push(`element-${el.key}`);
              continue;
            }

            const elementSigns = el.signs
              .map((slug) => {
                const signData = baseReels.signs.find((s) => s.sign === slug);
                const reading = readingBySign.get(slug);
                return {
                  ...(signData || {}),
                  body: reading?.body ?? signData?.short,
                } as ReelsSign;
              })
              .filter(Boolean);

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
                  { force: forceRender || hasFailed },
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
