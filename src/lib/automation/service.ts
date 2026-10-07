import type { Db } from '@/db/types';
import { BufferError, createBufferClient, type BufferClient, type BufferRateLimit } from '@/lib/buffer/client';
import { istanbulDateKey, istanbulDayStart, type DateKey } from '@/lib/date/istanbul';
import { istanbulInstant } from './plan';
import { createInstagramClient, fetchInstagramAccount, InstagramError, refreshInstagramToken, type InstagramClient } from '@/lib/instagram/client';
import { getSettings, saveSettings } from '@/lib/settings/repository';
import type { AutomationSettings } from '@/lib/settings/schema';
import { getPostDetail } from '@/lib/posts/repository';
import { createTelegramClient, escapeHtml, TelegramError, type TelegramClient } from '@/lib/telegram/client';
import { buildDayMessage, groupLabel, parseDayAction } from './day-message';
import { dispatchRenderWorkflow, verifyRenderWorkflowAccess } from './dispatch';
import {
  approveDay,
  claimForPublishing,
  deleteMediaBefore,
  expireUnapproved,
  getIntegration,
  getPublication,
  listPublications,
  listPendingBufferVerifications,
  markExpired,
  markForRebuild,
  markPublishAttempt,
  markBufferSubmission,
  markFailed,
  markPublished,
  releaseForRetry,
  retryFailedGroup,
  saveIntegration,
  saveBufferRateLimits,
  setContainer,
  setGroupSkipped,
  setRemoteId,
  setTelegramMessageId,
  type PublicationRow,
} from './repository';
import { decryptSecret, encryptSecret, telegramWebhookSecret } from './secrets';
import { automationStartReason } from './start';

export type AutomationDeps = {
  db: Db;
  appUrl: string;
  repository: string;
  integrationsKey: string | undefined;
  automationSecret: string | undefined;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  fetch: typeof fetch;
  enqueue: (publicationId: string, options: { delaySeconds: number; retentionSeconds: number }) => Promise<void>;
  deleteVideosBefore: (before: Date) => Promise<number>;
};

// Kuyruk teslimini bu kadar saniye sonra yeniden ister (Reels işleniyor, geçici hata, erken teslim).
export class RetryLater extends Error {
  constructor(
    readonly afterSeconds: number,
    message: string,
  ) {
    super(message);
    this.name = 'RetryLater';
  }
}

const DAY_MS = 86_400_000;
const MAX_QUEUE_SECONDS = 7 * 86_400;
const REELS_POLL_SECONDS = 30;
// İlk sorgular 5 dk aralıkla; uzun bekleyişte ve düşük aylık kotada seyrekleşir.
const BUFFER_POLL_SECONDS = 5 * 60;
const INLINE_STATUS_CHECKS = 3;
const MAX_CONTAINER_REBUILDS = 1;
const REBUILD_DELAY_SECONDS = 10 * 60;
// Tanı ucunda carousel kurulmadan önceki bekleme.
const CAROUSEL_PARENT_DELAY_MS = 15_000;
// Yayın isteği hata döndüğünde sonuç bu aralıkla, bu süre boyunca hesaptaki gönderilerle doğrulanır.
const PUBLISH_VERIFY_SECONDS = 120;
const PUBLISH_VERIFY_WINDOW_MS = 15 * 60_000;
const INLINE_STATUS_WAIT_MS = 10_000;
// Meta'nın saatlik çağrı sınırı dolduysa bu aralıkla, planlanan saatten sonra en fazla bu süre boyunca denenir.
const RATE_LIMIT_RETRY_SECONDS = 30 * 60;
// Başka bir Instagram paylaşımı sürerken sıradaki bu aralıkla bekler.
const INSTAGRAM_TURN_SECONDS = 90;
// Carousel görselleri art arda değil, bu aralıkla yüklenir (Instagram işlem sınırı).
const CAROUSEL_ITEM_GAP_MS = 3_000;
const RATE_LIMIT_WINDOW_MS = 4 * 3_600_000;
// Buffer'ın TikTok gönderimi canlıda 40–60 dk sürdü; planlanan saatten sonra en fazla bu kadar beklenir.
const BUFFER_TIMEOUT_MS = 4 * 60 * 60_000;
// Reels işleme için ~10 dakika; geçici Instagram hataları için 5 deneme.
const MAX_PROCESSING_ATTEMPTS = 20;
const MAX_TRANSIENT_ATTEMPTS = 5;
const MEDIA_RETENTION_DAYS = 1;
const TOKEN_REFRESH_WINDOW_MS = 20 * DAY_MS;
const INSTAGRAM_TOKEN_LIFETIME_MS = 60 * DAY_MS;

export const mediaUrlFor = (appUrl: string) => (id: string) => `${appUrl}/api/media/${id}`;

async function loadTelegram(deps: AutomationDeps): Promise<{ client: TelegramClient; chatId: number | null; automation: AutomationSettings } | null> {
  const integration = await getIntegration(deps.db, 'telegram');
  if (!integration) return null;
  const settings = await getSettings(deps.db);
  return { client: createTelegramClient(decryptSecret(integration.secretEncrypted, deps.integrationsKey), deps.fetch), chatId: settings.automation.telegramChatId, automation: settings.automation };
}

type BufferService = 'tiktok' | 'instagram' | 'youtube';

async function loadBuffer(deps: AutomationDeps, service: BufferService = 'tiktok'): Promise<{ client: BufferClient; channelId: string }> {
  const integration = await getIntegration(deps.db, 'buffer');
  if (!integration) throw new Error('Buffer bağlı değil. Ayarlar → Otomatik paylaşım bölümünden Buffer API anahtarını gir.');
  const client = createBufferClient(decryptSecret(integration.secretEncrypted, deps.integrationsKey), deps.fetch, {
    now: deps.now,
    initialRateLimits: integration.account.rateLimits,
    onRateLimits: (limits) => saveBufferRateLimits(deps.db, limits),
  });
  if (service === 'tiktok') return { client, channelId: integration.account.id };
  if (service === 'youtube') {
    const cached = await getIntegration(deps.db, 'buffer_youtube');
    if (cached) return { client, channelId: cached.account.id };
    const all = await client.allChannels();
    const channel = all.find((c) => {
      const s = c.service.toLowerCase();
      return s.includes('youtube') || s.includes('google');
    });
    if (!channel) {
      const channelSummary = all.map((c) => `${c.name} (${c.service})`).join(', ') || 'hiçbir kanal bulunamadı';
      throw new Error(`Buffer hesabında bağlı YouTube kanalı bulunamadı. Buffer'daki bağlı kanallar: ${channelSummary}. Buffer'da Channels → Connect → YouTube ile kanalı bağla.`);
    }
    await saveIntegration(deps.db, { id: 'buffer_youtube', secretEncrypted: integration.secretEncrypted, account: { id: channel.id, username: channel.name }, expiresAt: null });
    return { client, channelId: channel.id };
  }
  // Instagram kanalı ilk kullanımda Buffer hesabından bulunur ve saklanır.
  const cached = await getIntegration(deps.db, 'buffer_instagram');
  if (cached) return { client, channelId: cached.account.id };
  const [channel] = await client.channels('instagram');
  if (!channel) throw new Error("Buffer hesabında bağlı Instagram kanalı yok. Buffer'da Channels → Connect → Instagram ile @kozmikarkan'ı bağla.");
  await saveIntegration(deps.db, { id: 'buffer_instagram', secretEncrypted: integration.secretEncrypted, account: { id: channel.id, username: channel.name }, expiresAt: null });
  return { client, channelId: channel.id };
}

async function loadInstagram(deps: AutomationDeps): Promise<InstagramClient> {
  const integration = await getIntegration(deps.db, 'instagram');
  if (!integration) throw new Error('Instagram bağlı değil. Ayarlar → Otomasyon bölümünden erişim anahtarını gir.');
  return createInstagramClient({ token: decryptSecret(integration.secretEncrypted, deps.integrationsKey), userId: integration.account.id, fetch: deps.fetch });
}

async function notify(deps: AutomationDeps, html: string, silent = false): Promise<void> {
  const telegram = await loadTelegram(deps);
  if (!telegram?.chatId) return;
  await telegram.client.sendMessage(telegram.chatId, html, { silent }).catch((error: unknown) => console.error('Telegram bildirimi gönderilemedi', error));
}

// Sabah mesajı: kapak önizlemeleri ve düğmeli plan.
export async function sendDayPlan(deps: AutomationDeps, date: DateKey, failures: readonly string[] = []): Promise<{ sent: boolean; reason?: string }> {
  const telegram = await loadTelegram(deps);
  if (!telegram) return { sent: false, reason: 'Telegram botu bağlı değil.' };
  if (!telegram.chatId) return { sent: false, reason: 'Bota henüz /start yazılmadı.' };
  const paused = automationStartReason(telegram.automation.startDate, date, deps.now());
  if (!telegram.automation.enabled || paused) return { sent: false, reason: paused ?? 'Otomatik paylaşım kapalı.' };
  if (!deps.automationSecret) throw new Error('AUTOMATION_SECRET tanımlı değil');
  // Anahtar değişmiş olabilir; düğmeler gönderilmeden webhook eşitlenir, bekleyen onaylar korunur.
  await telegram.client.setWebhook(`${deps.appUrl}/api/telegram/webhook`, telegramWebhookSecret(deps.automationSecret), { dropPendingUpdates: false });
  const rows = await listPublications(deps.db, date);
  const mediaUrl = mediaUrlFor(deps.appUrl);
  const covers = rows
    .filter((row) => row.format === 'carousel' && row.part === 1 && row.status === 'ready' && row.media.imageIds?.length)
    .map((row) => mediaUrl(row.media.imageIds![0]))
    .slice(0, 10);
  if (covers.length >= 2) {
    await telegram.client.sendPhotos(telegram.chatId, covers).catch((error: unknown) => console.error('Önizleme albümü gönderilemedi', error));
  }
  const { html, keyboard } = buildDayMessage(date, rows, { mediaUrl, failures });
  const message = await telegram.client.sendMessage(telegram.chatId, html, { keyboard });
  if (rows.length > 0) await setTelegramMessageId(deps.db, date, message.message_id);
  return { sent: true };
}

async function refreshDayMessage(deps: AutomationDeps, date: DateKey, messageId?: number | null): Promise<void> {
  const telegram = await loadTelegram(deps);
  const rows = await listPublications(deps.db, date);
  const target = messageId ?? rows.find((row) => row.telegramMessageId)?.telegramMessageId;
  if (!telegram?.chatId || !target) return;
  const { html, keyboard } = buildDayMessage(date, rows, { mediaUrl: mediaUrlFor(deps.appUrl) });
  await telegram.client.editMessage(telegram.chatId, target, html, keyboard).catch((error: unknown) => {
    // Aynı içerikle düzenleme Telegram'da hata sayılır; yok sayılır.
    if (!(error instanceof TelegramError && error.message.includes('not modified'))) console.error('Plan mesajı güncellenemedi', error);
  });
}

async function enqueueRows(deps: AutomationDeps, rows: readonly PublicationRow[]): Promise<void> {
  const now = deps.now().getTime();
  for (const row of rows) {
    const delaySeconds = Math.min(MAX_QUEUE_SECONDS, Math.max(0, Math.ceil((row.scheduledAt.getTime() - now) / 1000)));
    await deps.enqueue(row.id, { delaySeconds, retentionSeconds: Math.min(MAX_QUEUE_SECONDS, delaySeconds + 86_400) });
  }
}

export type TelegramUpdate = {
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
};

export async function handleTelegramUpdate(deps: AutomationDeps, update: TelegramUpdate): Promise<void> {
  const telegram = await loadTelegram(deps);
  if (!telegram) return;
  const { client, chatId } = telegram;

  if (update.message) {
    const from = update.message.chat.id;
    const command = update.message.text?.trim().split(/\s+/)[0]?.split('@')[0];
    if (command === '/start') {
      if (chatId === null) {
        await saveSettings(deps.db, { automation: { telegramChatId: from } });
        await client.sendMessage(from, '✅ Bağlandı. Her sabah günün paylaşımlarını onayına buraya göndereceğim.\n\n/bugun ile bugünün planını, /durum ile bağlantıların durumunu istediğin zaman görebilirsin.');
      } else if (chatId === from) {
        await client.sendMessage(from, 'Zaten bağlıyız ✨ /bugun ile bugünün planını görebilirsin.');
      }
      return;
    }
    if (from !== chatId) return;
    if (command === '/durum') {
      await client.sendMessage(from, describeStatus(await automationStatus(deps)));
      return;
    }
    if (command === '/bugun') {
      const result = await sendDayPlan(deps, istanbulDateKey(deps.now()));
      if (!result.sent && result.reason) await client.sendMessage(from, escapeHtml(result.reason));
      return;
    }
    if (command === '/temizle' || command === '/bakim') {
      const result = await runMaintenance(deps);
      await client.sendMessage(
        from,
        `🧹 <b>Bakım ve temizlik tamamlandı</b>\n• ${result.deletedVideos} eski video depodan silindi\n• ${result.deletedImages} eski görsel temizlendi\n• ${result.expired} süresi geçen kayıt kapatıldı${result.tokenRefreshed ? '\n• Instagram anahtarı yenilendi' : ''}`,
      );
      return;
    }
    if (command === '/shorts') {
      try {
        const result = await syncYouTubeShorts(deps, istanbulDateKey(deps.now()));
        if (result.errors.length > 0) {
          await client.sendMessage(from, `⚠️ YouTube Shorts işlemi:\n• Gönderilen: ${result.sent}\n• Hatalar:\n${result.errors.map((e) => `  - ${escapeHtml(e)}`).join('\n')}`);
        } else {
          await client.sendMessage(from, `✅ ${result.sent} video YouTube Shorts olarak Buffer'a iletildi.`);
        }
      } catch (error) {
        await client.sendMessage(from, `❌ YouTube Shorts işlemi başarısız:\n<i>${escapeHtml(error instanceof Error ? error.message : String(error))}</i>`);
      }
    if (command === '/ciz' || command === '/yenile') {
      try {
        const today = istanbulDateKey(deps.now());
        const result = await startRender(deps, today, { force: true });
        if (result.dispatched) {
          await client.sendMessage(from, `🎨 <b>Günün paylaşımları yeniden çiziliyor...</b>\n\n• Yeni modern Kozmik Arkan şablonu (pastel@2)\n• Yeni Google TTS seslendirmesi\n• YouTube Shorts 175 sn sınırı\n\nÇizim tamamlandığında buraya <b>onay mesajı</b> gelecek. Sen onay vermeden hiçbir paylaşım yapılmayacak.`);
        } else {
          await client.sendMessage(from, `❌ Çizim başlatılamadı: ${result.reason ?? 'Bilinmeyen hata'}`);
        }
      } catch (error) {
        await client.sendMessage(from, `❌ Çizim başlatılamadı: <i>${escapeHtml(error instanceof Error ? error.message : String(error))}</i>`);
      }
      return;
    }
    return;
  }

  const query = update.callback_query;
  if (!query) return;
  if (query.message?.chat.id !== chatId) {
    await client.answerCallback(query.id);
    return;
  }
  const action = parseDayAction(query.data);
  if (!action) {
    await client.answerCallback(query.id, 'Bu düğme artık geçerli değil.');
    return;
  }
  const now = deps.now();
  const targetDate = action.action === 'approve' ? action.date : telegram.automation.startDate
    ? (await getPostDetail(deps.db, action.postId))?.post.date ?? istanbulDateKey(now)
    : istanbulDateKey(now);
  const paused = automationStartReason(telegram.automation.startDate, targetDate, now);
  if (!telegram.automation.enabled || paused) {
    await client.answerCallback(query.id, paused ?? 'Otomatik paylaşım kapalı.');
    return;
  }
  if (action.action === 'approve') {
    const approved = await approveDay(deps.db, action.date, now);
    await enqueueRows(deps, approved);
    await client.answerCallback(query.id, approved.length > 0 ? `✓ ${approved.length} paylaşım planlandı` : 'Onaylanacak paylaşım kalmadı.');
    await refreshDayMessage(deps, action.date, query.message.message_id);
    if (approved.length > 0) await client.sendMessage(chatId, approvalSummary(approved, now));
    return;
  }
  if (action.action === 'retry') {
    const retried = await retryFailedGroup(deps.db, { postId: action.postId, format: action.format }, now);
    await enqueueRows(deps, retried);
    await client.answerCallback(query.id, retried.length > 0 ? `🔁 ${retried.length} paylaşım yeniden deneniyor` : 'Yeniden denenecek paylaşım yok.');
    if (retried[0]) await refreshDayMessage(deps, retried[0].date, query.message.message_id);
    return;
  }
  const changed = await setGroupSkipped(deps.db, { postId: action.postId, format: action.format, skipped: action.action === 'skip' }, now);
  if (action.action === 'undo') await enqueueRows(deps, changed.filter((row) => row.status === 'approved'));
  await client.answerCallback(query.id, changed.length === 0 ? 'Değişiklik yok.' : action.action === 'skip' ? 'Paylaşılmayacak.' : 'Geri alındı.');
  if (changed[0]) await refreshDayMessage(deps, changed[0].date, query.message.message_id);
}

const clock = (date: Date) => date.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });

// Telegram'ın düğme uyarısı birkaç saniyede kaybolur; onay kalıcı bir mesajla da doğrulanır.
export function approvalSummary(approved: readonly PublicationRow[], now: Date): string {
  const due = approved.filter((row) => row.scheduledAt.getTime() <= now.getTime());
  const upcoming = approved.filter((row) => row.scheduledAt.getTime() > now.getTime()).sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const lines = [`✅ ${approved.length} paylaşım onaylandı.`];
  if (due.length > 0) lines.push(`Saati geçmiş ${due.length} paylaşım hemen gönderiliyor.`);
  if (upcoming.length > 0) lines.push(`Sıradaki: ${clock(upcoming[0].scheduledAt)} · son: ${clock(upcoming.at(-1)!.scheduledAt)}.`);
  lines.push('Her paylaşım gidince "📤 Paylaşıldı" bildirimi gelecek.');
  return lines.join('\n');
}

function publicationLabel(row: PublicationRow): string {
  return `${groupLabel(row)}${row.format === 'carousel' ? ` ${row.part}/3` : ''}`;
}


async function createCarouselChildren(deps: AutomationDeps, instagram: InstagramClient, row: PublicationRow): Promise<string[]> {
  const imageIds = row.media.imageIds ?? [];
  if (imageIds.length < 2) throw new Error('Carousel görselleri eksik (bakım silmiş olabilir)');
  const mediaUrl = mediaUrlFor(deps.appUrl);
  const children: string[] = [];
  for (const [index, id] of imageIds.entries()) {
    if (index > 0) await deps.sleep(CAROUSEL_ITEM_GAP_MS);
    children.push(await instagram.createCarouselItem(mediaUrl(id)));
  }
  return children;
}


export type PublishOutcome = 'published' | 'failed' | 'ignored' | 'expired';
type Published = { igContainerId?: string; igMediaId?: string | null; remoteId?: string; permalink: string | null; silent?: boolean };

// Instagram carousel ve Reels'i zaman zaman geçici olarak ERROR'a düşürür; container sınırlı sayıda baştan kurulur.
async function rebuildOrFail(deps: AutomationDeps, instagram: InstagramClient, row: PublicationRow, containerId: string, status: string): Promise<never> {
  const detail = await instagram.containerDetail(containerId).catch(() => null);
  console.error('Instagram container hatası', { publication: row.id, containerId, status, detail, rebuilds: row.rebuilds });
  // Bu noktada "yayınla" isteği hiç gönderilmemiştir; yeniden kurmak kopya paylaşım oluşturamaz.
  if (row.rebuilds < MAX_CONTAINER_REBUILDS) {
    await markForRebuild(deps.db, row.id);
    // Hemen yeniden kurmak hesabı "too many actions" kısıtlamasına sokuyor; taze öğelerle tek deneme 10 dakika sonra yapılır.
    throw new RetryLater(REBUILD_DELAY_SECONDS, `Instagram medyayı işleyemedi (${status})${detail ? `: ${detail}` : ''}; yeniden kuruluyor`);
  }
  throw new Error(`Instagram medyayı işleyemedi (${status})${detail ? `: ${detail}` : ''}`);
}

// Görseller genelde saniyeler içinde işlenir; kuyruğun yeniden teslimi dakikalar sürdüğü için önce kısa süre burada beklenir.
async function pollContainer(deps: AutomationDeps, instagram: InstagramClient, containerId: string): Promise<string> {
  let status = await instagram.containerStatus(containerId);
  for (let check = 0; status === 'IN_PROGRESS' && check < INLINE_STATUS_CHECKS; check++) {
    await deps.sleep(INLINE_STATUS_WAIT_MS);
    status = await instagram.containerStatus(containerId);
  }
  return status;
}

async function publishToInstagram(deps: AutomationDeps, row: PublicationRow): Promise<Published> {
  const instagram = await loadInstagram(deps);
  // Daha önce "yayınla" isteği gönderildiyse sonuç hesaptaki gönderilerle doğrulanır; hiçbir durumda yeniden yayınlanmaz.
  if (row.publishAttemptedAt) return verifyPublished(deps, instagram, row, row.publishAttemptedAt);

  let containerId = row.igContainerId;
  let status: string;
  if (containerId) {
    status = await pollContainer(deps, instagram, containerId);
  } else {
    containerId = await createCarousel(deps, instagram, row);
    await setContainer(deps.db, row.id, containerId);
    status = await pollContainer(deps, instagram, containerId);
  }
  if (status === 'IN_PROGRESS') {
    if (row.attempts >= MAX_PROCESSING_ATTEMPTS) throw new Error('Instagram medyayı zamanında işleyemedi');
    await releaseForRetry(deps.db, row.id);
    throw new RetryLater(REELS_POLL_SECONDS, 'Instagram medyayı işliyor');
  }
  if (status !== 'FINISHED') await rebuildOrFail(deps, instagram, row, containerId, status);

  const attemptedAt = deps.now();
  await markPublishAttempt(deps.db, row.id, containerId, attemptedAt);
  let mediaId: string;
  try {
    mediaId = await instagram.publish(containerId);
  } catch (error) {
    // Instagram, çağrı sınırındayken gönderiyi yayınlayıp yine de hata dönebiliyor: sonuç doğrulanmadan yeniden denenmez.
    console.error('Instagram yayınla isteği hata döndü; sonuç doğrulanacak', { publication: row.id, containerId, error: String(error) });
    await releaseForRetry(deps.db, row.id);
    throw new RetryLater(PUBLISH_VERIFY_SECONDS, `Yayın sonucu doğrulanacak: ${error instanceof Error ? error.message : String(error)}`);
  }
  const permalink = await instagram.permalink(mediaId).catch(() => null);
  return { igContainerId: containerId, igMediaId: mediaId, permalink };
}

const captionKey = (caption: string | null | undefined) => (caption ?? '').replace(/\s+/g, ' ').trim();

// Yayın isteğinin sonucu: aynı açıklamayla, istekten sonra oluşmuş gönderi hesapta varsa paylaşım yapılmış sayılır.
async function verifyPublished(deps: AutomationDeps, instagram: InstagramClient, row: PublicationRow, attemptedAt: Date): Promise<Published> {
  const key = captionKey(row.caption);
  const since = attemptedAt.getTime() - 5 * 60_000;
  const media = (await instagram.recentMedia(25)).find((item) => captionKey(item.caption) === key && Date.parse(item.timestamp) >= since);
  if (media) return { igContainerId: row.igContainerId ?? undefined, igMediaId: media.id, permalink: media.permalink };
  if (deps.now().getTime() - attemptedAt.getTime() < PUBLISH_VERIFY_WINDOW_MS) {
    await releaseForRetry(deps.db, row.id);
    throw new RetryLater(PUBLISH_VERIFY_SECONDS, 'Yayın sonucu henüz hesapta görünmüyor');
  }
  throw new Error('Yayın isteği gönderildi ama gönderi hesapta bulunamadı; kopya oluşmaması için yeniden gönderilmedi');
}

async function createCarousel(deps: AutomationDeps, instagram: InstagramClient, row: PublicationRow): Promise<string> {
  const children = await createCarouselChildren(deps, instagram, row);
  return instagram.createCarousel(children, row.caption);
}


// TikTok ve Instagram Reels Buffer üzerinden gider: gönderi paylaşım saatinde "şimdi paylaş" olarak açılır ve durumu izlenir.
async function publishViaBuffer(deps: AutomationDeps, row: PublicationRow, service: BufferService): Promise<Published> {
  const label = service === 'tiktok' ? 'TikTok' : 'Instagram Reels';
  if (row.publishAttemptedAt) throw new Error(`${label}: önceki Buffer oluşturma isteğinin sonucu belirsiz. Kopya paylaşımı önlemek için durduruldu; Buffer'daki gönderi kontrol edilmeli.`);
  const buffer = await loadBuffer(deps, service);
  const share = async () => {
    if (!row.media.videoUrl) throw new Error(`${label} videosu yok`);
    await markBufferSubmission(deps.db,row.id,deps.now());
    try {
      return await buffer.client.shareVideoNow({ channelId: buffer.channelId, text: row.caption, videoUrl: row.media.videoUrl, instagramReel: service === 'instagram', isAiGenerated: true });
    } catch(error) {
      if (error instanceof BufferError && (error.rateLimited || (!error.retryable && !error.outcomeUnknown))) {
        await markBufferSubmission(deps.db,row.id,null);
        throw error;
      }
      throw new Error(`${label}: Buffer oluşturma isteğinin sonucu belirsiz; kopya paylaşım engellendi. Buffer'daki gönderi kontrol edilmeli.`);
    }
  };
  let remoteId = row.remoteId;
  if (!remoteId) {
    remoteId = await share();
    await setRemoteId(deps.db, row.id, remoteId);
  }
  let post = await buffer.client.post(remoteId);
  // "Yeniden dene" ile gelen ilk teslimde önceki Buffer gönderisi hata vermişse yeni gönderi açılır; aksi hâlde aynı gönderi izlenir.
  if (post.status === 'error' && row.attempts <= 1 && row.remoteId) {
    remoteId = await share();
    await setRemoteId(deps.db, row.id, remoteId);
    post = await buffer.client.post(remoteId);
  }
  if (post.status === 'sent') return { remoteId, permalink: post.externalLink };
  if (post.status === 'error') throw new Error(`${label} (Buffer): ${post.error ?? 'bilinmeyen hata'}`);
  // Aynı paylaşım için birden fazla kuyruk mesajı olabileceğinden sınır deneme sayısına değil geçen süreye bağlıdır.
  if (deps.now().getTime() > row.scheduledAt.getTime() + BUFFER_TIMEOUT_MS) {
    throw new Error(`${label} paylaşımı zamanında tamamlanmadı (Buffer durumu: ${post.status}${post.error ? `, ${post.error}` : ''})`);
  }
  await releaseForRetry(deps.db, row.id);
  const elapsed = deps.now().getTime() - row.scheduledAt.getTime();
  const lowMonthlyQuota = buffer.client.rateLimits().some((limit) => limit.windowSeconds === 2_592_000 && limit.remaining < 200 && Date.parse(limit.resetsAt) > deps.now().getTime());
  const pollSeconds = lowMonthlyQuota || elapsed >= 40 * 60_000 ? 900 : elapsed >= 10 * 60_000 ? 600 : BUFFER_POLL_SECONDS;
  throw new RetryLater(pollSeconds, `${label} paylaşımı sürüyor`);
}

// Kuyruk tüketicisi: onaylı paylaşımı Instagram'a ya da TikTok'a gönderir. Aynı mesaj iki kez gelse de bir kez paylaşır.
export async function publishPublication(deps: AutomationDeps, id: string): Promise<PublishOutcome> {
  const now = deps.now();
  const current = await getPublication(deps.db, id);
  if (!current) return 'ignored';
  const { automation } = await getSettings(deps.db);
  if (!automation.enabled || (automation.startDate && current.date < automation.startDate)) return 'ignored';
  if (automation.startDate && istanbulDateKey(now) < automation.startDate) {
    throw new RetryLater(Math.max(1, Math.ceil((istanbulDayStart(automation.startDate).getTime() - now.getTime()) / 1000)), 'Otomasyon başlangıcı bekleniyor');
  }
  // Planlanan saatten önce paylaşılmaz; erken gelen teslim saatine ertelenir.
  const early = current.scheduledAt.getTime() - now.getTime();
  if (current.status === 'approved' && early > 60_000) throw new RetryLater(Math.ceil(early / 1000), 'Planlanan saat gelmedi');
  const started = current.igContainerId !== null || current.remoteId !== null || current.publishAttemptedAt !== null;
  if (current.status === 'approved' && !started) {
    const { cutoffTime } = automation;
    // Gün sonu saatine kadar başlayamayan paylaşım o gün yapılmaz; başlamış olan (ör. doğrulama bekleyen) tamamlanır.
    if (now.getTime() > istanbulInstant(current.date, cutoffTime).getTime()) {
      await markExpired(deps.db, id, `Gün sonu saati (${cutoffTime}) geçti; bugün paylaşılmadı`);
      await notify(deps, `⌛ Paylaşılmadı · ${escapeHtml(publicationLabel(current))}\n<i>Gün sonu saati (${cutoffTime}) geçti.</i>`, true);
      await refreshDayMessage(deps, current.date);
      return 'expired';
    }
  }
  // Bizim Instagram uygulamamızdan yalnız carousel'ler gider; Reels ve TikTok Buffer'dan.
  const row = await claimForPublishing(deps.db, id, now, { exclusiveInstagram: current.format === 'carousel' });
  if (!row) {
    if (current.status === 'publishing') throw new RetryLater(600, 'Paylaşım başka bir teslimde sürüyor');
    if (current.status === 'approved') throw new RetryLater(INSTAGRAM_TURN_SECONDS, 'Sırada başka bir Instagram paylaşımı var');
    return 'ignored';
  }

  try {
    const { silent, ...result } =
      row.format === 'tiktok'
        ? await publishViaBuffer(deps, row, 'tiktok')
        : row.format === 'reels'
          ? await publishViaBuffer(deps, row, 'instagram')
          : await publishToInstagram(deps, row);
    await markPublished(deps.db, id, result, deps.now());
    if (row.format === 'reels' && row.media.videoUrl) {
      try {
        const ytBuffer = await loadBuffer(deps, 'youtube');
        if (ytBuffer) {
          const ytTitle = `${row.caption.split('\n')[0].replace(/[#*]/g, '').trim().slice(0, 85)} #Shorts`;
          try {
            await ytBuffer.client.shareVideoNow({
              channelId: ytBuffer.channelId,
              text: row.caption,
              videoUrl: row.media.videoUrl,
              youtube: { title: ytTitle },
              isAiGenerated: true,
            });
            if (!silent) await notify(deps, `▶️ YouTube Shorts'a da gönderildi · ${escapeHtml(publicationLabel(row))}`, true);
          } catch (shortErr) {
            const shortMsg = shortErr instanceof Error ? shortErr.message : String(shortErr);
            if (shortMsg.toLowerCase().includes('3 minutes') || shortMsg.toLowerCase().includes('youtube shorts')) {
              const cleanTitle = row.caption.split('\n')[0].replace(/[#*]/g, '').trim().slice(0, 95);
              const cleanCaption = row.caption.replace(/#shorts?\b/gi, '').trim();
              await ytBuffer.client.shareVideoNow({
                channelId: ytBuffer.channelId,
                text: cleanCaption,
                videoUrl: row.media.videoUrl,
                youtube: { title: cleanTitle },
                isAiGenerated: true,
              });
              if (!silent) await notify(deps, `▶️ YouTube'a (video) gönderildi · ${escapeHtml(publicationLabel(row))}\n<i>Süre 3 dakikayı aştığı için normal video olarak paylaşıldı.</i>`, true);
            } else {
              throw shortErr;
            }
          }
        }
      } catch (ytError) {
        console.error('YouTube Shorts paylaşımı atlandı/başarısız', ytError);
        const ytMsg = ytError instanceof Error ? ytError.message : String(ytError);
        await notify(deps, `⚠️ YouTube Shorts paylaşılamadı · ${escapeHtml(publicationLabel(row))}\n<i>${escapeHtml(ytMsg)}</i>`, true);
      }
    }
    if (!silent) {
      const link = result.permalink ? ` · <a href="${escapeHtml(result.permalink)}">gör</a>` : '';
      await notify(deps, `📤 Paylaşıldı · ${escapeHtml(publicationLabel(row))}${link}`, true);
    }
    await refreshDayMessage(deps, row.date);
    return 'published';
  } catch (error) {
    if (error instanceof RetryLater) throw error;
    if (error instanceof BufferError && error.rateLimited) {
      // Oluşturma bu teslimde tamamlanmış olabilir; claim'den gelen row henüz kimliği içermez.
      const accepted = (await getPublication(deps.db, id))?.remoteId != null;
      if (accepted || deps.now().getTime() + (error.retryAfterSeconds ?? 300)*1000 < row.scheduledAt.getTime() + BUFFER_TIMEOUT_MS) {
        await releaseForRetry(deps.db, id);
        // Uzun kota beklemesinde mevcut mesajın ömrü dolabilir; günlük bakım izlemeyi yeniler.
        const delay = accepted ? Math.min(error.retryAfterSeconds ?? 300, 43_200) : error.retryAfterSeconds ?? 300;
        throw new RetryLater(delay, `Buffer kota beklemesi: ${error.message}`);
      }
      await markFailed(deps.db,id,'Buffer kotası bu paylaşımın yayın penceresinde yenilenmiyor; paylaşım durduruldu.');
      await notify(deps,`❌ Paylaşılamadı · ${escapeHtml(publicationLabel(row))}\n<i>Buffer kotası yayın penceresinde yenilenmiyor.</i>`);
      await refreshDayMessage(deps,row.date);
      return 'failed';
    }
    if (error instanceof InstagramError && error.rateLimited && deps.now().getTime() < row.scheduledAt.getTime() + RATE_LIMIT_WINDOW_MS) {
      await releaseForRetry(deps.db, id);
      throw new RetryLater(RATE_LIMIT_RETRY_SECONDS, `Instagram çağrı sınırı: ${error.message}`);
    }
    if ((error instanceof InstagramError || error instanceof BufferError) && error.retryable && row.attempts < MAX_TRANSIENT_ATTEMPTS) {
      await releaseForRetry(deps.db, id);
      throw new RetryLater(120 * row.attempts, error.message);
    }
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(deps.db, id, message);
    await notify(deps, `❌ Paylaşılamadı · ${escapeHtml(publicationLabel(row))}\n<i>${escapeHtml(message.slice(0, 300))}</i>`);
    await refreshDayMessage(deps, row.date);
    return 'failed';
  }
}

export async function connectTelegram(deps: AutomationDeps, token: string): Promise<{ username: string }> {
  if (!deps.automationSecret) throw new Error('AUTOMATION_SECRET tanımlı değil');
  const client = createTelegramClient(token, deps.fetch);
  const bot = await client.getMe();
  await client.setWebhook(`${deps.appUrl}/api/telegram/webhook`, telegramWebhookSecret(deps.automationSecret));
  await saveIntegration(deps.db, {
    id: 'telegram',
    secretEncrypted: encryptSecret(token, deps.integrationsKey),
    account: { id: String(bot.id), username: bot.username },
    expiresAt: null,
  });
  return { username: bot.username };
}

export async function connectInstagram(deps: AutomationDeps, token: string): Promise<{ username: string | null }> {
  const account = await fetchInstagramAccount(token, deps.fetch);
  await createInstagramClient({ token, userId: account.id, fetch: deps.fetch })
    .publishingLimit()
    .catch((error: unknown) => {
      throw new InstagramError(
        `Anahtarda paylaşım izni (instagram_business_content_publish) yok ya da doğrulanamadı: ${error instanceof Error ? error.message : String(error)}`,
        null,
        false,
      );
    });
  await saveIntegration(deps.db, {
    id: 'instagram',
    secretEncrypted: encryptSecret(token, deps.integrationsKey),
    account,
    expiresAt: new Date(deps.now().getTime() + INSTAGRAM_TOKEN_LIFETIME_MS),
  });
  return { username: account.username };
}

export type AutomationStatus = {
  telegram: { username: string | null; chatLinked: boolean; webhookOk: boolean; pendingUpdates: number | null; lastError: string | null } | null;
  instagram: { username: string | null; expiresAt: string | null; publishing: { ok: true; used: number; total: number } | { ok: false; error: string } } | null;
  tiktok: { channel: string | null; enabled: boolean; ok: boolean; error: string | null } | null;
  instagramReels: { channel: string | null; ok: boolean; error: string | null } | null;
  youtube: { channel: string | null; ok: boolean; error: string | null } | null;
  bufferRateLimits: BufferRateLimit[];
  renderTrigger: boolean;
};

export async function automationStatus(deps: AutomationDeps): Promise<AutomationStatus> {
  const [telegramRow, instagramRow, bufferRow, githubRow, settings, bufferInstagramRow, bufferYoutubeRow] = await Promise.all([
    getIntegration(deps.db, 'telegram'),
    getIntegration(deps.db, 'instagram'),
    getIntegration(deps.db, 'buffer'),
    getIntegration(deps.db, 'github'),
    getSettings(deps.db),
    getIntegration(deps.db, 'buffer_instagram'),
    getIntegration(deps.db, 'buffer_youtube'),
  ]);
  let telegram: AutomationStatus['telegram'] = null;
  if (telegramRow) {
    const account = {username: telegramRow.account.username, chatLinked: settings.automation.telegramChatId !== null};
    try {
      const info = await createTelegramClient(decryptSecret(telegramRow.secretEncrypted, deps.integrationsKey), deps.fetch).getWebhookInfo();
      telegram = {...account, webhookOk: info.url === `${deps.appUrl}/api/telegram/webhook`, pendingUpdates: info.pending_update_count, lastError: info.last_error_message ?? null};
    } catch(error) {
      telegram = {...account, webhookOk: false, pendingUpdates: null, lastError: error instanceof Error ? error.message : String(error)};
    }
  }
  let instagram: AutomationStatus['instagram'] = null;
  if (instagramRow) {
    const publishing = await (await loadInstagram(deps))
      .publishingLimit()
      .then((limit) => ({ ok: true as const, ...limit }))
      .catch((error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }));
    instagram = { username: instagramRow.account.username, expiresAt: instagramRow.expiresAt?.toISOString() ?? null, publishing };
  }
  let tiktok: AutomationStatus['tiktok'] = null;
  let instagramReels: AutomationStatus['instagramReels'] = null;
  let youtube: AutomationStatus['youtube'] = null;
  let bufferRateLimits = bufferRow?.account.rateLimits ?? [];
  if (bufferRow) {
    const {client} = await loadBuffer(deps);
    let instagramChannelId = bufferInstagramRow?.account.id;
    let discoveryError: string | null = null;
    if (!instagramChannelId) {
      try { instagramChannelId = (await loadBuffer(deps,'instagram')).channelId; }
      catch (error) { discoveryError = error instanceof Error ? error.message : String(error); }
    }
    let youtubeChannelId = bufferYoutubeRow?.account.id;
    let ytDiscoveryError: string | null = null;
    if (!youtubeChannelId) {
      try { youtubeChannelId = (await loadBuffer(deps, 'youtube')).channelId; }
      catch (error) { ytDiscoveryError = error instanceof Error ? error.message : String(error); }
    }
    try {
      const channelIds = [
        bufferRow.account.id,
        ...(instagramChannelId ? [instagramChannelId] : []),
        ...(youtubeChannelId ? [youtubeChannelId] : []),
      ];
      const channels = await client.channelStates(channelIds);
      const checked = (channel:typeof channels[number]) => ({channel:channel.name,ok:!channel.isQueuePaused,error:channel.isQueuePaused ? "Buffer'da kanal kuyruğu duraklatılmış" : null});
      tiktok = {...checked(channels[0]),enabled:settings.automation.tiktok.enabled};
      instagramReels = channels[1] ? checked(channels[1]) : {channel:null,ok:false,error:discoveryError ?? 'Instagram Reels kanalı bağlı değil'};
      youtube = channels[2] ? checked(channels[2]) : {channel:null,ok:false,error:ytDiscoveryError ?? 'YouTube kanalı bağlı değil'};
    } catch(error) {
      const checked = {ok:false,error:error instanceof Error ? error.message : String(error)};
      tiktok = {channel:bufferRow.account.username,enabled:settings.automation.tiktok.enabled,...checked};
      instagramReels = {channel:bufferInstagramRow?.account.username ?? null,...checked};
      youtube = {channel:bufferYoutubeRow?.account.username ?? null,...checked};
    }
    bufferRateLimits = [...client.rateLimits()];
  }
  return { telegram, instagram, tiktok, instagramReels, youtube, bufferRateLimits, renderTrigger: githubRow !== null };
}

export function describeStatus(status: AutomationStatus): string {
  const lines = ['<b>🔧 Otomasyon durumu</b>'];
  const { telegram, instagram } = status;
  lines.push(telegram ? `Telegram: @${escapeHtml(telegram.username ?? '?')} · webhook ${telegram.webhookOk ? '✅' : '❌'}${telegram.lastError ? ` (${escapeHtml(telegram.lastError)})` : ''}` : 'Telegram: ❌ bağlı değil');
  if (!instagram) lines.push('Instagram: ❌ bağlı değil');
  else {
    const until = instagram.expiresAt ? new Date(instagram.expiresAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '?';
    lines.push(`Instagram: @${escapeHtml(instagram.username ?? '?')} · anahtar ${until} tarihine kadar`);
    lines.push(
      instagram.publishing.ok
        ? `Paylaşım izni ✅ · son 24 saatte ${instagram.publishing.used}/${instagram.publishing.total} paylaşım`
        : `Paylaşım izni ❌ ${escapeHtml(instagram.publishing.error)}`,
    );
  }
  const { tiktok, youtube } = status;
  lines.push(
    tiktok
      ? `TikTok (Buffer): ${escapeHtml(tiktok.channel ?? '?')} · ${tiktok.ok ? '✅' : `❌ ${escapeHtml(tiktok.error ?? '')}`}${tiktok.enabled ? '' : ' · paylaşım kapalı'}`
      : 'TikTok (Buffer): ❌ bağlı değil',
  );
  lines.push(status.renderTrigger ? 'Hazırlık tetikleyicisi (GitHub): ✅' : 'Hazırlık tetikleyicisi (GitHub): ❌ bağlı değil · yedek zamanlama kullanılıyor');
  lines.push(status.instagramReels ? `Instagram Reels (Buffer): ${escapeHtml(status.instagramReels.channel ?? '?')} · ${status.instagramReels.ok ? '✅' : `❌ ${escapeHtml(status.instagramReels.error ?? '')}`}` : 'Instagram Reels (Buffer): ❌ bağlı değil');
  lines.push(youtube ? `YouTube Shorts (Buffer): ${escapeHtml(youtube.channel ?? '?')} · ${youtube.ok ? '✅' : `❌ ${escapeHtml(youtube.error ?? '')}`}` : 'YouTube Shorts (Buffer): ❌ bağlı değil');
  for (const limit of status.bufferRateLimits) {
    const period = limit.windowSeconds === 900 ? '15 dakika' : limit.windowSeconds === 86400 ? '24 saat' : limit.windowSeconds === 2592000 ? '30 gün' : `${limit.windowSeconds} sn`;
    lines.push(`Buffer (${period}): ${limit.remaining}/${limit.limit} istek kaldı · kayıt yenilenmesi ${new Date(limit.resetsAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}`);
  }
  return lines.join('\n');
}

export async function connectBuffer(deps: AutomationDeps, apiKey: string): Promise<{ channel: string }> {
  const [channel] = await createBufferClient(apiKey, deps.fetch).tiktokChannels();
  if (!channel) throw new BufferError("Buffer hesabında bağlı TikTok kanalı bulunamadı. Önce Buffer'da TikTok'u bağla.", false);
  await saveIntegration(deps.db, {
    id: 'buffer',
    secretEncrypted: encryptSecret(apiKey, deps.integrationsKey),
    account: { id: channel.id, username: channel.name },
    expiresAt: null,
  });
  await saveSettings(deps.db, { automation: { tiktok: { enabled: true } } });
  return { channel: channel.name };
}

export async function connectGitHub(deps: AutomationDeps, token: string): Promise<{ repository: string }> {
  if (!(await verifyRenderWorkflowAccess({ token, repository: deps.repository, fetch: deps.fetch }))) {
    throw new Error(`Anahtar ${deps.repository} deposunun iş akışlarına erişemiyor; depo seçimini ve "Actions: Read and write" iznini kontrol et.`);
  }
  await saveIntegration(deps.db, {
    id: 'github',
    secretEncrypted: encryptSecret(token, deps.integrationsKey),
    account: { id: deps.repository, username: null },
    expiresAt: null,
  });
  return { repository: deps.repository };
}

export async function startRender(deps: AutomationDeps, date: DateKey, options: { force?: boolean; only?: string } = {}): Promise<{ dispatched: boolean; reason?: string }> {
  const { automation } = await getSettings(deps.db);
  const paused = automationStartReason(automation.startDate, date, deps.now());
  if (!automation.enabled || paused) return { dispatched: false, reason: paused ?? 'Otomatik paylaşım kapalı.' };
  const integration = await getIntegration(deps.db, 'github');
  const token = integration ? decryptSecret(integration.secretEncrypted, deps.integrationsKey) : undefined;
  return dispatchRenderWorkflow({ token, repository: deps.repository, date, force: options.force, only: options.only, fetch: deps.fetch });
}

// Kuyruk mesajları gönderildikleri yayın sürümünde işlenir; gün içinde yayınlanan düzeltmenin bekleyen paylaşımlara
// uygulanması için onaylı ve başarısız paylaşımlar yeni sürümün kuyruğuna yeniden bırakılır (paylaşım iki kez gitmez).
export async function requeueDay(deps: AutomationDeps, date: DateKey): Promise<{ requeued: number; retried: number }> {
  const { automation } = await getSettings(deps.db);
  if (!automation.enabled || automationStartReason(automation.startDate, date, deps.now())) return { requeued: 0, retried: 0 };
  const rows = await listPublications(deps.db, date);
  const now = deps.now();
  const retried: PublicationRow[] = [];
  for (const group of new Map(rows.filter((row) => row.status === 'failed').map((row) => [`${row.postId}:${row.format}`, row])).values()) {
    retried.push(...(await retryFailedGroup(deps.db, { postId: group.postId, format: group.format }, now)));
  }
  const approved = rows.filter((row) => row.status === 'approved');
  await enqueueRows(deps, [...approved, ...retried]);
  return { requeued: approved.length, retried: retried.length };
}

// Günün hazır ya da yayınlanmış Reels videolarını YouTube Shorts olarak Buffer kuyruğuna gönderir.
export async function syncYouTubeShorts(deps: AutomationDeps, date: DateKey): Promise<{ sent: number; errors: string[] }> {
  const rows = (await listPublications(deps.db, date)).filter((row) => row.format === 'reels' && row.media.videoUrl);
  if (rows.length === 0) return { sent: 0, errors: ['Günün hazır veya yayınlanmış Reels videosu bulunamadı.'] };
  const ytBuffer = await loadBuffer(deps, 'youtube');
  let sent = 0;
  const errors: string[] = [];
  for (const row of rows) {
    try {
      const ytTitle = `${row.caption.split('\n')[0].replace(/[#*]/g, '').trim().slice(0, 85)} #Shorts`;
      try {
        await ytBuffer.client.shareVideoNow({
          channelId: ytBuffer.channelId,
          text: row.caption,
          videoUrl: row.media.videoUrl!,
          youtube: { title: ytTitle },
          ...(row.media.isAiGenerated ? { isAiGenerated: true } : {}),
        });
        sent++;
        await notify(deps, `▶️ YouTube Shorts'a gönderildi · ${escapeHtml(publicationLabel(row))}`, true);
      } catch (shortErr) {
        const shortMsg = shortErr instanceof Error ? shortErr.message : String(shortErr);
        if (shortMsg.toLowerCase().includes('3 minutes') || shortMsg.toLowerCase().includes('youtube shorts')) {
          const cleanTitle = row.caption.split('\n')[0].replace(/[#*]/g, '').trim().slice(0, 95);
          const cleanCaption = row.caption.replace(/#shorts?\b/gi, '').trim();
          await ytBuffer.client.shareVideoNow({
            channelId: ytBuffer.channelId,
            text: cleanCaption,
            videoUrl: row.media.videoUrl!,
            youtube: { title: cleanTitle },
            ...(row.media.isAiGenerated ? { isAiGenerated: true } : {}),
          });
          sent++;
          await notify(deps, `▶️ YouTube'a (video) gönderildi · ${escapeHtml(publicationLabel(row))}\n<i>Süre 3 dakikayı aştığı için normal video olarak paylaşıldı.</i>`, true);
        } else {
          throw shortErr;
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${publicationLabel(row)}: ${msg}`);
      await notify(deps, `⚠️ YouTube Shorts gönderilemedi · ${escapeHtml(publicationLabel(row))}\n<i>${escapeHtml(msg)}</i>`, true);
    }
  }
  return { sent, errors };
}

export type PublishNowResult = { id: string; label: string; outcome: PublishOutcome | 'retry'; message?: string };

// Kuyruğun yeniden teslimini beklemeden, saati gelmiş onaylı paylaşımları bu istekte gönderir (Instagram işlemesi dahil).
export async function publishDueNow(deps: AutomationDeps, date: DateKey, limit: number): Promise<PublishNowResult[]> {
  const now = deps.now();
  const { automation } = await getSettings(deps.db);
  if (!automation.enabled || automationStartReason(automation.startDate, date, now)) return [];
  const due = (await listPublications(deps.db, date)).filter((row) => row.status === 'approved' && row.scheduledAt.getTime() <= now.getTime()).slice(0, limit);
  const results: PublishNowResult[] = [];
  for (const row of due) {
    let result: PublishNowResult = { id: row.id, label: publicationLabel(row), outcome: 'retry' };
    for (let attempt = 0; attempt <= MAX_CONTAINER_REBUILDS && result.outcome === 'retry'; attempt++) {
      try {
        result = { ...result, outcome: await publishPublication(deps, row.id) };
      } catch (error) {
        if (!(error instanceof RetryLater)) throw error;
        result = { ...result, outcome: 'retry', message: error.message };
      }
    }
    results.push(result);
  }
  return results;
}

export type CarouselVariantResult = { items: number[]; status: string };

// Tanı: yayınlamadan, aynı görsellerle farklı öğe kombinasyonlarında carousel kurup Instagram'ın hangisini reddettiğini gösterir.
// Kurulan container'lar hiçbir zaman yayınlanmaz; Instagram 24 saatte kendiliğinden siler.
export async function diagnoseCarousel(deps: AutomationDeps, publicationId: string, variants: number[][]): Promise<{ items: string[]; variants: CarouselVariantResult[] }> {
  const row = await getPublication(deps.db, publicationId);
  if (!row || row.format !== 'carousel') throw new Error('Carousel paylaşımı bulunamadı');
  const instagram = await loadInstagram(deps);
  const children = await createCarouselChildren(deps, instagram, row);
  const results: CarouselVariantResult[] = [];
  for (const items of variants) {
    await deps.sleep(CAROUSEL_PARENT_DELAY_MS);
    const parent = await instagram.createCarousel(items.map((index) => children[index]), 'Tanı denemesi');
    results.push({ items, status: await pollContainer(deps, instagram, parent) });
  }
  return { items: children, variants: results };
}

// Tanı: hesaptaki son gönderiler (salt okunur).
export async function instagramRecentMedia(deps: AutomationDeps, limit: number) {
  return (await loadInstagram(deps)).recentMedia(limit);
}

export async function bufferPostStatus(deps: AutomationDeps, remoteId: string) {
  return (await loadBuffer(deps)).client.post(remoteId);
}

export type MaintenanceResult = { expired: number; deletedImages: number; deletedVideos: number; tokenRefreshed: boolean; skipped?: string };

export async function runMaintenance(deps: AutomationDeps): Promise<MaintenanceResult> {
  const now = deps.now();
  const { automation } = await getSettings(deps.db);
  const paused = automationStartReason(automation.startDate, istanbulDateKey(now), now);
  if (paused) return { expired: 0, deletedImages: 0, deletedVideos: 0, tokenRefreshed: false, skipped: paused };
  const expired = await expireUnapproved(deps.db, istanbulDateKey(now));
  if (automation.enabled) await enqueueRows(deps, await listPendingBufferVerifications(deps.db));
  const cutoff = new Date(now.getTime() - MEDIA_RETENTION_DAYS * DAY_MS);
  const deletedImages = await deleteMediaBefore(deps.db, cutoff);
  const deletedVideos = await deps.deleteVideosBefore(cutoff);

  let tokenRefreshed = false;
  const instagram = await getIntegration(deps.db, 'instagram');
  if (instagram?.expiresAt && instagram.expiresAt.getTime() - now.getTime() < TOKEN_REFRESH_WINDOW_MS) {
    try {
      const refreshed = await refreshInstagramToken(decryptSecret(instagram.secretEncrypted, deps.integrationsKey), deps.fetch);
      await saveIntegration(deps.db, {
        ...instagram,
        secretEncrypted: encryptSecret(refreshed.token, deps.integrationsKey),
        expiresAt: new Date(now.getTime() + refreshed.expiresInSeconds * 1000),
      });
      tokenRefreshed = true;
    } catch (error) {
      const days = Math.max(0, Math.floor((instagram.expiresAt.getTime() - now.getTime()) / DAY_MS));
      await notify(
        deps,
        `⚠️ Instagram erişim anahtarı yenilenemedi (${days} gün kaldı).\n<i>${escapeHtml(error instanceof Error ? error.message : String(error))}</i>\nAyarlar → Otomasyon'dan yeni anahtar girilmeli.`,
      );
    }
  }
  return { expired, deletedImages, deletedVideos, tokenRefreshed };
}
