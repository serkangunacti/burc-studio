import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { generationRuns, llmCalls, readings } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { mockHoroscopeBatch, mockHoroscopeEntry } from '@/lib/llm/mock-content';
import { createMockModel } from '@/lib/llm/mock-model';
import type { ProviderSpec } from '@/lib/llm/providers';
import { AllProvidersFailedError } from '@/lib/llm/router';
import { PostConflictError, createPostVersion, getCurrentPost, getCurrentReadings } from './repository';
import { startRun } from './runs';
import { generateHoroscopeSet, regenerateSign, rotateChain } from './horoscope-service';

const DATE = '2026-09-26';
const KEY = { date: DATE, kind: 'horoscope' as const, audience: 'kadin' as const };
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

function spec(model: MockLanguageModelV4, id: ProviderSpec['id'] = 'mock'): ProviderSpec {
  return { id, label: id, model: 'mock', dailyCap: 1000, factory: () => model };
}

function scripted(respond: (prompt: string) => unknown) {
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => ({
      content: [{ type: 'text', text: JSON.stringify(respond(JSON.stringify(prompt))) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const deps = (chain: ProviderSpec[]) => ({ db, chain, baseHashtags: ['#burç', '#astroloji'], timeoutMs: 1000 });

describe('generateHoroscopeSet', () => {
  it('12 yorumu ve 14 slaytlık gönderiyi tek çalışmada üretir', async () => {
    const result = await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false });
    expect(result).toMatchObject({ status: 'created', providers: ['mock'] });
    const current = await getCurrentReadings(db, KEY);
    expect(current).toHaveLength(12);
    expect(current[0]).toMatchObject({ sign: 'koc', provider: 'mock', promptVersion: 'burc-v1', meta: { luckyColor: 'lila', luckyNumber: 7 } });
    const post = await getCurrentPost(db, KEY);
    expect(post?.post).toMatchObject({ templateVersion: 'pastel@1', format: '4x5', hashtags: ['#burç', '#astroloji', '#günlükburç', '#yıldızlar'] });
    expect(post?.slides).toHaveLength(14);
    expect((await db.select().from(generationRuns))[0]).toMatchObject({ status: 'succeeded', trigger: 'button' });
    expect(await db.select().from(llmCalls)).toHaveLength(1);
  });

  it('geçersiz tek burcu ayrıca yeniden ister', async () => {
    const model = scripted((prompt) => {
      if (prompt.includes('Yalnızca şu burç için yaz')) return { burc: mockHoroscopeEntry('koc') };
      const batch = mockHoroscopeBatch();
      batch.burclar[0] = { ...batch.burclar[0], yorum: 'Kısa.' };
      return batch;
    });
    const result = await generateHoroscopeSet(deps([spec(model)]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false });
    expect(result.status).toBe('created');
    expect((await getCurrentReadings(db, KEY))[0].body).toBe(mockHoroscopeEntry('koc').yorum);
    expect(await db.select().from(llmCalls)).toHaveLength(2);
  });

  it('içerik varsa ve skipIfExists açıksa atlar', async () => {
    await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'cron', skipIfExists: true });
    expect(await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'cron', skipIfExists: true })).toEqual({ status: 'skipped' });
  });

  it('yük dağıtımı açıkken erkek seti ikinci sağlayıcıdan başlar', async () => {
    const chain = [spec(createMockModel(), 'gateway'), spec(createMockModel(), 'gemini')];
    const spread = { ...deps(chain), spreadLoad: true };
    expect(await generateHoroscopeSet(spread, { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false })).toMatchObject({ providers: ['gateway'] });
    expect(await generateHoroscopeSet(spread, { date: DATE, audience: 'erkek', trigger: 'button', skipIfExists: false })).toMatchObject({ providers: ['gemini'] });
  });

  it('aynı anahtarda üretim sürerken busy döner', async () => {
    await startRun(db, { ...KEY, trigger: 'cron' });
    expect(await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false })).toEqual({ status: 'busy' });
  });

  it('zincir tükenirse hiçbir yorum kaydetmez ve çalışmayı failed işaretler', async () => {
    const failing = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({ message: 'HTTP 500', url: 'x', requestBodyValues: {}, statusCode: 500, isRetryable: true });
      },
    });
    await expect(
      generateHoroscopeSet(deps([spec(failing)]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false }),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);
    expect(await db.select().from(readings)).toHaveLength(0);
    expect((await db.select().from(generationRuns))[0]).toMatchObject({ status: 'failed' });
  });

  it('zaman bütçesi dolarsa beklemeden durur ve çalışmayı failed işaretler', async () => {
    const hang = new MockLanguageModelV4({
      doGenerate: ({ abortSignal }) => new Promise<never>((_, reject) => abortSignal?.addEventListener('abort', () => reject(abortSignal.reason))),
    });
    const started = Date.now();
    await expect(
      generateHoroscopeSet({ ...deps([spec(hang)]), timeoutMs: 1_000, budgetMs: 100 }, { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false }),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);
    expect(Date.now() - started).toBeLessThan(800);
    expect((await db.select().from(generationRuns))[0]).toMatchObject({ status: 'failed' });
  });

  it('ayarlardaki varsayılan formatla gönderi açar', async () => {
    await generateHoroscopeSet({ ...deps([spec(createMockModel())]), format: '3x4' }, { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false });
    expect((await getCurrentPost(db, KEY))?.post.format).toBe('3x4');
  });
});

describe('rotateChain', () => {
  it('zinciri verilen adım kadar döndürür', () => {
    expect(rotateChain(['a', 'b', 'c'], 1)).toEqual(['b', 'c', 'a']);
    expect(rotateChain(['a', 'b'], 3)).toEqual(['b', 'a']);
    expect(rotateChain([], 1)).toEqual([]);
  });
});

describe('regenerateSign', () => {
  it('tek burcun yeni sürümünü ve yeni gönderi sürümünü oluşturur, eskisi arşivde kalır', async () => {
    await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false });
    const before = await getCurrentPost(db, KEY);
    const result = await regenerateSign(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', sign: 'aslan' });
    expect(result.status).toBe('created');
    const current = await getCurrentReadings(db, KEY);
    expect(current.find((row) => row.sign === 'aslan')?.version).toBe(2);
    expect(current.find((row) => row.sign === 'koc')?.version).toBe(1);
    const after = await getCurrentPost(db, KEY);
    expect(after?.post.version).toBe(2);
    expect(after?.slides[5].readingId).toBe(current.find((row) => row.sign === 'aslan')?.id);
    expect(after?.slides[5].readingId).not.toBe(before?.slides[5].readingId);
    expect(after?.post.caption).toBe(before?.post.caption);
  });

  it('yenileme sürerken gönderi başka bir sürüme geçerse eski temelden sürüm açmaz', async () => {
    await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false });
    const base = (await getCurrentPost(db, KEY))!;
    const racing = scripted(() => ({ burc: mockHoroscopeEntry('aslan') }));
    const original = racing.doGenerate.bind(racing);
    racing.doGenerate = async (options) => {
      await createPostVersion(db, { ...KEY, templateVersion: 'pastel@1', format: '4x5', cover: base.post.cover, caption: 'Araya giren sürüm', hashtags: [], signReadingIds: base.slides.filter((slide) => slide.type === 'sign').map((slide) => slide.readingId as string) });
      return original(options);
    };
    await expect(regenerateSign(deps([spec(racing)]), { date: DATE, audience: 'kadin', sign: 'aslan' })).rejects.toBeInstanceOf(PostConflictError);
    expect((await getCurrentPost(db, KEY))?.post).toMatchObject({ version: 2, caption: 'Araya giren sürüm' });
  });

  it('o günün yorumları yoksa missing döner', async () => {
    expect(await regenerateSign(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', sign: 'aslan' })).toEqual({ status: 'missing' });
  });
});
