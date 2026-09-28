import type { Db } from '@/db/types';
import { BufferError, createBufferClient, type BufferClient } from '@/lib/buffer/client';
import { istanbulDateKey, type DateKey } from '@/lib/date/istanbul';
import { createInstagramClient, fetchInstagramAccount, InstagramError, refreshInstagramToken, type InstagramClient } from '@/lib/instagram/client';
import { getSettings, saveSettings } from '@/lib/settings/repository';
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
  markForRebuild,
  markFailed,
  markPublished,
  releaseForRetry,
  retryFailedGroup,
  saveIntegration,
  setContainer,
  setGroupSkipped,
  setRemoteId,
  setTelegramMessageId,
  type PublicationRow,
} from './repository';
import { decryptSecret, encryptSecret, telegramWebhookSecret } from './secrets';

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
const TIKTOK_POLL_SECONDS = 60;
const INLINE_STATUS_CHECKS = 3;
const MAX_CONTAINER_REBUILDS = 1;
const INLINE_STATUS_WAIT_MS = 8_000;
// Meta'nın saatlik çağrı sınırı dolduysa bu aralıkla, planlanan saatten sonra en fazla bu süre boyunca denenir.
const RATE_LIMIT_RETRY_SECONDS = 15 * 60;
const RATE_LIMIT_WINDOW_MS = 4 * 3_600_000;
// TikTok videoyu işlerken Buffer "sending"de kalır; ~30 dakika beklenir.
const MAX_TIKTOK_ATTEMPTS = 30;
// Reels işleme için ~10 dakika; geçici Instagram hataları için 5 deneme.
const MAX_PROCESSING_ATTEMPTS = 20;
const MAX_TRANSIENT_ATTEMPTS = 5;
const MEDIA_RETENTION_DAYS = 3;
const TOKEN_REFRESH_WINDOW_MS = 20 * DAY_MS;
const INSTAGRAM_TOKEN_LIFETIME_MS = 60 * DAY_MS;

export const mediaUrlFor = (appUrl: string) => (id: string) => `${appUrl}/api/media/${id}`;

async function loadTelegram(deps: AutomationDeps): Promise<{ client: TelegramClient; chatId: number | null } | null> {
  const integration = await getIntegration(deps.db, 'telegram');
  if (!integration) return null;
  const settings = await getSettings(deps.db);
  return { client: createTelegramClient(decryptSecret(integration.secretEncrypted, deps.integrationsKey), deps.fetch), chatId: settings.automation.telegramChatId };
}

async function loadBuffer(deps: AutomationDeps): Promise<{ client: BufferClient; channelId: string }> {
  const integration = await getIntegration(deps.db, 'buffer');
  if (!integration) throw new Error('TikTok (Buffer) bağlı değil. Ayarlar → Otomatik paylaşım bölümünden Buffer API anahtarını gir.');
  return { client: createBufferClient(decryptSecret(integration.secretEncrypted, deps.integrationsKey), deps.fetch), channelId: integration.account.id };
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

async function createContainer(deps: AutomationDeps, instagram: InstagramClient, row: PublicationRow): Promise<string> {
  if (row.format === 'reels') {
    if (!row.media.videoUrl) throw new Error('Reels videosu yok');
    return instagram.createReels(row.media.videoUrl, row.caption);
  }
  const imageIds = row.media.imageIds ?? [];
  if (imageIds.length < 2) throw new Error('Carousel görselleri eksik (bakım silmiş olabilir)');
  const mediaUrl = mediaUrlFor(deps.appUrl);
  const children: string[] = [];
  for (const id of imageIds) children.push(await instagram.createCarouselItem(mediaUrl(id)));
  return instagram.createCarousel(children, row.caption);
}

export type PublishOutcome = 'published' | 'failed' | 'ignored';
type Published = { igContainerId?: string; igMediaId?: string | null; remoteId?: string; permalink: string | null; silent?: boolean };

// Instagram carousel ve Reels'i zaman zaman geçici olarak ERROR'a düşürür; container sınırlı sayıda baştan kurulur.
async function rebuildOrFail(deps: AutomationDeps, instagram: InstagramClient, row: PublicationRow, containerId: string, status: string): Promise<never> {
  const detail = await instagram.containerDetail(containerId).catch(() => null);
  console.error('Instagram container hatası', { publication: row.id, containerId, status, detail, rebuilds: row.rebuilds });
  if (row.rebuilds < MAX_CONTAINER_REBUILDS) {
    await markForRebuild(deps.db, row.id);
    throw new RetryLater(REELS_POLL_SECONDS, `Instagram medyayı işleyemedi (${status}); yeniden kuruluyor`);
  }
  throw new Error(`Instagram medyayı işleyemedi (${status})${detail ? `: ${detail}` : ''}`);
}

async function publishToInstagram(deps: AutomationDeps, row: PublicationRow): Promise<Published> {
  const instagram = await loadInstagram(deps);
  let containerId = row.igContainerId;
  if (containerId) {
    const status = await instagram.containerStatus(containerId);
    // Önceki deneme paylaşıp sonucu yazamadan düştüyse ikinci kez yayınlanmaz.
    if (status === 'PUBLISHED') return { igContainerId: containerId, igMediaId: null, permalink: null, silent: true };
    if (status === 'EXPIRED' || status === 'ERROR') await rebuildOrFail(deps, instagram, row, containerId, status);
  }
  if (!containerId) {
    containerId = await createContainer(deps, instagram, row);
    await setContainer(deps.db, row.id, containerId);
  }
  // Görseller genelde saniyeler içinde işlenir; kuyruğun yeniden teslimi dakikalar sürdüğü için önce kısa süre burada beklenir.
  let status = await instagram.containerStatus(containerId);
  for (let check = 0; status === 'IN_PROGRESS' && check < INLINE_STATUS_CHECKS; check++) {
    await deps.sleep(INLINE_STATUS_WAIT_MS);
    status = await instagram.containerStatus(containerId);
  }
  if (status === 'IN_PROGRESS') {
    if (row.attempts >= MAX_PROCESSING_ATTEMPTS) throw new Error('Instagram medyayı zamanında işleyemedi');
    await releaseForRetry(deps.db, row.id);
    throw new RetryLater(REELS_POLL_SECONDS, 'Instagram medyayı işliyor');
  }
  if (status !== 'FINISHED') await rebuildOrFail(deps, instagram, row, containerId, status);
  const mediaId = await instagram.publish(containerId);
  const permalink = await instagram.permalink(mediaId).catch(() => null);
  return { igContainerId: containerId, igMediaId: mediaId, permalink };
}

async function publishToTikTok(deps: AutomationDeps, row: PublicationRow): Promise<Published> {
  const buffer = await loadBuffer(deps);
  let remoteId = row.remoteId;
  if (!remoteId) {
    if (!row.media.videoUrl) throw new Error('TikTok videosu yok');
    remoteId = await buffer.client.shareVideoNow({ channelId: buffer.channelId, text: row.caption, videoUrl: row.media.videoUrl });
    await setRemoteId(deps.db, row.id, remoteId);
  }
  const post = await buffer.client.post(remoteId);
  if (post.status === 'sent') return { remoteId, permalink: post.externalLink };
  if (post.status === 'error') throw new Error(`TikTok (Buffer): ${post.error ?? 'bilinmeyen hata'}`);
  if (row.attempts >= MAX_TIKTOK_ATTEMPTS) throw new Error('TikTok paylaşımı zamanında tamamlanmadı');
  await releaseForRetry(deps.db, row.id);
  throw new RetryLater(TIKTOK_POLL_SECONDS, 'TikTok paylaşımı sürüyor');
}

// Kuyruk tüketicisi: onaylı paylaşımı Instagram'a ya da TikTok'a gönderir. Aynı mesaj iki kez gelse de bir kez paylaşır.
export async function publishPublication(deps: AutomationDeps, id: string): Promise<PublishOutcome> {
  const now = deps.now();
  const current = await getPublication(deps.db, id);
  if (!current) return 'ignored';
  // Planlanan saatten önce paylaşılmaz; erken gelen teslim saatine ertelenir.
  const early = current.scheduledAt.getTime() - now.getTime();
  if (current.status === 'approved' && early > 60_000) throw new RetryLater(Math.ceil(early / 1000), 'Planlanan saat gelmedi');
  const row = await claimForPublishing(deps.db, id, now);
  if (!row) {
    if (current.status === 'publishing') throw new RetryLater(600, 'Paylaşım başka bir teslimde sürüyor');
    return 'ignored';
  }

  try {
    const { silent, ...result } = row.format === 'tiktok' ? await publishToTikTok(deps, row) : await publishToInstagram(deps, row);
    await markPublished(deps.db, id, result, deps.now());
    if (!silent) {
      const link = result.permalink ? ` · <a href="${escapeHtml(result.permalink)}">gör</a>` : '';
      await notify(deps, `📤 Paylaşıldı · ${escapeHtml(publicationLabel(row))}${link}`, true);
    }
    await refreshDayMessage(deps, row.date);
    return 'published';
  } catch (error) {
    if (error instanceof RetryLater) throw error;
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
  telegram: { username: string | null; chatLinked: boolean; webhookOk: boolean; pendingUpdates: number; lastError: string | null } | null;
  instagram: { username: string | null; expiresAt: string | null; publishing: { ok: true; used: number; total: number } | { ok: false; error: string } } | null;
  tiktok: { channel: string | null; enabled: boolean; ok: boolean; error: string | null } | null;
  renderTrigger: boolean;
};

export async function automationStatus(deps: AutomationDeps): Promise<AutomationStatus> {
  const [telegramRow, instagramRow, bufferRow, githubRow, settings] = await Promise.all([
    getIntegration(deps.db, 'telegram'),
    getIntegration(deps.db, 'instagram'),
    getIntegration(deps.db, 'buffer'),
    getIntegration(deps.db, 'github'),
    getSettings(deps.db),
  ]);
  let telegram: AutomationStatus['telegram'] = null;
  if (telegramRow) {
    const info = await createTelegramClient(decryptSecret(telegramRow.secretEncrypted, deps.integrationsKey), deps.fetch).getWebhookInfo();
    telegram = {
      username: telegramRow.account.username,
      chatLinked: settings.automation.telegramChatId !== null,
      webhookOk: info.url === `${deps.appUrl}/api/telegram/webhook`,
      pendingUpdates: info.pending_update_count,
      lastError: info.last_error_message ?? null,
    };
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
  if (bufferRow) {
    const checked = await (await loadBuffer(deps)).client
      .channel(bufferRow.account.id)
      .then((channel) => ({ ok: !channel.isQueuePaused, error: channel.isQueuePaused ? "Buffer'da kanal kuyruğu duraklatılmış" : null }))
      .catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    tiktok = { channel: bufferRow.account.username, enabled: settings.automation.tiktok.enabled, ...checked };
  }
  return { telegram, instagram, tiktok, renderTrigger: githubRow !== null };
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
  const { tiktok } = status;
  lines.push(
    tiktok
      ? `TikTok (Buffer): ${escapeHtml(tiktok.channel ?? '?')} · ${tiktok.ok ? '✅' : `❌ ${escapeHtml(tiktok.error ?? '')}`}${tiktok.enabled ? '' : ' · paylaşım kapalı'}`
      : 'TikTok (Buffer): ❌ bağlı değil',
  );
  lines.push(status.renderTrigger ? 'Hazırlık tetikleyicisi (GitHub): ✅' : 'Hazırlık tetikleyicisi (GitHub): ❌ bağlı değil · yedek zamanlama kullanılıyor');
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

export async function startRender(deps: AutomationDeps, date: DateKey): Promise<{ dispatched: boolean; reason?: string }> {
  const integration = await getIntegration(deps.db, 'github');
  const token = integration ? decryptSecret(integration.secretEncrypted, deps.integrationsKey) : undefined;
  return dispatchRenderWorkflow({ token, repository: deps.repository, date, fetch: deps.fetch });
}

export type MaintenanceResult = { expired: number; deletedImages: number; deletedVideos: number; tokenRefreshed: boolean };

export async function runMaintenance(deps: AutomationDeps): Promise<MaintenanceResult> {
  const now = deps.now();
  const expired = await expireUnapproved(deps.db, istanbulDateKey(now));
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

