import { describe, expect, it } from 'vitest';
import { videoSafetyError, immediatePublishAllowed } from './service';
import type { PublicationRow } from './repository';

const row = (media: PublicationRow['media'], format: PublicationRow['format'] = 'reels') => ({ media, format, part:0 } as PublicationRow);

describe('Shorts publishing policy', () => {
  it('requires verified positive duration strictly below 179 seconds', () => {
    for (const durationSeconds of [undefined, NaN, Infinity, 0, -1, 179, 179.1, 180]) {
      expect(videoSafetyError(row({ videoUrl: 'https://video.test/a.mp4', durationSeconds }))).toBeTruthy();
    }
    expect(videoSafetyError(row({ videoUrl: 'https://video.test/a.mp4', durationSeconds: 178.999 }))).toBeNull();
    expect(videoSafetyError(row({ videoUrl: 'https://video.test/a.mp4', durationSeconds: 100, partCount:2 }))).toBeTruthy();
    expect(videoSafetyError(row({ durationSeconds: 10 }))).toBeTruthy();
    expect(videoSafetyError(row({ imageIds: ['a'] }, 'carousel'))).toBeTruthy();
  });
  it('allows immediate publishing only on the exceptional Istanbul day', () => {
    expect(immediatePublishAllowed('2026-10-08', new Date('2026-10-08T20:00:00Z'))).toBe(true);
    expect(immediatePublishAllowed('2026-10-08', new Date('2026-10-08T21:00:00Z'))).toBe(false);
    expect(immediatePublishAllowed('2026-10-09', new Date('2026-10-09T06:00:00Z'))).toBe(false);
  });
});

import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { vi } from 'vitest';
import { publications } from '@/db/schema';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { planPublications } from './plan';
import { claimYouTubeSubmission, getPublication, savePublication, saveIntegration } from './repository';
import { encryptSecret } from './secrets';
import { publishPublication, syncYouTubeShorts, type AutomationDeps } from './service';

async function fixture() {
  const db = await createTestDb();
  const date = '2026-10-09';
  const post = await seedPost(db, { date, kind: 'horoscope', audience: 'kadin' });
  const item = planPublications(date, [post], DEFAULT_SETTINGS.automation).find((item) => item.format === 'reels')!;
  const saved = (await savePublication(db, date, item, { videoUrl: 'https://blob.test/video.mp4' }))!;
  await db.update(publications).set({ status: 'published', media: { videoUrl: 'https://blob.test/video.mp4', durationSeconds: 175, partCount: 1 } }).where(eq(publications.id, saved.id));
  const key = randomBytes(32).toString('base64');
  await saveIntegration(db, { id: 'buffer', secretEncrypted: encryptSecret('buffer', key), account: { id: 'tt', username: 'test' }, expiresAt: null });
  await saveIntegration(db, { id: 'buffer_youtube', secretEncrypted: encryptSecret('buffer', key), account: { id: 'yt', username: 'test' }, expiresAt: null });
  const fetchMock = vi.fn(async (_url: unknown, options: RequestInit | undefined) => {
    const body = JSON.parse(String(options?.body));
    return Response.json(body.query.includes('createPost') ? { data: { createPost: { post: { id: 'youtube-one' } } } } : { data: { post: { id: 'youtube-one', status: 'sent', externalLink: null, error: null } } });
  });
  const deps: AutomationDeps = { db, appUrl: 'https://app.test', repository: 'test/test', integrationsKey: key, automationSecret: 'secret', now: () => new Date('2026-10-09T06:00:00Z'), sleep: async () => {}, fetch: fetchMock as typeof fetch, enqueue: async () => {}, deleteVideosBefore: async () => 0 };
  return { db, date, row: saved, deps, fetchMock };
}

describe('persisted publication safety', () => {
  it('atomically claims a YouTube submission only once', async () => {
    const { db, row, deps } = await fixture();
    expect(await claimYouTubeSubmission(db, row.id, deps.now())).not.toBeNull();
    expect(await claimYouTubeSubmission(db, row.id, deps.now())).toBeNull();
  });
  it('tracks YouTube ID and status and does not duplicate subsequent syncs', async () => {
    const { db, date, row, deps, fetchMock } = await fixture();
    expect(await syncYouTubeShorts(deps, date)).toEqual({ sent: 1, errors: [] });
    expect((await getPublication(db, row.id))?.media).toMatchObject({ youtubeRemoteId: 'youtube-one', youtubeStatus: 'sent' });
    expect(await syncYouTubeShorts(deps, date)).toEqual({ sent: 0, errors: [] });
    expect(fetchMock.mock.calls.filter((call) => String(call[1]?.body).includes('createPost'))).toHaveLength(1);
  });
  it('never submits an unverified or overlong published video', async () => {
    const { db, date, row, deps, fetchMock } = await fixture();
    await db.update(publications).set({ media: { videoUrl: 'https://blob.test/long.mp4', durationSeconds: 181 } }).where(eq(publications.id, row.id));
    const result = await syncYouTubeShorts(deps, date);
    expect(result.sent).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('blocks today’s old approved queue deliveries without Telegram approval', async () => {
    const { db, row, deps, fetchMock } = await fixture();
    await db.update(publications).set({ date: '2026-10-08', status: 'approved' }).where(eq(publications.id, row.id));
    deps.now = () => new Date('2026-10-08T06:00:00Z');
    expect(await publishPublication(deps, row.id)).toBe('ignored');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { saveSettings } from '@/lib/settings/repository';
import { completeReadyDay } from './service';
import { listPublications } from './repository';

it('blocks partial days and automatically enqueues the complete next day', async () => {
  const { db, date, deps } = await fixture();
  await saveSettings(db, { automation: { enabled: true, startDate: date, tiktok: { enabled: true } } });
  const enqueue = vi.fn(async () => {});
  deps.enqueue = enqueue;
  expect((await completeReadyDay(deps, date)).sent).toBe(false);
  expect(enqueue).not.toHaveBeenCalled();
  for (const kind of ['horoscope', 'tarot'] as const) {
    for (const audience of ['kadin', 'erkek'] as const) {
      const existing = (await listPublications(db, date)).find((row) => row.kind === kind && row.audience === audience);
      const post = existing ? { id: existing.postId, date, kind, audience, caption: existing.caption, hashtags: [] } : await seedPost(db, { date, kind, audience });
      for (const item of planPublications(date, [post], { ...DEFAULT_SETTINGS.automation, tiktok: { ...DEFAULT_SETTINGS.automation.tiktok, enabled: true } })) {
        if (item.format === 'carousel') continue;
        const saved = await savePublication(db, date, item, { videoUrl: 'https://blob.test/ready.mp4' });
        if (saved) await db.update(publications).set({ media: { videoUrl: 'https://blob.test/ready.mp4', durationSeconds: 175, partCount: 1 } }).where(eq(publications.id, saved.id));
      }
    }
  }
  await completeReadyDay(deps, date);
  const rows = await listPublications(db, date);
  expect(rows.every((row) => ['approved', 'published'].includes(row.status))).toBe(true);
  expect(enqueue).toHaveBeenCalledTimes(rows.filter((row) => row.status === 'approved').length);
});

it('keeps an ambiguous YouTube attempt blocked instead of duplicating it', async () => {
  const { db, date, row, deps, fetchMock } = await fixture();
  fetchMock.mockImplementation(async () => { throw new Error('connection interrupted'); });
  expect((await syncYouTubeShorts(deps, date)).errors).toHaveLength(1);
  expect((await getPublication(db, row.id))?.media.youtubeStatus).toBe('unknown');
  expect(await syncYouTubeShorts(deps, date)).toEqual({ sent: 0, errors: [] });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('never falls back to a regular YouTube video when Shorts is rejected', async () => {
  const { date, deps, fetchMock } = await fixture();
  fetchMock.mockImplementation(async () => Response.json({ data: { createPost: { message: 'YouTube Shorts limit is 3 minutes' } } }));
  expect((await syncYouTubeShorts(deps, date)).errors).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('#Shorts');
});
