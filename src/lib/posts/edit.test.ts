import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { getCurrentReadings } from '@/lib/content/repository';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { editPost, validatePostEdit } from './edit';
import { getPostDetail, getPostVersions } from './repository';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };
const EDITED_AT = new Date('2026-09-26T08:00:00Z');

let db: Db;
let postId: string;
beforeEach(async () => {
  db = await createTestDb();
  postId = (await seedPost(db, KEY)).id;
});

describe('validatePostEdit', () => {
  it('hashtagleri Türkçe kurallarla normalize eder ve tekrarı atar', () => {
    expect(validatePostEdit({ hashtags: ['İkizler', '#ikizler', 'burç', ' '] })).toEqual({ ok: true, value: { hashtags: ['#ikizler', '#burç'] } });
  });

  it('5ten fazla hashtagi, hashtagli caption\'ı, boş ve uzun metinleri reddeder', () => {
    expect(
      validatePostEdit({
        hashtags: ['#a', '#b', '#c', '#d', '#e', '#f'],
        caption: 'Güzel bir gün #burç',
        coverHook: '   ',
        signs: [{ sign: 'koc', headline: 'x'.repeat(41), body: 'Tamam', short: 'Kısa' }],
      }),
    ).toEqual({
      ok: false,
      errors: {
        hashtags: 'En fazla 5 hashtag kullanılabilir.',
        caption: 'Caption hashtag içermemeli; hashtagleri ayrı alana yaz.',
        coverHook: 'Boş bırakılamaz.',
        'koc.headline': 'En fazla 40 karakter olmalı (şu an 41).',
      },
    });
    expect(validatePostEdit({ hashtags: ['###'] })).toEqual({ ok: false, errors: { hashtags: 'Hashtag yalnızca harf, rakam ve alt çizgi içerebilir.' } });
  });
});

describe('editPost', () => {
  it('değişen burç için yeni yorum sürümü ve yeni gönderi sürümü açar; eski sürüm dokunulmadan kalır', async () => {
    const result = await editPost(
      db,
      postId,
      { coverHook: ' Yeni kanca ', format: '3x4', signs: [{ sign: 'aslan', headline: 'Elle yazılan başlık', body: 'Elle düzenlenen gövde.', short: 'Elle kısa' }] },
      EDITED_AT,
    );
    expect(result.status).toBe('created');
    const detail = await getPostDetail(db, (result as { postId: string }).postId);
    expect(detail?.post).toMatchObject({ version: 2, isCurrent: true, format: '3x4', cover: { hook: 'Yeni kanca' }, caption: 'Caption' });
    expect(detail?.slides[5].reading).toMatchObject({ sign: 'aslan', version: 2, headline: 'Elle yazılan başlık', provider: 'mock', editedAt: EDITED_AT });
    expect(detail?.slides[1].reading).toMatchObject({ sign: 'koc', version: 1 });
    expect((await getCurrentReadings(db, KEY)).find((row) => row.sign === 'aslan')?.headline).toBe('Elle yazılan başlık');
    const old = await getPostDetail(db, postId);
    expect(old?.post).toMatchObject({ isCurrent: false, format: '4x5', cover: { hook: 'Kanca' } });
    expect(old?.slides[5].reading).toMatchObject({ version: 1, headline: 'aslan başlık' });
  });

  it('değişiklik yoksa sürüm açmaz', async () => {
    expect(await editPost(db, postId, { caption: 'Caption', format: '4x5', signs: [{ sign: 'koc', headline: 'koc başlık', body: 'koc yorum', short: 'koc kısa' }] })).toEqual({
      status: 'unchanged',
      postId,
    });
    expect(await getPostVersions(db, KEY)).toHaveLength(1);
  });

  it('eski sürüm düzenlenemez; güncel sürümün kimliği döner', async () => {
    const first = await editPost(db, postId, { caption: 'İkinci sürümün açıklaması' });
    expect(await editPost(db, postId, { caption: 'Eski sürümden düzenleme denemesi' })).toEqual({
      status: 'stale',
      currentId: (first as { postId: string }).postId,
    });
    expect(await getPostVersions(db, KEY)).toHaveLength(2);
  });

  it('bilinmeyen gönderide not-found, geçersiz düzenlemede invalid döner', async () => {
    expect(await editPost(db, '00000000-0000-4000-8000-000000000000', { caption: 'x' })).toEqual({ status: 'not-found' });
    expect(await editPost(db, postId, { coverHook: '' })).toEqual({ status: 'invalid', errors: { coverHook: 'Boş bırakılamaz.' } });
  });

  it('aynı sürüme eşzamanlı iki kayıt geldiğinde ikinci kayıt eski temelden yeni sürüm açmaz', async () => {
    const results = await Promise.all([
      editPost(db, postId, { caption: 'Birinci eşzamanlı açıklama' }),
      editPost(db, postId, { caption: 'İkinci eşzamanlı açıklama' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['created', 'stale']);
    expect(await getPostVersions(db, KEY)).toHaveLength(2);
  });
});
