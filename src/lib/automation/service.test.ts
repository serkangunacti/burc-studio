import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publications } from '@/db/schema';
import type { Db } from '@/db/types';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { getSettings, saveSettings } from '@/lib/settings/repository';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { planPublications } from './plan';
import { handleTelegramWebhook } from './http';
import { approveDay, getIntegration, getPublication, listPublications, saveIntegration, savePublication } from './repository';
import { encryptSecret, telegramWebhookSecret } from './secrets';
import {
  approvalSummary,
  diagnoseCarousel,
  automationStatus,
  connectBuffer,
  connectGitHub,
  connectInstagram,
  connectTelegram,
  describeStatus,
  handleTelegramUpdate,
  publishDueNow,
  publishPublication,
  requeueDay,
  RetryLater,
  runMaintenance,
  sendDayPlan,
  startRender,
  type AutomationDeps,
} from './service';

const DATE = '2026-09-29';
const KEY = randomBytes(32).toString('base64');
const CHAT = 5550001;

type Call = { host: 'telegram' | 'instagram' | 'buffer' | 'github'; path: string; params: Record<string, unknown> };

function harness(db: Db, now: Date) {
  const calls: Call[] = [];
  const telegramWebhook = { secret: telegramWebhookSecret('previous-secret'), pendingUpdates: 1, failRegistration: false };
  const instagram = vi.fn((path: string, params: Record<string, unknown>): { status?: number; body: unknown } => {
    if (path.endsWith('/media')) return { body: { id: `container-${calls.filter((call) => call.path.endsWith('/media')).length}` } };
    if (path.endsWith('/media_publish')) return { body: { id: 'media-1' } };
    if (params.fields === 'status_code') return { body: { status_code: 'FINISHED' } };
    if (params.fields === 'permalink') return { body: { permalink: 'https://www.instagram.com/p/abc/' } };
    return { body: {} };
  });
  const buffer = vi.fn((query: string): unknown => {
    if (query.includes('createPost')) return { data: { createPost: { post: { id: 'buf-1' } } } };
    if (query.includes('account')) return { data: { account: { organizations: [{ id: 'org' }] } } };
    if (query.includes('channels(')) return { data: { channels: [{ id: 'tt-1', name: 'kozmikarkan', displayName: null, service: 'tiktok' }] } };
    if (query.includes('channel(')) return { data: { channel: { id: 'tt-1', name: 'kozmikarkan', displayName: null, isQueuePaused: false } } };
    return { data: { post: { id: 'buf-1', status: 'sent', externalLink: 'https://www.tiktok.com/@kozmikarkan/video/9', error: null } } };
  });
  const github = { status: 200 };
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.host === 'api.telegram.org') {
      const method = url.pathname.split('/').pop()!;
      const params = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      calls.push({ host: 'telegram', path: method, params });
      if (method === 'setWebhook') {
        if (telegramWebhook.failRegistration) return Response.json({ ok: false, description: 'Webhook registration failed' }, { status: 500 });
        telegramWebhook.secret = String(params.secret_token);
        if (params.drop_pending_updates === true) telegramWebhook.pendingUpdates = 0;
      }
      const result =
        method === 'getMe'
          ? { id: 42, username: 'kozmikarkan_bot' }
          : method === 'sendMessage'
            ? { message_id: 77 }
            : method === 'getWebhookInfo'
              ? { url: 'https://app.test/api/telegram/webhook', pending_update_count: 0 }
              : true;
      return Response.json({ ok: true, result });
    }
    if (url.host === 'api.github.com') {
      calls.push({ host: 'github', path: `${init?.method ?? 'GET'} ${url.pathname}`, params: init?.body ? JSON.parse(String(init.body)) : {} });
      return init?.method === 'POST' ? new Response(null, { status: 204 }) : Response.json({ id: 1 }, { status: github.status });
    }
    if (url.host === 'api.buffer.com') {
      const payload = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
      calls.push({ host: 'buffer', path: payload.query.match(/(createPost|post|channels|channel|account)\b/)?.[1] ?? '', params: payload.variables });
      return Response.json(buffer(payload.query));
    }
    const params = Object.fromEntries(init?.body instanceof URLSearchParams ? init.body : url.searchParams);
    delete params.access_token;
    calls.push({ host: 'instagram', path: url.pathname, params });
    const response = instagram(url.pathname, params);
    return Response.json(response.body, { status: response.status ?? 200 });
  });
  const enqueue = vi.fn<AutomationDeps['enqueue']>(async () => undefined);
  const deps: AutomationDeps = {
    db,
    appUrl: 'https://app.test',
    repository: 'serkangunacti/burc-studio',
    integrationsKey: KEY,
    automationSecret: 'secret',
    now: () => now,
    sleep: vi.fn(async () => undefined),
    fetch: fetchImpl as unknown as typeof fetch,
    enqueue,
    deleteVideosBefore: vi.fn(async () => 2),
  };
  return { deps, calls, instagram, buffer, github, telegramWebhook, enqueue, githubCalls: () => calls.filter((call) => call.host === 'github'), bufferCalls: () => calls.filter((call) => call.host === 'buffer'), telegramCalls: () => calls.filter((call) => call.host === 'telegram'), igCalls: () => calls.filter((call) => call.host === 'instagram') };
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
  it('anahtar değişince plan öncesinde webhook yenilenir; onay HTTP üzerinden kaydedilip kuyruğa girer', async () => {
    await connectAll(db);
    const rows = await seedDay(db);
    const { deps, telegramWebhook, telegramCalls, enqueue } = harness(db, new Date('2026-09-29T05:00:00Z'));
    const callback = { callback_query: { id: 'rotated-secret', data: `a:${DATE}`, message: { chat: { id: CHAT }, message_id: 77 } } };
    const request = (secret: string) => new Request(`${deps.appUrl}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
      body: JSON.stringify(callback),
    });
    const oldSecret = telegramWebhook.secret;
    expect((await handleTelegramWebhook(request(oldSecret), deps)).status).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();

    await sendDayPlan(deps, DATE);
    const response = await handleTelegramWebhook(request(telegramWebhook.secret), deps);
    expect(response.status).toBe(200);
    expect(enqueue.mock.calls.map(([id]) => id)).toEqual(rows.map((row) => row.id));
    expect((await listPublications(db, DATE)).every((row) => row.status === 'approved')).toBe(true);
    expect(telegramCalls().some((call) => call.path === 'sendMessage' && String(call.params.text).startsWith('✅ 4 paylaşım onaylandı.'))).toBe(true);
    expect(telegramCalls()[0]).toMatchObject({ path: 'setWebhook', params: { url: 'https://app.test/api/telegram/webhook', drop_pending_updates: false } });
    expect(telegramWebhook.pendingUpdates).toBe(1);
    expect((await handleTelegramWebhook(request(oldSecret), deps)).status).toBe(401);
    await handleTelegramWebhook(request(telegramWebhook.secret), deps);
    expect(enqueue).toHaveBeenCalledTimes(4);
  });

  it('webhook yenilenemezse çalışmayan onay düğmeleri göndermez', async () => {
    await connectAll(db);
    await seedDay(db);
    const { deps, telegramWebhook, telegramCalls } = harness(db, new Date());
    telegramWebhook.failRegistration = true;
    await expect(sendDayPlan(deps, DATE)).rejects.toThrow('Webhook registration failed');
    expect(telegramCalls().some((call) => call.path === 'sendMessage' || call.path === 'sendMediaGroup')).toBe(false);
    expect((await listPublications(db, DATE))[0].telegramMessageId).toBeNull();
  });

  it('otomasyon anahtarı yoksa onay düğmelerini göndermez', async () => {
    await connectAll(db);
    const { deps, telegramCalls } = harness(db, new Date());
    deps.automationSecret = undefined;
    await expect(sendDayPlan(deps, DATE)).rejects.toThrow('AUTOMATION_SECRET');
    expect(telegramCalls()).toHaveLength(0);
  });

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
    const { deps, enqueue, telegramCalls } = harness(db, new Date('2026-09-29T05:00:00Z'));
    await handleTelegramUpdate(deps, { callback_query: { id: 'q1', data: `s:${rows[0].postId}:r`, message: { chat: { id: CHAT }, message_id: 77 } } });
    await handleTelegramUpdate(deps, { callback_query: { id: 'q2', data: `a:${DATE}`, message: { chat: { id: CHAT }, message_id: 77 } } });
    await handleTelegramUpdate(deps, { callback_query: { id: 'q3', data: `a:${DATE}`, message: { chat: { id: CHAT }, message_id: 77 } } });
    expect(enqueue.mock.calls.map(([id, options]) => [rows.find((row) => row.id === id)?.part, options.delaySeconds])).toEqual([
      [3, 1800],
      [2, 1980],
      [1, 2160],
    ]);
    const summaries = telegramCalls().filter((call) => call.path === 'sendMessage').map((call) => String(call.params.text));
    expect(summaries).toEqual(['✅ 3 paylaşım onaylandı.\nSıradaki: 08:30 · son: 08:36.\nHer paylaşım gidince "📤 Paylaşıldı" bildirimi gelecek.']);
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

  it('yayınla isteği hata dönse de gönderi yayınlandıysa bunu hesaptan doğrular, ikinci kez yayınlamaz', async () => {
    await connectAll(db);
    const [part3] = await seedDay(db);
    await approveDay(db, DATE);
    const { deps, instagram, igCalls } = harness(db, new Date('2026-09-29T05:30:10Z'));
    const base = instagram.getMockImplementation()!;
    let published = false;
    instagram.mockImplementation((path, params) => {
      if (path.endsWith('/media_publish')) {
        published = true;
        return { status: 400, body: { error: { message: 'Application request limit reached', code: 4 } } };
      }
      if (path.endsWith('/1784/media') && params.fields) {
        return { body: { data: published ? [{ id: 'm-9', caption: part3.caption, timestamp: '2026-09-29T05:30:12+0000', permalink: 'https://www.instagram.com/p/x/', media_type: 'CAROUSEL_ALBUM' }] : [] } };
      }
      return base(path, params);
    });
    await expect(publishPublication(deps, part3.id)).rejects.toMatchObject({ name: 'RetryLater', afterSeconds: 120 });
    expect((await getPublication(db, part3.id))?.publishAttemptedAt).not.toBeNull();
    expect(await publishPublication(deps, part3.id)).toBe('published');
    expect(await getPublication(db, part3.id)).toMatchObject({ status: 'published', igMediaId: 'm-9', permalink: 'https://www.instagram.com/p/x/' });
    expect(igCalls().filter((call) => call.path.endsWith('/media_publish'))).toHaveLength(1);
    expect(igCalls().filter((call) => call.path.endsWith('/media') && !call.params.fields)).toHaveLength(7);
  });

  it('yayın sonucu doğrulanamazsa yeniden yayınlamaz; süre dolunca açıklamayla başarısız olur', async () => {
    await connectAll(db);
    const [part3] = await seedDay(db);
    await approveDay(db, DATE);
    const first = harness(db, new Date('2026-09-29T05:30:10Z'));
    const base = first.instagram.getMockImplementation()!;
    const failPublish = (path: string, params: Record<string, unknown>) => {
      if (path.endsWith('/media_publish')) return { status: 500, body: { error: { message: 'An unexpected error has occurred', code: 2 } } };
      if (path.endsWith('/1784/media') && params.fields) return { body: { data: [] } };
      return base(path, params);
    };
    first.instagram.mockImplementation(failPublish);
    await expect(publishPublication(first.deps, part3.id)).rejects.toMatchObject({ name: 'RetryLater' });
    await expect(publishPublication(first.deps, part3.id)).rejects.toMatchObject({ name: 'RetryLater', afterSeconds: 120 });
    const late = harness(db, new Date('2026-09-29T05:50:00Z'));
    late.instagram.mockImplementation(failPublish);
    expect(await publishPublication(late.deps, part3.id)).toBe('failed');
    expect((await getPublication(db, part3.id))?.error).toContain('kopya oluşmaması için yeniden gönderilmedi');
    expect([...first.igCalls(), ...late.igCalls()].filter((call) => call.path.endsWith('/media_publish'))).toHaveLength(1);
  });

  it('başarısız paylaşım yeniden denenince önce hesabı kontrol eder; yayınlanmışsa yeni kayıt açmadan tamamlar', async () => {
    await connectAll(db);
    const rows = await seedDay(db);
    await db
      .update(publications)
      .set({ status: 'failed', error: 'x', igContainerId: 'c-old', publishAttemptedAt: new Date('2026-09-29T05:33:00Z') })
      .where(eq(publications.id, rows[1].id));
    const { deps, instagram, igCalls } = harness(db, new Date('2026-09-29T06:00:00Z'));
    const base = instagram.getMockImplementation()!;
    instagram.mockImplementation((path, params) =>
      path.endsWith('/1784/media') && params.fields
        ? { body: { data: [{ id: 'm-2', caption: rows[1].caption, timestamp: '2026-09-29T05:34:01+0000', permalink: 'https://www.instagram.com/p/y/', media_type: 'CAROUSEL_ALBUM' }] } }
        : base(path, params),
    );
    await handleTelegramUpdate(deps, { callback_query: { id: 'q', data: `y:${rows[1].postId}:c`, message: { chat: { id: CHAT }, message_id: 77 } } });
    expect(await publishPublication(deps, rows[1].id)).toBe('published');
    expect(await getPublication(db, rows[1].id)).toMatchObject({ status: 'published', igMediaId: 'm-2' });
    expect(igCalls().some((call) => call.path.endsWith('/media_publish') || (call.path.endsWith('/media') && !call.params.fields))).toBe(false);
  });

  it('başka bir Instagram paylaşımı sürerken sıradakini başlatmaz; TikTok bundan etkilenmez', async () => {
    await connectAll(db);
    const [part3, part2] = await seedDay(db);
    await approveDay(db, DATE);
    await db.update(publications).set({ status: 'publishing', updatedAt: new Date('2026-09-29T05:33:00Z') }).where(eq(publications.id, part3.id));
    const { deps, igCalls } = harness(db, new Date('2026-09-29T05:34:00Z'));
    await expect(publishPublication(deps, part2.id)).rejects.toMatchObject({ name: 'RetryLater', afterSeconds: 90 });
    expect((await getPublication(db, part2.id))?.status).toBe('approved');
    expect(igCalls()).toHaveLength(0);
  });

  it('gün sonu saati geçse de başlamış paylaşımı (yayın doğrulaması) tamamlar', async () => {
    await connectAll(db);
    const [part3] = await seedDay(db);
    await approveDay(db, DATE);
    await db.update(publications).set({ igContainerId: 'c-1', publishAttemptedAt: new Date('2026-09-29T19:10:00Z') }).where(eq(publications.id, part3.id));
    const { deps, instagram } = harness(db, new Date('2026-09-29T19:20:00Z'));
    const base = instagram.getMockImplementation()!;
    instagram.mockImplementation((path, params) =>
      path.endsWith('/1784/media') && params.fields
        ? { body: { data: [{ id: 'm-5', caption: part3.caption, timestamp: '2026-09-29T19:10:05+0000', permalink: 'https://www.instagram.com/p/z/', media_type: 'CAROUSEL_ALBUM' }] } }
        : base(path, params),
    );
    expect(await publishPublication(deps, part3.id)).toBe('published');
  });

  it('Instagram Reels i Buffer ın Instagram kanalından reel olarak paylaşır; bizim Instagram uygulamamızı kullanmaz', async () => {
    await connectAll(db);
    const reels = (await seedDay(db))[3];
    await approveDay(db, DATE);
    const { deps: setup } = harness(db, new Date('2026-09-29T00:00:00Z'));
    await connectBuffer(setup, 'BUFFER-KEY');
    const { deps, buffer, bufferCalls, igCalls } = harness(db, new Date('2026-09-29T16:00:05Z'));
    const base = buffer.getMockImplementation()!;
    buffer.mockImplementation((query) =>
      query.includes('channels(')
        ? { data: { channels: [{ id: 'tt-1', name: 'kozmikarkan', displayName: null, service: 'tiktok' }, { id: 'ig-1', name: 'kozmikarkan', displayName: null, service: 'instagram' }] } }
        : base(query),
    );
    expect(await publishPublication(deps, reels.id)).toBe('published');
    expect(bufferCalls().find((call) => call.path === 'createPost')?.params).toMatchObject({
      input: {
        channelId: 'ig-1',
        text: reels.caption,
        mode: 'shareNow',
        assets: [{ video: { url: 'https://blob.test/r.mp4' } }],
        metadata: { instagram: { type: 'reel', shouldShareToFeed: true } },
      },
    });
    expect(igCalls()).toHaveLength(0);
    expect(await getIntegration(db, 'buffer_instagram')).toMatchObject({ account: { id: 'ig-1' } });
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
    const { deps, instagram, telegramCalls } = harness(db, new Date('2026-09-29T05:40:00Z'));
    instagram.mockImplementationOnce(() => ({ status: 400, body: { error: { message: 'Application request limit reached', code: 4 } } }));
    await expect(publishPublication(deps, rows[2].id)).rejects.toMatchObject({ name: 'RetryLater', afterSeconds: 1800 });
    expect((await getPublication(db, rows[2].id))?.status).toBe('approved');
    // Gün sonu saatine (22:15 TSİ) kadar başlayamayan paylaşım o gün yapılmaz ve bildirilir.
    const late = harness(db, new Date('2026-09-29T19:20:00Z'));
    expect(await publishPublication(late.deps, rows[2].id)).toBe('expired');
    expect(await getPublication(db, rows[2].id)).toMatchObject({ status: 'expired', error: 'Gün sonu saati (22:15) geçti; bugün paylaşılmadı' });
    expect(late.telegramCalls().some((call) => String(call.params.text).startsWith('⌛ Paylaşılmadı'))).toBe(true);
    expect(late.igCalls()).toHaveLength(0);

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

  it('paylaşım izni olmayan Instagram anahtarını bağlamaz', async () => {
    const { deps, instagram } = harness(db, new Date('2026-09-29T00:00:00Z'));
    instagram
      .mockImplementationOnce(() => ({ body: { user_id: '1784', username: 'kozmikarkan' } }))
      .mockImplementationOnce(() => ({ status: 400, body: { error: { message: 'Insufficient permission', code: 10 } } }));
    await expect(connectInstagram(deps, 'IGAA')).rejects.toThrow('paylaşım izni');
    expect(await getIntegration(db, 'instagram')).toBeNull();
  });
});

describe('durum', () => {
  it('webhook, sohbet kaydı ve paylaşım kotasını raporlar; /durum komutu aynı raporu gönderir', async () => {
    await connectAll(db);
    const { deps, instagram, telegramCalls, igCalls } = harness(db, new Date('2026-09-29T00:00:00Z'));
    instagram.mockImplementationOnce(() => ({ body: { data: [{ quota_usage: 3, config: { quota_total: 100 } }] } }));
    const status = await automationStatus(deps);
    expect(status).toEqual({
      telegram: { username: 'kozmikarkan_bot', chatLinked: true, webhookOk: true, pendingUpdates: 0, lastError: null },
      instagram: { username: 'kozmikarkan', expiresAt: '2026-11-20T00:00:00.000Z', publishing: { ok: true, used: 3, total: 100 } },
      tiktok: null,
      renderTrigger: false,
    });
    expect(igCalls()[0]).toMatchObject({ path: '/v25.0/1784/content_publishing_limit', params: { fields: 'quota_usage,config' } });
    expect(describeStatus(status)).toContain('Paylaşım izni ✅ · son 24 saatte 3/100 paylaşım');

    instagram.mockImplementationOnce(() => ({ status: 400, body: { error: { message: 'Insufficient permission', code: 10 } } }));
    await handleTelegramUpdate(deps, { message: { chat: { id: CHAT }, text: '/durum' } });
    expect(String(telegramCalls().at(-1)?.params.text)).toContain('Paylaşım izni ❌ Insufficient permission');
  });
});

describe('TikTok (Buffer)', () => {
  async function seedTikTokDay() {
    await connectAll(db);
    const { deps } = harness(db, new Date('2026-09-29T00:00:00Z'));
    expect(await connectBuffer(deps, 'BUFFER-KEY')).toEqual({ channel: 'kozmikarkan' });
    const post = await seedPost(db, { date: DATE, kind: 'tarot', audience: 'erkek' });
    const settings = await getSettings(db);
    for (const item of planPublications(DATE, [post], settings.automation).filter((entry) => entry.format !== 'carousel')) {
      await savePublication(db, DATE, item, { videoUrl: 'https://blob.test/r.mp4' });
    }
    await approveDay(db, DATE);
    return (await listPublications(db, DATE)).find((row) => row.format === 'tiktok')!;
  }

  it('bağlanınca TikTok kanalını kaydeder, anahtarı şifreler ve TikTok paylaşımını açar', async () => {
    const tiktok = await seedTikTokDay();
    expect(tiktok.scheduledAt.toISOString()).toBe('2026-09-29T19:00:00.000Z');
    expect(await getIntegration(db, 'buffer')).toMatchObject({ account: { id: 'tt-1', username: 'kozmikarkan' } });
    expect((await getIntegration(db, 'buffer'))?.secretEncrypted).not.toContain('BUFFER-KEY');
    expect((await getSettings(db)).automation.tiktok.enabled).toBe(true);
  });

  it('saatinde videoyu Buffer ile hemen paylaşır; işlenirken bekler, gönderilince bağlantıyı kaydeder ve bir kez paylaşır', async () => {
    const tiktok = await seedTikTokDay();
    const { deps, buffer, bufferCalls } = harness(db, new Date('2026-09-29T19:00:05Z'));
    buffer
      .mockImplementationOnce(() => ({ data: { createPost: { post: { id: 'buf-1' } } } }))
      .mockImplementationOnce(() => ({ data: { post: { id: 'buf-1', status: 'sending', externalLink: null, error: null } } }));
    await expect(publishPublication(deps, tiktok.id)).rejects.toMatchObject({ name: 'RetryLater', afterSeconds: 300 });
    expect(bufferCalls()[0].params).toMatchObject({
      input: { channelId: 'tt-1', text: tiktok.caption, mode: 'shareNow', assets: [{ video: { url: 'https://blob.test/r.mp4' } }] },
    });
    expect(await getPublication(db, tiktok.id)).toMatchObject({ status: 'approved', remoteId: 'buf-1' });

    expect(await publishPublication(deps, tiktok.id)).toBe('published');
    expect(bufferCalls().filter((call) => call.path === 'createPost')).toHaveLength(1);
    expect(await getPublication(db, tiktok.id)).toMatchObject({ status: 'published', permalink: 'https://www.tiktok.com/@kozmikarkan/video/9' });
    expect(await publishPublication(deps, tiktok.id)).toBe('ignored');
  });

  it('Buffer gönderisi uzun süre işlenirken deneme sayısına değil geçen süreye göre bekler', async () => {
    const tiktok = await seedTikTokDay();
    const sending = () => ({ data: { post: { id: 'buf-1', status: 'sending', externalLink: null, error: null } } });
    const early = harness(db, new Date('2026-09-29T19:05:00Z'));
    early.buffer.mockImplementation((query) => (query.includes('createPost') ? { data: { createPost: { post: { id: 'buf-1' } } } } : sending()));
    await db.update(publications).set({ attempts: 50 }).where(eq(publications.id, tiktok.id));
    await expect(publishPublication(early.deps, tiktok.id)).rejects.toMatchObject({ name: 'RetryLater' });
    const late = harness(db, new Date('2026-09-29T23:01:00Z'));
    late.buffer.mockImplementation(sending);
    expect(await publishPublication(late.deps, tiktok.id)).toBe('failed');
    expect((await getPublication(db, tiktok.id))?.error).toBe('TikTok paylaşımı zamanında tamamlanmadı (Buffer durumu: sending)');
  });

  it('Buffer hata bildirirse paylaşımı başarısız yapar ve uyarır', async () => {
    const tiktok = await seedTikTokDay();
    const { deps, buffer, telegramCalls } = harness(db, new Date('2026-09-29T19:00:05Z'));
    buffer
      .mockImplementationOnce(() => ({ data: { createPost: { post: { id: 'buf-1' } } } }))
      .mockImplementationOnce(() => ({ data: { post: { id: 'buf-1', status: 'error', externalLink: null, error: { message: 'Video could not be fetched' } } } }));
    expect(await publishPublication(deps, tiktok.id)).toBe('failed');
    expect((await getPublication(db, tiktok.id))?.error).toBe('TikTok (Buffer): Video could not be fetched');
    expect(telegramCalls().some((call) => String(call.params.text).includes('❌ Paylaşılamadı · Erkek tarot TikTok'))).toBe(true);
  });

  it('durum raporunda TikTok kanalını gösterir', async () => {
    await seedTikTokDay();
    const { deps } = harness(db, new Date('2026-09-29T00:00:00Z'));
    const status = await automationStatus(deps);
    expect(status.tiktok).toEqual({ channel: 'kozmikarkan', enabled: true, ok: true, error: null });
    expect(describeStatus(status)).toContain('TikTok (Buffer): kozmikarkan · ✅');
  });

  it('görsel kısa sürede işlenirse kuyruğu beklemeden aynı teslimde paylaşır', async () => {
    await connectAll(db);
    const [part3] = await seedDay(db);
    await approveDay(db, DATE);
    const { deps, instagram } = harness(db, new Date('2026-09-29T05:30:10Z'));
    const base = instagram.getMockImplementation()!;
    let carouselChecks = 0;
    instagram.mockImplementation((path, params) =>
      params.fields === 'status_code' && path.endsWith('/container-7') ? { body: { status_code: ++carouselChecks <= 2 ? 'IN_PROGRESS' : 'FINISHED' } } : base(path, params),
    );
    expect(await publishPublication(deps, part3.id)).toBe('published');
    // 5 görsel arası bekleme + 2 işlem kontrolü.
    expect(deps.sleep).toHaveBeenCalledTimes(7);
  });
});

describe('onay özeti', () => {
  it('saati geçenleri ve sıradaki ilk ile son saati söyler', async () => {
    const rows = await seedDay(db);
    expect(approvalSummary(rows, new Date('2026-09-29T05:34:00Z'))).toBe(
      '✅ 4 paylaşım onaylandı.\nSaati geçmiş 2 paylaşım hemen gönderiliyor.\nSıradaki: 08:36 · son: 19:00.\nHer paylaşım gidince "📤 Paylaşıldı" bildirimi gelecek.',
    );
  });
});

describe('hazırlık tetikleyicisi (GitHub)', () => {
  it('anahtarı iş akışına erişimle doğrular, şifreli saklar ve günün hazırlığını başlatır', async () => {
    const { deps, githubCalls } = harness(db, new Date('2026-09-29T02:30:00Z'));
    expect(await startRender(deps, DATE)).toEqual({ dispatched: false, reason: 'GitHub anahtarı bağlı değil' });
    expect(await connectGitHub(deps, 'github_pat_X')).toEqual({ repository: 'serkangunacti/burc-studio' });
    expect((await getIntegration(db, 'github'))?.secretEncrypted).not.toContain('github_pat_X');
    expect(await startRender(deps, DATE)).toEqual({ dispatched: true });
    expect(githubCalls().map((call) => call.path)).toEqual([
      'GET /repos/serkangunacti/burc-studio/actions/workflows/render-publications.yml',
      'POST /repos/serkangunacti/burc-studio/actions/workflows/render-publications.yml/dispatches',
    ]);
    expect(githubCalls()[1].params).toEqual({ ref: 'main', inputs: { date: DATE } });
  });

  it('iş akışına erişemeyen anahtarı kaydetmez', async () => {
    const { deps, github } = harness(db, new Date());
    github.status = 404;
    await expect(connectGitHub(deps, 'github_pat_X')).rejects.toThrow('Actions: Read and write');
    expect(await getIntegration(db, 'github')).toBeNull();
  });
});

describe('Instagram geçici hataları', () => {



  it('ERROR veren carousel ı 10 dakika sonra taze görsellerle bir kez yeniden kurar; yine ERROR olursa açıklamayla başarısız olur', async () => {
    await connectAll(db);
    const [part3, part2] = await seedDay(db);
    await approveDay(db, DATE);
    const { deps, instagram, igCalls } = harness(db, new Date('2026-09-29T05:33:10Z'));
    const base = instagram.getMockImplementation()!;
    instagram.mockImplementation((path, params) =>
      params.fields === 'status_code' && path.endsWith('/container-7') ? { body: { status_code: 'ERROR' } } : base(path, params),
    );
    await expect(publishPublication(deps, part3.id)).rejects.toMatchObject({ name: 'RetryLater', afterSeconds: 600 });
    expect(await getPublication(db, part3.id)).toMatchObject({ status: 'approved', igContainerId: null, rebuilds: 1 });
    expect(await publishPublication(deps, part3.id)).toBe('published');
    const created = igCalls().filter((call) => call.path.endsWith('/media'));
    expect(created).toHaveLength(14);
    expect(created[13].params.children).toBe('container-8,container-9,container-10,container-11,container-12,container-13');

    await db.update(publications).set({ rebuilds: 1 }).where(eq(publications.id, part2.id));
    instagram.mockImplementation((path, params) => {
      if (params.fields === 'status_code' && path.endsWith('/container-21')) return { body: { status_code: 'ERROR' } };
      if (params.fields === 'status') return { body: { status: 'Error: Media upload has failed with error code 2207052' } };
      return base(path, params);
    });
    expect(await publishPublication(deps, part2.id)).toBe('failed');
    expect((await getPublication(db, part2.id))?.error).toBe('Instagram medyayı işleyemedi (ERROR): Error: Media upload has failed with error code 2207052');
  });

  it('"too many actions" kısıtlamasında paylaşımı başarısız saymaz, 30 dakika sonra yeniden dener', async () => {
    await connectAll(db);
    const rows = await seedDay(db);
    await approveDay(db, DATE);
    const { deps, instagram } = harness(db, new Date('2026-09-29T05:40:05Z'));
    instagram.mockImplementationOnce(() => ({ status: 400, body: { error: { message: 'User is performing too many actions', code: 368 } } }));
    await expect(publishPublication(deps, rows[2].id)).rejects.toMatchObject({ name: 'RetryLater', afterSeconds: 1800 });
    expect((await getPublication(db, rows[2].id))?.status).toBe('approved');
  });

  it('Telegramdaki yeniden dene düğmesi başarısız grubu sıfırlayıp hemen kuyruğa alır', async () => {
    await connectAll(db);
    const rows = await seedDay(db);
    await approveDay(db, DATE);
    await db.update(publications).set({ status: 'failed', error: 'x', igContainerId: 'old', attempts: 3, rebuilds: 2 }).where(eq(publications.id, rows[1].id));
    const { deps, enqueue } = harness(db, new Date('2026-09-29T06:00:00Z'));
    await handleTelegramUpdate(deps, { callback_query: { id: 'q', data: `y:${rows[1].postId}:c`, message: { chat: { id: CHAT }, message_id: 77 } } });
    expect(await getPublication(db, rows[1].id)).toMatchObject({ status: 'approved', error: null, igContainerId: 'old', attempts: 0, rebuilds: 0 });
    expect(enqueue.mock.calls).toEqual([[rows[1].id, { delaySeconds: 0, retentionSeconds: 86_400 }]]);
  });
});

describe('kuyruğu yeni sürüme taşıma', () => {
  it('onaylıları saatine göre, başarısızları sıfırlayıp hemen kuyruğa alır; paylaşılanlara dokunmaz', async () => {
    await connectAll(db);
    const rows = await seedDay(db);
    await approveDay(db, DATE);
    await db.update(publications).set({ status: 'published' }).where(eq(publications.id, rows[0].id));
    await db.update(publications).set({ status: 'failed', error: 'x', rebuilds: 1 }).where(eq(publications.id, rows[1].id));
    const { deps, enqueue } = harness(db, new Date('2026-09-29T05:34:00Z'));
    expect(await requeueDay(deps, DATE)).toEqual({ requeued: 2, retried: 1 });
    expect(enqueue.mock.calls.map(([id, options]) => [rows.findIndex((row) => row.id === id), options.delaySeconds]).sort()).toEqual([
      [1, 0],
      [2, 120],
      [3, 37_560],
    ]);
    expect(await getPublication(db, rows[1].id)).toMatchObject({ status: 'approved', error: null, rebuilds: 0 });
  });
});

describe('şimdi paylaş', () => {
  it('saati gelmiş onaylıları bu istekte paylaşır, gelmeyenlere dokunmaz; yeniden kurmayı aynı istekte dener', async () => {
    await connectAll(db);
    const rows = await seedDay(db);
    await approveDay(db, DATE);
    const { deps, instagram } = harness(db, new Date('2026-09-29T05:34:00Z'));
    const base = instagram.getMockImplementation()!;
    let firstCarousel = true;
    instagram.mockImplementation((path, params) => {
      if (params.fields === 'status_code' && path.endsWith('/container-7') && firstCarousel) {
        firstCarousel = false;
        return { body: { status_code: 'ERROR' } };
      }
      return base(path, params);
    });
    const results = await publishDueNow(deps, DATE, 5);
    expect(results.map((result) => [result.label, result.outcome])).toEqual([
      ['Kadın burç carousel 3/3', 'published'],
      ['Kadın burç carousel 2/3', 'published'],
    ]);
    expect((await getPublication(db, rows[2].id))?.status).toBe('approved');
  });
});

describe('carousel tanısı', () => {
  it('görselleri bir kez yükler, her kombinasyon için yayınlamadan carousel kurup durumunu döndürür', async () => {
    await connectAll(db);
    const [part3] = await seedDay(db);
    const { deps, instagram, igCalls } = harness(db, new Date());
    const base = instagram.getMockImplementation()!;
    instagram.mockImplementation((path, params) =>
      params.fields === 'status_code' && path.endsWith('/container-8') ? { body: { status_code: 'ERROR' } } : base(path, params),
    );
    const result = await diagnoseCarousel(deps, part3.id, [[0, 1, 3, 4, 5], [0, 2, 5]]);
    expect(result.variants).toEqual([
      { items: [0, 1, 3, 4, 5], status: 'FINISHED' },
      { items: [0, 2, 5], status: 'ERROR' },
    ]);
    expect(igCalls().filter((call) => call.path.endsWith('/media'))).toHaveLength(8);
    expect(igCalls().some((call) => call.path.endsWith('/media_publish'))).toBe(false);
  });
});
