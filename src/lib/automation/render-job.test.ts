import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publications } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { missingPosts, renderDay, type Renderers } from './render-job';
import { approveDay, listPublications } from './repository';
import { saveSettings } from '@/lib/settings/repository';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';

const DATE = '2026-09-29';
let db: Db;

function fakeRenderers(): Renderers & { stills: ReturnType<typeof vi.fn>; videos: ReturnType<typeof vi.fn> } {
  const stills = vi.fn(async (_version: string, slides: unknown[]) => slides.map((_, index) => new Uint8Array([index])));
  const videos = vi.fn(async ({ name }: { name: string }) => `https://blob.example/${name}.mp4`);
  return { renderStills: stills, renderReels: videos, stills, videos };
}

beforeEach(async () => {
  db = await createTestDb();
});

describe('günün render işi', () => {
  it('başlangıçtan önce eski planı zorla tetikleme dahil çizmez', async () => {
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
    await saveSettings(db, { automation: { startDate: '2026-10-05' } });
    const renderers = fakeRenderers();
    expect(await renderDay(db, DATE, renderers, { force: true })).toEqual({ rendered: [], kept: [], failures: [] });
    expect(renderers.stills).not.toHaveBeenCalled();
    expect(renderers.videos).not.toHaveBeenCalled();
    expect(await listPublications(db, DATE)).toEqual([]);
  });

  it('eksik gönderileri listeler', async () => {
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
    expect(await missingPosts(db, DATE)).toEqual(['horoscope-erkek', 'tarot-kadin', 'tarot-erkek']);
  });

  it('her gönderi için 3 carousel parçası (6 görsel) ve bir Reels çizer, şablon sürümünü korur', async () => {
    await seedPost(db, { date: DATE, kind: 'tarot', audience: 'erkek' });
    const renderers = fakeRenderers();
    const result = await renderDay(db, DATE, renderers);
    expect(result.failures).toEqual([]);
    expect(result.rendered).toHaveLength(4);
    expect(renderers.stills).toHaveBeenCalledTimes(3);
    expect(renderers.stills.mock.calls.every(([version, slides]) => version === 'pastel-tarot@1' && slides.length === 6)).toBe(true);
    expect(renderers.videos).toHaveBeenCalledWith(expect.objectContaining({ templateVersion: 'pastel-tarot@1', name: `${DATE}-tarot-erkek` }));
    const rows = await listPublications(db, DATE);
    expect(rows.map((row) => row.status)).toEqual(['ready', 'ready', 'ready', 'ready']);
    expect(rows[3].media.videoUrl).toBe(`https://blob.example/${DATE}-tarot-erkek.mp4`);
  });

  it('haftalık gönderiyi de üç parçaya böler ve haftalık şablonla çizer', async () => {
    await seedPost(db, { date: '2026-09-28', kind: 'weekly', audience: 'kadin' });
    const renderers = fakeRenderers();
    const result = await renderDay(db, '2026-09-28', renderers);
    expect(result.failures).toEqual([]);
    expect(renderers.stills.mock.calls.map(([version, slides]) => [version, slides.length])).toEqual(Array(3).fill(['pastel-weekly@1', 6]));
    expect(renderers.videos).toHaveBeenCalledWith(expect.objectContaining({ templateVersion: 'pastel-weekly@1' }));
  });

  it('yeniden çalışınca hazır ve onaylı satırları yeniden çizmez; zorlanınca yalnız hazırları yeniler', async () => {
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
    await renderDay(db, DATE, fakeRenderers());
    const again = fakeRenderers();
    expect((await renderDay(db, DATE, again)).kept).toHaveLength(4);
    expect(again.stills).not.toHaveBeenCalled();
    await approveDay(db, DATE);
    const forced = fakeRenderers();
    await renderDay(db, DATE, forced, { force: true });
    expect(forced.stills).not.toHaveBeenCalled();
  });

  it('bir gönderinin hatası diğerlerini durdurmaz', async () => {
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'erkek' });
    const renderers = fakeRenderers();
    renderers.videos.mockRejectedValueOnce(new Error('kodlayıcı çöktü'));
    const result = await renderDay(db, DATE, renderers);
    expect(result.failures).toEqual(['horoscope-kadin: kodlayıcı çöktü']);
    expect(result.rendered).toHaveLength(7);
  });

  it('TikTok, Reels videosunu yeniden çizmeden kullanır; sonradan açılınca mevcut videoyu alır', async () => {
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
    await saveSettings(db, { automation: { ...DEFAULT_SETTINGS.automation, tiktok: { enabled: true } } });
    const renderers = fakeRenderers();
    await renderDay(db, DATE, renderers);
    expect(renderers.videos).toHaveBeenCalledTimes(1);
    const rows = await listPublications(db, DATE);
    const url = `https://blob.example/${DATE}-horoscope-kadin.mp4`;
    expect(rows.filter((row) => row.format !== 'carousel').map((row) => [row.format, row.media.videoUrl])).toEqual([
      ['reels', url],
      ['tiktok', url],
    ]);
  });

  it('TikTok sonradan açılırsa yalnız TikTok satırını ekler, videoyu yeniden çizmez', async () => {
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
    await renderDay(db, DATE, fakeRenderers());
    await saveSettings(db, { automation: { ...DEFAULT_SETTINGS.automation, tiktok: { enabled: true } } });
    const renderers = fakeRenderers();
    const result = await renderDay(db, DATE, renderers);
    expect(result.rendered).toEqual(['horoscope-kadin-tiktok-0']);
    expect(renderers.videos).not.toHaveBeenCalled();
    expect(renderers.stills).not.toHaveBeenCalled();
  });

  it('paylaşımda başarısız olan satırı geç gelen tetiklemede yeniden çizmez ve onaysız duruma çekmez', async () => {
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
    await renderDay(db, DATE, fakeRenderers());
    await approveDay(db, DATE);
    const [first] = await listPublications(db, DATE);
    await db.update(publications).set({ status: 'failed' }).where(eq(publications.id, first.id));
    const renderers = fakeRenderers();
    expect((await renderDay(db, DATE, renderers)).rendered).toEqual([]);
    expect(renderers.stills).not.toHaveBeenCalled();
    expect((await listPublications(db, DATE))[0].status).toBe('failed');
  });
});
