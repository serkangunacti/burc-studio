import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { getPostDetail, getPostVersions, isPostId, listArchivePage, listArchivePosts, markPostDownloaded, setPostPublished } from './repository';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };
const T1 = new Date('2026-09-26T09:00:00Z');
const T2 = new Date('2026-09-26T10:00:00Z');

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('getPostDetail', () => {
  it('slaytları sırayla ve bağlı yorum sürümleriyle döner', async () => {
    const post = await seedPost(db, KEY);
    const detail = await getPostDetail(db, post.id);
    expect(detail?.post.id).toBe(post.id);
    expect(detail?.slides.map((slide) => slide.position)).toEqual([...Array(14).keys()]);
    expect(detail?.slides[0].reading).toBeNull();
    expect(detail?.slides[13].reading).toBeNull();
    expect(detail?.slides[1].reading).toMatchObject({ sign: 'koc', headline: 'koc başlık', version: 1 });
    expect(detail?.slides[12].reading?.sign).toBe('balik');
  });

  it('bilinmeyen ya da biçimsiz kimlikte null döner', async () => {
    expect(isPostId('abc')).toBe(false);
    expect(await getPostDetail(db, 'abc')).toBeNull();
    expect(await getPostDetail(db, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});

describe('getPostVersions', () => {
  it('bir gönderinin tüm sürümlerini yeniden eskiye döner', async () => {
    const first = await seedPost(db, KEY);
    const second = await seedPost(db, KEY);
    expect((await getPostVersions(db, KEY)).map(({ id, version, isCurrent }) => ({ id, version, isCurrent }))).toEqual([
      { id: second.id, version: 2, isCurrent: true },
      { id: first.id, version: 1, isCurrent: false },
    ]);
  });
});

describe('listArchivePosts', () => {
  it('yalnızca güncel sürümleri tarih ve kitleye göre sıralar, süzer ve sınırlar', async () => {
    const older = await seedPost(db, { ...KEY, date: '2026-09-25' });
    await seedPost(db, KEY);
    const current = await seedPost(db, KEY);
    const erkek = await seedPost(db, { ...KEY, audience: 'erkek' });
    // audience bir Postgres enum'u; sıralama tanım sırasına göredir (kadin, erkek, genel).
    expect((await listArchivePosts(db, { limit: 10 })).map((post) => post.id)).toEqual([current.id, erkek.id, older.id]);
    expect((await listArchivePosts(db, { audience: 'kadin', limit: 10 })).map((post) => post.id)).toEqual([current.id, older.id]);
    expect((await listArchivePosts(db, { before: '2026-09-26', limit: 10 })).map((post) => post.id)).toEqual([older.id]);
    expect(await listArchivePosts(db, { limit: 1 })).toHaveLength(1);
    await markPostDownloaded(db, older.id, T1);
    expect((await listArchivePosts(db, { status: 'indirildi', kind: 'horoscope', limit: 10 })).map((post) => post.id)).toEqual([older.id]);
  });
});

describe('listArchivePage', () => {
  it('sayfayı gün sınırında keser; bir günün gönderileri iki sayfaya bölünmez ve hiçbiri atlanmaz', async () => {
    const ids: string[] = [];
    for (const date of ['2026-09-26', '2026-09-25', '2026-09-24']) {
      ids.push((await seedPost(db, { ...KEY, date })).id, (await seedPost(db, { ...KEY, date, audience: 'erkek' })).id);
    }
    const first = await listArchivePage(db, {}, 3);
    expect(first.posts.map((post) => post.id)).toEqual(ids.slice(0, 2));
    expect(first.nextBefore).toBe('2026-09-26');
    const second = await listArchivePage(db, { before: first.nextBefore! }, 3);
    expect(second.posts.map((post) => post.id)).toEqual(ids.slice(2, 4));
    const third = await listArchivePage(db, { before: second.nextBefore! }, 3);
    expect(third).toEqual({ posts: expect.any(Array), nextBefore: null });
    expect(third.posts.map((post) => post.id)).toEqual(ids.slice(4, 6));
  });
});

describe('gönderi durumu', () => {
  it('indirme ve paylaşım işaretlerini yönetir, paylaşılmış gönderiyi indirme geri almaz', async () => {
    const post = await seedPost(db, KEY);
    expect(await markPostDownloaded(db, post.id, T1)).toMatchObject({ status: 'indirildi', downloadedAt: T1 });
    expect(await setPostPublished(db, post.id, true, T2)).toMatchObject({ status: 'paylasildi', publishedAt: T2 });
    expect(await markPostDownloaded(db, post.id, T2)).toMatchObject({ status: 'paylasildi', downloadedAt: T2 });
    expect(await setPostPublished(db, post.id, false, T2)).toMatchObject({ status: 'indirildi', publishedAt: null });
  });

  it('hiç indirilmemiş gönderide paylaşım geri alınınca taslağa döner; bilinmeyen kimlikte null', async () => {
    const post = await seedPost(db, KEY);
    await setPostPublished(db, post.id, true, T1);
    expect(await setPostPublished(db, post.id, false, T2)).toMatchObject({ status: 'taslak', publishedAt: null });
    expect(await markPostDownloaded(db, '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await setPostPublished(db, 'abc', true)).toBeNull();
  });
});
