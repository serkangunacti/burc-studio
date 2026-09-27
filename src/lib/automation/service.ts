import type { Db } from '@/db/types';
import { istanbulDateKey, type DateKey } from '@/lib/date/istanbul';
import { createInstagramClient, fetchInstagramAccount, InstagramError, refreshInstagramToken, type InstagramClient } from '@/lib/instagram/client';
import { getSettings, saveSettings } from '@/lib/settings/repository';
import { createTelegramClient, escapeHtml, TelegramError, type TelegramClient } from '@/lib/telegram/client';
import { buildDayMessage, groupLabel, parseDayAction } from './day-message';
import {
  approveDay,
  claimForPublishing,
  deleteMediaBefore,
  expireUnapproved,
  getIntegration,
  getPublication,
  listPublications,
  markFailed,
  markPublished,
  releaseForRetry,
  saveIntegration,
  setContainer,
  setGroupSkipped,
  setTelegramMessageId,
  type PublicationRow,
} from './repository';
import { decryptSecret, encryptSecret, telegramWebhookSecret } from './secrets';

export type AutomationDeps = {
  db: Db;
  appUrl: string;
  integrationsKey: string | undefined;
  automationSecret: string | undefined;
  now: () => Date;
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
        await client.sendMessage(from, '✅ Bağlandı. Her sabah günün paylaşımlarını onayına buraya göndereceğim.\n\n/bugun ile bugünün planını istediğin zaman görebilirsin.');
      } else if (chatId === from) {
        await client.sendMessage(from, 'Zaten bağlıyız ✨ /bugun ile bugünün planını görebilirsin.');
      }
      return;
    }
    if (from !== chatId) return;
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
    return;
  }
  const changed = await setGroupSkipped(deps.db, { postId: action.postId, format: action.format, skipped: action.action === 'skip' }, now);
  if (action.action === 'undo') await enqueueRows(deps, changed.filter((row) => row.status === 'approved'));
  await client.answerCallback(query.id, changed.length === 0 ? 'Değişiklik yok.' : action.action === 'skip' ? 'Paylaşılmayacak.' : 'Geri alındı.');
  if (changed[0]) await refreshDayMessage(deps, changed[0].date, query.message.message_id);
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

// Kuyruk tüketicisi: onaylı paylaşımı Instagram'a gönderir. Aynı mesaj iki kez gelse de bir kez paylaşır.
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

  let containerId = row.igContainerId;
  try {
    const instagram = await loadInstagram(deps);
    if (containerId) {
      const status = await instagram.containerStatus(containerId);
      if (status === 'PUBLISHED') {
        await markPublished(deps.db, id, { igContainerId: containerId, igMediaId: null, permalink: null }, now);
        await refreshDayMessage(deps, row.date);
        return 'published';
      }
      if (status === 'EXPIRED') containerId = null;
    }
    if (!containerId) {
      containerId = await createContainer(deps, instagram, row);
      await setContainer(deps.db, id, containerId);
    }
    const status = await instagram.containerStatus(containerId);
    if (status === 'IN_PROGRESS') {
      if (row.attempts >= MAX_PROCESSING_ATTEMPTS) throw new Error('Instagram medyayı zamanında işleyemedi');
      await releaseForRetry(deps.db, id, containerId);
      throw new RetryLater(REELS_POLL_SECONDS, 'Instagram medyayı işliyor');
    }
    if (status !== 'FINISHED') throw new Error(`Instagram medyayı işleyemedi (${status})`);
    const mediaId = await instagram.publish(containerId);
    const permalink = await instagram.permalink(mediaId).catch(() => null);
    await markPublished(deps.db, id, { igContainerId: containerId, igMediaId: mediaId, permalink }, deps.now());
    await notify(deps, `📤 Paylaşıldı · ${escapeHtml(publicationLabel(row))}${permalink ? ` · <a href="${escapeHtml(permalink)}">gör</a>` : ''}`, true);
    await refreshDayMessage(deps, row.date);
    return 'published';
  } catch (error) {
    if (error instanceof RetryLater) throw error;
    if (error instanceof InstagramError && error.retryable && row.attempts < MAX_TRANSIENT_ATTEMPTS) {
      await releaseForRetry(deps.db, id, containerId);
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
  await saveIntegration(deps.db, {
    id: 'instagram',
    secretEncrypted: encryptSecret(token, deps.integrationsKey),
    account,
    expiresAt: new Date(deps.now().getTime() + INSTAGRAM_TOKEN_LIFETIME_MS),
  });
  return { username: account.username };
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

