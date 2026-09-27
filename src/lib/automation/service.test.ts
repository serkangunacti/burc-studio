import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/db/types';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { getSettings, saveSettings } from '@/lib/settings/repository';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { planPublications } from './plan';
import { approveDay, getIntegration, getPublication, listPublications, saveIntegration, savePublication } from './repository';
import { encryptSecret, telegramWebhookSecret } from './secrets';
import {
  connectInstagram,
  connectTelegram,
  handleTelegramUpdate,
  publishPublication,
  RetryLater,
  runMaintenance,
  sendDayPlan,
  type AutomationDeps,
} from './service';

const DATE = '2026-09-29';
const KEY = randomBytes(32).toString('base64');
const CHAT = 5550001;

type Call = { host: 'telegram' | 'instagram'; path: string; params: Record<string, unknown> };

function harness(db: Db, now: Date) {
  const calls: Call[] = [];
  const instagram = vi.fn((path: string, params: Record<string, unknown>): { status?: number; body: unknown } => {
    if (path.endsWith('/media')) return { body: { id: `container-${calls.filter((call) => call.path.endsWith('/media')).length}` } };
    if (path.endsWith('/media_publish')) return { body: { id: 'media-1' } };
    if (params.fields === 'status_code') return { body: { status_code: 'FINISHED' } };
    if (params.fields === 'permalink') return { body: { permalink: 'https://www.instagram.com/p/abc/' } };
    return { body: {} };
  });
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.host === 'api.telegram.org') {
      const method = url.pathname.split('/').pop()!;
      const params = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      calls.push({ host: 'telegram', path: method, params });
      const result = method === 'getMe' ? { id: 42, username: 'kozmikarkan_bot' } : method === 'sendMessage' ? { message_id: 77 } : true;
      return Response.json({ ok: true, result });
    }
    const params = Object.fromEntries(init?.body instanceof URLSearchParams ? init.body : url.searchParams);
    delete params.access_token;
    calls.push({ host: 'instagram', path: url.pathname, params });
    const response = instagram(url.pathname, params);
    return Response.json(response.body, { status: response.status ?? 200 });
  });
  const enqueue = vi.fn(async () => undefined);
  const deps: AutomationDeps = {
    db,
    appUrl: 'https://app.test',
    integrationsKey: KEY,
    automationSecret: 'secret',
    now: () => now,
    fetch: fetchImpl as unknown as typeof fetch,
    enqueue,
    deleteVideosBefore: vi.fn(async () => 2),
  };
  return { deps, calls, instagram, enqueue, telegramCalls: () => calls.filter((call) => call.host === 'telegram'), igCalls: () => calls.filter((call) => call.host === 'instagram') };
}

async function connectAll(db: Db) {
  await saveIntegration(db, { id: 'telegram', secretEncrypted: encryptSecret('BOT', KEY), account: { id: '42', username: 'kozmikarkan_bot' }, expiresAt: null });
  await saveIntegration(db, { id: 'instagram', secretEncrypted: encryptSecret('IG', KEY), account: { id: '1784', username: 'kozmikarkan' }, expiresAt: new Date('2026-11-20T00:00:00Z') });
  await saveSettings(db, { automation: { telegramChatId: CHAT } });
}

async function seedDay(db: Db) {
  const post = await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
  for (const item of planPublications(DATE, [post], DEFAULT_SETTINGS.automation)) {
    await savePublication(db, DATE, item, item.format === 'reels' ? { videoUrl: 'https://blob.test/r.mp4' } : { images: Array.from({ length: 6 }, (_, index) => new Uint8Array([index])) });
  }
  return listPublications(db, DATE);
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('Telegram bağlantısı', () => {
  it('bot anahtarını doğrular, webhook kurar ve şifreli saklar', async () => {
    const { deps, telegramCalls } = harness(db, new Date());
    expect(await connectTelegram(deps, 'BOT-TOKEN')).toEqual({ username: 'kozmikarkan_bot' });
    expect(telegramCalls()[1]).toMatchObject({
      path: 'setWebhook',
      params: { url: 'https://app.test/api/telegram/webhook', secret_token: telegramWebhookSecret('secret') },
    });
    const stored = await getIntegration(db, 'telegram');
    expect(stored?.secretEncrypted).not.toContain('BOT-TOKEN');
  });

  it('ilk /start sohbeti kaydeder; başka sohbetlerin komut ve düğmeleri yok sayılır', async () => {
    await saveIntegration(db, { id: 'telegram', secretEncrypted: encryptSecret('BOT', KEY), account: { id: '42', username: 'b' }, expiresAt: null });
    await seedDay(db);
    const { deps, telegramCalls } = harness(db, new Date('2026-09-29T04:00:00Z'));
    await handleTelegramUpdate(deps, { message: { chat: { id: CHAT }, text: '/start' } });
    expect((await getSettings(db)).automation.telegramChatId).toBe(CHAT);
    await handleTelegramUpdate(deps, { message: { chat: { id: 999 }, text: '/start' } });
    await handleTelegramUpdate(deps, { callback_query: { id: 'q', data: `a:${DATE}`, message: { chat: { id: 999 }, message_id: 1 } } });
    expect((await getSettings(db)).automation.telegramChatId).toBe(CHAT);
    expect((await listPublications(db, DATE)).every((row) => row.status === 'ready')).toBe(true);
    expect(telegramCalls().filter((call) => call.path === 'sendMessage').map((call) => call.params.chat_id)).toEqual([CHAT]);
  });
});

describe('günlük onay', () => {
  it('plan mesajını kapak albümüyle gönderir, mesaj kimliğini saklar', async () => {
    await connectAll(db);
    await seedDay(db);
    const { deps, telegramCalls } = harness(db, new Date('2026-09-29T04:00:00Z'));
    expect(await sendDayPlan(deps, DATE)).toEqual({ sent: true });
    const message = telegramCalls().find((call) => call.path === 'sendMessage');
    expect(message?.params.text).toContain('Kadın günlük burç · carousel (3 parça)');
    expect((await listPublications(db, DATE))[0].telegramMessageId).toBe(77);
  });

  it('chat kaydı yoksa mesaj göndermez ve nedenini söyler', async () => {
    await saveIntegration(db, { id: 'telegram', secretEncrypted: encryptSecret('BOT', KEY), account: { id: '42', username: 'b' }, expiresAt: null });
    const { deps } = harness(db, new Date());
    expect(await sendDayPlan(deps, DATE)).toEqual({ sent: false, reason: 'Bota henüz /start yazılmadı.' });
  });

  it('hepsini onayla yalnız hazırları planlanan saate göre kuyruğa bırakır; atlanan grup kuyruğa girmez', async () => {
    await connectAll(db);
    const rows = await seedDay(db);
    const { deps, enqueue } = harness(db, new Date('2026-09-29T05:00:00Z'));
    await handleTelegramUpdate(deps, { callback_query: { id: 'q1', data: `s:${rows[0].postId}:r`, message: { chat: { id: CHAT }, message_id: 77 } } });
    await handleTelegramUpdate(deps, { callback_query: { id: 'q2', data: `a:${DATE}`, message: { chat: { id: CHAT }, message_id: 77 } } });
    await handleTelegramUpdate(deps, { callback_query: { id: 'q3', data: `a:${DATE}`, message: { chat: { id: CHAT }, message_id: 77 } } });
    expect(enqueue.mock.calls.map(([id, options]) => [rows.find((row) => row.id === id)?.part, options.delaySeconds])).toEqual([
      [3, 1800],
      [2, 1980],
      [1, 2160],
    ]);
    const reels = (await listPublications(db, DATE)).find((row) => row.format === 'reels');
    expect(reels?.status).toBe('skipped');
    await handleTelegramUpdate(deps, { callback_query: { id: 'q4', data: `u:${rows[0].postId}:r`, message: { chat: { id: CHAT }, message_id: 77 } } });
    expect(enqueue).toHaveBeenCalledTimes(4);
    expect(enqueue.mock.calls[3][0]).toBe(reels?.id);
  });
});

describe('Instagram paylaşımı', () => {
  it('carousel parçasını 6 görsel + carousel olarak paylaşır; aynı mesaj ikinci kez gelince paylaşmaz', async () => {
    await connectAll(db);
    const [part3] = await seedDay(db);
    await approveDay(db, DATE);
    const { deps, igCalls, telegramCalls } = harness(db, new Date('2026-09-29T05:30:10Z'));
    expect(await publishPublication(deps, part3.id)).toBe('published');
    const paths = igCalls().map((call) => `${call.path}${call.params.fields ? `?${call.params.fields}` : ''}`);
    expect(paths).toEqual([
      ...Array(7).fill('/v25.0/1784/media'),
      '/v25.0/container-7?status_code',
      '/v25.0/1784/media_publish',
      '/v25.0/media-1?permalink',
    ]);
    expect(igCalls()[0].params.image_url).toBe(`https://app.test/api/media/${part3.media.imageIds![0]}`);
    expect(igCalls()[6].params.caption).toBe(part3.caption);
    const saved = await getPublication(db, part3.id);
    expect(saved).toMatchObject({ status: 'published', igMediaId: 'media-1', permalink: 'https://www.instagram.com/p/abc/' });
    expect(telegramCalls().some((call) => String(call.params.text).startsWith('📤 Paylaşıldı'))).toBe(true);

    expect(await publishPublication(deps, part3.id)).toBe('ignored');
    expect(igCalls()).toHaveLength(10);
  });

  it('Reels işlenirken yeniden denemeyi ister, container yeniden açılmadan sonraki teslimde paylaşır', async () => {
    await connectAll(db);
    const reels = (await seedDay(db))[3];
    await approveDay(db, DATE);
    const { deps, instagram, igCalls } = harness(db, new Date('2026-09-29T16:00:05Z'));
    instagram.mockImplementationOnce(() => ({ body: { id: 'reels-c' } })).mockImplementationOnce(() => ({ body: { status_code: 'IN_PROGRESS' } }));
    const retry = await publishPublication(deps, reels.id).catch((error: unknown) => error);
    expect(retry).toBeInstanceOf(RetryLater);
    expect(retry).toMatchObject({ afterSeconds: 30 });
    expect(await getPublication(db, reels.id)).toMatchObject({ status: 'approved', igContainerId: 'reels-c' });
    expect(igCalls()[0].params).toMatchObject({ media_type: 'REELS', video_url: 'https://blob.test/r.mp4', share_to_feed: 'true' });

    expect(await publishPublication(deps, reels.id)).toBe('published');
    expect(igCalls().filter((call) => call.path.endsWith('/media'))).toHaveLength(1);
    expect(igCalls().find((call) => call.path.endsWith('/media_publish'))?.params.creation_id).toBe('reels-c');
  });

  it('paylaşım sonucu yazılmadan düşmüşse container yayınlanmış görünür ve ikinci kez yayınlanmaz', async () => {
    await connectAll(db);
    const reels = (await seedDay(db))[3];
    await approveDay(db, DATE);
    const { deps, instagram, igCalls } = harness(db, new Date('2026-09-29T16:00:05Z'));
    instagram.mockImplementationOnce(() => ({ body: { id: 'reels-c' } })).mockImplementationOnce(() => ({ body: { status_code: 'IN_PROGRESS' } }));
    await publishPublication(deps, reels.id).catch(() => undefined);
    instagram.mockImplementationOnce(() => ({ body: { status_code: 'PUBLISHED' } }));
    expect(await publishPublication(deps, reels.id)).toBe('published');
    expect(igCalls().some((call) => call.path.endsWith('/media_publish'))).toBe(false);
  });

  it('planlanan saatten önce gelen teslimi saatine erteler', async () => {
    await connectAll(db);
    const reels = (await seedDay(db))[3];
    await approveDay(db, DATE);
    const { deps, igCalls } = harness(db, new Date('2026-09-29T15:00:00Z'));
    await expect(publishPublication(deps, reels.id)).rejects.toMatchObject({ afterSeconds: 3600 });
    expect(igCalls()).toHaveLength(0);
    expect((await getPublication(db, reels.id))?.status).toBe('approved');
  });

  it('onaysız ya da atlanmış paylaşımı hiç göndermez', async () => {
    await connectAll(db);
    const [part3] = await seedDay(db);
    const { deps, igCalls } = harness(db, new Date('2026-09-29T06:00:00Z'));
    expect(await publishPublication(deps, part3.id)).toBe('ignored');
    expect(igCalls()).toHaveLength(0);
  });

  it('kalıcı hatada paylaşımı başarısız yapar ve Telegramdan uyarır; geçici hatada yeniden dener', async () => {
    await connectAll(db);
    const rows = await seedDay(db);
    await approveDay(db, DATE);
    const { deps, instagram, telegramCalls } = harness(db, new Date('2026-09-29T17:00:00Z'));
    instagram.mockImplementationOnce(() => ({ status: 400, body: { error: { message: 'Application request limit reached', code: 4 } } }));
    await expect(publishPublication(deps, rows[3].id)).rejects.toMatchObject({ name: 'RetryLater', afterSeconds: 120 });
    expect((await getPublication(db, rows[3].id))?.status).toBe('approved');

    instagram.mockImplementationOnce(() => ({ status: 400, body: { error: { message: 'Invalid OAuth access token', code: 190 } } }));
    expect(await publishPublication(deps, rows[0].id)).toBe('failed');
    expect(await getPublication(db, rows[0].id)).toMatchObject({ status: 'failed', error: 'Invalid OAuth access token' });
    expect(telegramCalls().some((call) => String(call.params.text).includes('❌ Paylaşılamadı · Kadın burç carousel 3/3'))).toBe(true);
  });
});

describe('bakım', () => {
  it('süresi yaklaşan Instagram anahtarını yeniler; yenileyemezse Telegramdan uyarır', async () => {
    await connectAll(db);
    const { deps, instagram } = harness(db, new Date('2026-11-05T00:00:00Z'));
    instagram.mockImplementationOnce(() => ({ body: { access_token: 'IG2', expires_in: 5_184_000 } }));
    const result = await runMaintenance(deps);
    expect(result).toMatchObject({ tokenRefreshed: true, deletedVideos: 2 });
    expect((await getIntegration(db, 'instagram'))?.expiresAt?.toISOString()).toBe('2027-01-04T00:00:00.000Z');

    await saveIntegration(db, { id: 'instagram', secretEncrypted: encryptSecret('IG', KEY), account: { id: '1784', username: 'k' }, expiresAt: new Date('2026-11-10T00:00:00Z') });
    const failing = harness(db, new Date('2026-11-05T00:00:00Z'));
    failing.instagram.mockImplementationOnce(() => ({ status: 400, body: { error: { message: 'Session has expired', code: 190 } } }));
    expect((await runMaintenance(failing.deps)).tokenRefreshed).toBe(false);
    expect(failing.telegramCalls().some((call) => String(call.params.text).includes('yenilenemedi (5 gün kaldı)'))).toBe(true);
  });

  it('Instagram bağlanırken hesabı doğrular ve 60 günlük süre yazar', async () => {
    const { deps, instagram } = harness(db, new Date('2026-09-29T00:00:00Z'));
    instagram.mockImplementationOnce(() => ({ body: { user_id: '1784', username: 'kozmikarkan' } }));
    expect(await connectInstagram(deps, 'IGAA')).toEqual({ username: 'kozmikarkan' });
    expect(await getIntegration(db, 'instagram')).toMatchObject({ account: { id: '1784', username: 'kozmikarkan' } });
  });
});
