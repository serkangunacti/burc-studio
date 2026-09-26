import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { handleEditPost, handlePostStatus } from './http';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };
const MISSING = '00000000-0000-4000-8000-000000000000';
const body = (value: unknown, method = 'PATCH') =>
  new Request('http://localhost/api/posts/x', { method, body: typeof value === 'string' ? value : JSON.stringify(value) });

let db: Db;
let postId: string;
beforeEach(async () => {
  db = await createTestDb();
  postId = (await seedPost(db, KEY)).id;
});

describe('handleEditPost', () => {
  it('geçersiz alanlarda 400 ve alan hataları, bozuk gövdede 400, geçerli düzenlemede 200 döner', async () => {
    const invalid = await handleEditPost(body({ coverHook: '' }), { db, postId });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'Bazı alanlar geçersiz.', errors: { coverHook: 'Boş bırakılamaz.' } });
    expect((await handleEditPost(body('bozuk'), { db, postId })).status).toBe(400);
    expect((await handleEditPost(body({ format: '5x5' }), { db, postId })).status).toBe(400);
    const ok = await handleEditPost(body({ coverHook: 'Yepyeni kanca' }), { db, postId });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: 'created' });
  });

  it('eski sürümde 409 ve güncel kimlik, bilinmeyen gönderide 404 döner', async () => {
    const created = await (await handleEditPost(body({ caption: 'Yeni açıklama' }), { db, postId })).json();
    const stale = await handleEditPost(body({ caption: 'Tekrar' }), { db, postId });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'Bu sürüm artık güncel değil.', currentId: created.postId });
    expect((await handleEditPost(body({ caption: 'x' }), { db, postId: MISSING })).status).toBe(404);
  });
});

describe('handlePostStatus', () => {
  it('indirildi ve paylaşıldı işaretlerini uygular; hatalı istekte 400, bilinmeyen gönderide 404', async () => {
    const status = async (value: unknown, id = postId) => handlePostStatus(body(value, 'POST'), { db, postId: id });
    expect(await (await status({ action: 'downloaded' })).json()).toEqual({ status: 'indirildi' });
    expect(await (await status({ action: 'published', value: true })).json()).toEqual({ status: 'paylasildi' });
    expect(await (await status({ action: 'published', value: false })).json()).toEqual({ status: 'indirildi' });
    expect((await status({ action: 'sil' })).status).toBe(400);
    expect((await status({ action: 'downloaded' }, MISSING)).status).toBe(404);
  });
});
