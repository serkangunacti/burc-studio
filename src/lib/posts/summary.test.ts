import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { getPostDetail, getPostVersions } from './repository';
import { STATUS_LABELS, toDraftSource, toPostSummary, toVersionSummary } from './summary';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('istemci özetleri', () => {
  it('gönderiyi JSON uyumlu özete çevirir', async () => {
    const post = await seedPost(db, KEY);
    expect(toPostSummary(post)).toEqual({
      id: post.id,
      date: '2026-09-26',
      kind: 'horoscope',
      audience: 'kadin',
      version: 1,
      isCurrent: true,
      status: 'taslak',
      templateVersion: 'pastel@1',
      format: '4x5',
      caption: 'Caption',
      hashtags: ['#burç'],
      downloadedAt: null,
      publishedAt: null,
    });
    const [version] = await getPostVersions(db, KEY);
    expect(toVersionSummary(version)).toEqual({ id: post.id, version: 1, isCurrent: true, status: 'taslak', createdAt: version.createdAt.toISOString() });
    expect(STATUS_LABELS.paylasildi).toBe('Paylaşıldı');
  });

  it('taslak kaynağını 12 burcun metinleriyle üretir', async () => {
    const post = await seedPost(db, KEY, { hook: 'Özel kanca' });
    const draft = toDraftSource((await getPostDetail(db, post.id))!);
    expect(draft).toMatchObject({ format: '4x5', hook: 'Özel kanca', caption: 'Caption', hashtags: ['#burç'] });
    expect(draft.signs).toHaveLength(12);
    expect(draft.signs[0]).toEqual({ sign: 'koc', headline: 'koc başlık', body: 'koc yorum', short: 'koc kısa' });
  });
});
