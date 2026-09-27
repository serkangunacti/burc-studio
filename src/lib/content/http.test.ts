import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { createMockModel } from '@/lib/llm/mock-model';
import type { ProviderSpec } from '@/lib/llm/providers';
import { handleGenerate, handleRegenerateSign } from './http';
import { startRun } from './runs';

const TODAY = '2026-09-26';
let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const mock: ProviderSpec = { id: 'mock', label: 'mock', model: 'mock', dailyCap: 1000, factory: () => createMockModel() };
const deps = (chain: ProviderSpec[] = [mock]) => ({ db, chain, baseHashtags: ['#burç'], today: TODAY, timeoutMs: 1000 });
const post = (body: unknown) => new Request('http://localhost/api/generate', { method: 'POST', body: JSON.stringify(body) });

describe('handleGenerate', () => {
  it.each([
    [{ date: '2026-09-26' }],
    [{ date: '2026-09-26', audience: 'cocuk' }],
    [{ date: '2026-09-28', audience: 'kadin' }],
    [{ date: '2026-09-18', audience: 'kadin' }],
  ])('%j → 400', async (body) => {
    expect((await handleGenerate(post(body), deps())).status).toBe(400);
  });

  it('tarot üretir; tek burcun kartı yeniden çekilebilir', async () => {
    expect((await handleGenerate(post({ date: TODAY, audience: 'erkek', kind: 'tarot' }), deps())).status).toBe(200);
    const redraw = await handleRegenerateSign(post({ date: TODAY, audience: 'erkek', sign: 'koc', kind: 'tarot', redrawCard: true }), deps());
    expect(redraw.status).toBe(200);
    expect(await redraw.json()).toMatchObject({ status: 'created' });
  });

  it('haftalık üretim yalnızca pazartesi tarihinde kabul edilir', async () => {
    const monday = await handleGenerate(post({ date: '2026-09-21', audience: 'kadin', kind: 'weekly' }), deps());
    expect(monday.status).toBe(200);
    expect(await monday.json()).toMatchObject({ status: 'created' });
    expect((await handleGenerate(post({ date: '2026-09-22', audience: 'kadin', kind: 'weekly' }), deps())).status).toBe(400);
    expect((await handleGenerate(post({ date: '2026-09-21', audience: 'kadin', kind: 'ozel' }), deps())).status).toBe(400);
    expect((await handleRegenerateSign(post({ date: '2026-09-21', audience: 'kadin', sign: 'koc', kind: 'weekly' }), deps())).status).toBe(200);
  });

  it('üretir, ikinci istekte atlar, force ile yeniden üretir', async () => {
    const first = await handleGenerate(post({ date: '2026-09-27', audience: 'kadin' }), deps());
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ status: 'created', providers: ['mock'] });
    expect(await (await handleGenerate(post({ date: '2026-09-27', audience: 'kadin' }), deps())).json()).toEqual({ status: 'skipped' });
    expect(await (await handleGenerate(post({ date: '2026-09-27', audience: 'kadin', force: true }), deps())).json()).toMatchObject({ status: 'created' });
  });

  it('üretim sürerken 409 döner', async () => {
    await startRun(db, { date: TODAY, kind: 'horoscope', audience: 'kadin', trigger: 'cron' });
    const res = await handleGenerate(post({ date: TODAY, audience: 'kadin' }), deps());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Bu içerik şu anda üretiliyor.' });
  });

  it('sağlayıcı yoksa 503, hepsi başarısızsa denemelerle 502 döner', async () => {
    expect((await handleGenerate(post({ date: TODAY, audience: 'kadin' }), deps([]))).status).toBe(503);
    const failing = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({ message: 'HTTP 429', url: 'x', requestBodyValues: {}, statusCode: 429 });
      },
    });
    const res = await handleGenerate(post({ date: TODAY, audience: 'kadin' }), deps([{ ...mock, factory: () => failing }]));
    expect(res.status).toBe(502);
    expect((await res.json()).attempts).toEqual([{ provider: 'mock', status: 'rate_limited', error: 'HTTP 429' }]);
  });
});

describe('handleRegenerateSign', () => {
  const regen = (body: unknown) => new Request('http://localhost/api/generate/sign', { method: 'POST', body: JSON.stringify(body) });

  it('yorum yoksa 404, varsa 200 döner; bilinmeyen burç 400 alır', async () => {
    expect((await handleRegenerateSign(regen({ date: TODAY, audience: 'kadin', sign: 'aslan' }), deps())).status).toBe(404);
    await handleGenerate(post({ date: TODAY, audience: 'kadin' }), deps());
    const res = await handleRegenerateSign(regen({ date: TODAY, audience: 'kadin', sign: 'aslan' }), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'created' });
    expect((await handleRegenerateSign(regen({ date: TODAY, audience: 'kadin', sign: 'ejderha' }), deps())).status).toBe(400);
  });
});
