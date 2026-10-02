import { parseArgs } from 'node:util';
import { put } from '@vercel/blob';
import { closeDb, getDb } from '../src/db/client';
import { missingPosts, renderDay } from '../src/lib/automation/render-job';
import { hasPlanMessage } from '../src/lib/automation/repository';
import { isDateKey, istanbulDateKey } from '../src/lib/date/istanbul';
import { getSettings } from '../src/lib/settings/repository';
import { automationStartReason } from '../src/lib/automation/start';
import { openMusicRenderer } from './automation/music';
import { openRemotionRenderers } from './automation/remotion';

// GitHub Actions'ta her sabah çalışır: günün gönderilerini carousel parçaları ve Reels olarak çizer, onaya hazırlar.
const { values } = parseArgs({
  options: { date: { type: 'string' }, force: { type: 'boolean', default: false }, 'wait-minutes': { type: 'string', default: '60' } },
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
  const { automation } = await getSettings(db);
  const paused = automationStartReason(automation.startDate, date);
  if (!automation.enabled || paused) {
    log(paused ?? 'Otomatik paylaşım kapalı; bugün hazırlık yapılmadı.');
    await closeDb();
    return;
  }

  // Günlük üretim cron'u ±1 saat oynayabilir; gönderiler tamamlanana kadar beklenir.
  const deadline = Date.now() + Number(values['wait-minutes']) * 60_000;
  let missing = await missingPosts(db, date);
  while (missing.length > 0 && Date.now() < deadline) {
    log(`Bekleniyor: ${missing.join(', ')}`);
    await sleep(60_000);
    missing = await missingPosts(db, date);
  }

  const music = await openMusicRenderer();
  const renderers = await openRemotionRenderers({
    music,
    log,
    upload: async (name, file) => (await put(`reels/${name}`, file, { access: 'public', contentType: 'video/mp4', addRandomSuffix: true })).url,
  });
  try {
    const result = await renderDay(db, date, renderers, { force: values.force || process.env.RENDER_FORCE === 'true' });
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
