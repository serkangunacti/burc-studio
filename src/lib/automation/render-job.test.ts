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
  it('uzun içeriğin bütün video parçalarını aynı sırayla iki platforma kaydeder ve yeniden çizmez', async () => {
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
    await saveSettings(db, { automation: { tiktok: { enabled: true } } });
    const renderers = fakeRenderers();
    renderers.renderReels = vi.fn(async () => ({ videoUrl: 'https://blob.example/1.mp4', durationSeconds: 160, parts: [
      {videoUrl: 'https://blob.example/1.mp4', durationSeconds: 160},
      {videoUrl: 'https://blob.example/2.mp4', durationSeconds: 45},
    ] }));
    expect((await renderDay(db, DATE, renderers)).failures).toEqual([]);
    const rows = await listPublications(db, DATE);
    expect(rows.map(r => [r.format,r.part,r.media.videoUrl,r.media.durationSeconds,r.media.partCount])).toEqual([
      ['reels',0,'https://blob.example/1.mp4',160,2], ['tiktok',0,'https://blob.example/1.mp4',160,2],
      ['reels',1,'https://blob.example/2.mp4',45,2], ['tiktok',1,'https://blob.example/2.mp4',45,2],
    ]);
    const again = fakeRenderers();
    await renderDay(db, DATE, again);
    expect(again.videos).not.toHaveBeenCalled();
    expect(await listPublications(db, DATE)).toHaveLength(4);
  });
  it('zorla yeniden render onaylı eski videoyu yayın kuyruğundan çıkarır ve dış kimliklerini sıfırlar', async () => {
    await seedPost(db, {date: DATE,kind:'horoscope',audience:'kadin'});
    await renderDay(db,DATE,fakeRenderers());
    await approveDay(db,DATE);
    const [row] = await listPublications(db,DATE);
    await db.update(publications).set({remoteId:'old-buffer',publishedAt:new Date(),publishAttemptedAt:new Date()}).where(eq(publications.id,row.id));
    await renderDay(db,DATE,fakeRenderers(),{force:true});
    expect((await listPublications(db,DATE))[0]).toMatchObject({status:'ready',remoteId:null,publishAttemptedAt:null,publishedAt:null,approvedAt:null});
  });

  it('sesli render sonucunun AI bilgisini aynı MP4 ile iki platforma ve sonradan açılan TikTok satırına taşır', async () => {
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
    const renderers = fakeRenderers();
    renderers.renderReels = vi.fn(async () => ({ videoUrl: 'https://blob.example/voice.mp4', isAiGenerated: true }));
    await renderDay(db, DATE, renderers);
    expect((await listPublications(db, DATE)).find(row => row.format === 'reels')?.media).toEqual({ videoUrl: 'https://blob.example/voice.mp4', isAiGenerated: true });
    await saveSettings(db, { automation: { tiktok: { enabled: true } } });
    const later = fakeRenderers();
    await renderDay(db, DATE, later);
    expect(later.videos).not.toHaveBeenCalled();
    expect((await listPublications(db, DATE)).find(row => row.format === 'tiktok')?.media).toEqual({ videoUrl: 'https://blob.example/voice.mp4', isAiGenerated: true });
  });
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

  it('her gönderi için video çizer, şablon sürümünü pastel@2 olarak günceller', async () => {
    await seedPost(db, { date: DATE, kind: 'tarot', audience: 'erkek' });
    const renderers = fakeRenderers();
    const result = await renderDay(db, DATE, renderers);
    expect(result.failures).toEqual([]);
    expect(result.rendered).toHaveLength(1);
    expect(renderers.stills).not.toHaveBeenCalled();
    expect(renderers.videos).toHaveBeenCalledWith(expect.objectContaining({ templateVersion: 'pastel-tarot@2', name: `${DATE}-tarot-erkek` }));
    const rows = await listPublications(db, DATE);
    expect(rows.map((row) => row.status)).toEqual(['ready']);
    expect(rows[0].media.videoUrl).toBe(`https://blob.example/${DATE}-tarot-erkek.mp4`);
  });

  it('haftalık gönderiyi haftalık şablonla video olarak çizer', async () => {
    await seedPost(db, { date: '2026-09-28', kind: 'weekly', audience: 'kadin' });
    const renderers = fakeRenderers();
    const result = await renderDay(db, '2026-09-28', renderers);
    expect(result.failures).toEqual([]);
    expect(renderers.stills).not.toHaveBeenCalled();
    expect(renderers.videos).toHaveBeenCalledWith(expect.objectContaining({ templateVersion: 'pastel-weekly@2' }));
  });

  it('yeniden çalışınca hazır ve onaylı satırları yeniden çizmez; zorlanınca yalnız hazırları yeniler', async () => {
    await seedPost(db, { date: DATE, kind: 'horoscope', audience: 'kadin' });
    await renderDay(db, DATE, fakeRenderers());
    const again = fakeRenderers();
    expect((await renderDay(db, DATE, again)).kept).toHaveLength(1);
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
    expect(result.rendered).toHaveLength(1);
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
