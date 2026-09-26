import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ProviderId } from './provider-ids';
import type { ProviderSpec } from './providers';
import { AllProvidersFailedError, NoProvidersConfiguredError, generateWithFailover, type AttemptLog, type ProviderUsage } from './router';

const HANG = Symbol('hang');
type Behaviour = { n: number } | string | Error | typeof HANG;

const usage = {
  inputTokens: { total: 11, noCache: 11, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 22, text: 22, reasoning: undefined },
};

function apiError(statusCode: number) {
  return new APICallError({ message: `HTTP ${statusCode}`, url: 'https://example.test', requestBodyValues: {}, statusCode, isRetryable: statusCode >= 500 });
}

function provider(id: ProviderId, behaviours: Behaviour[], dailyCap = 100) {
  let calls = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async ({ abortSignal }) => {
      const behaviour = behaviours[Math.min(calls, behaviours.length - 1)];
      calls++;
      if (behaviour === HANG) {
        return new Promise<never>((_, reject) => abortSignal?.addEventListener('abort', () => reject(abortSignal.reason)));
      }
      if (behaviour instanceof Error) throw behaviour;
      const text = typeof behaviour === 'string' ? behaviour : JSON.stringify(behaviour);
      return { content: [{ type: 'text', text }], finishReason: { unified: 'stop', raw: undefined }, usage, warnings: [] };
    },
  });
  const spec: ProviderSpec = { id, label: id, model: `${id}-model`, dailyCap, factory: () => model };
  return { spec, calls: () => calls };
}

const request = {
  schema: z.object({ n: z.number() }),
  instructions: 'talimat',
  prompt: 'istem',
  validate: (value: { n: number }) => (value.n > 0 ? [] : [{ field: 'n', message: 'pozitif olmalı' }]),
};

function deps(chain: ProviderSpec[], usageById: Partial<Record<ProviderId, ProviderUsage>> = {}) {
  const logs: AttemptLog[] = [];
  return {
    logs,
    value: {
      chain,
      usage: async (id: ProviderId) => usageById[id] ?? { callsToday: 0, lastRateLimitedAt: null },
      onAttempt: async (log: AttemptLog) => {
        logs.push(log);
      },
      now: () => new Date('2026-09-26T10:00:00Z'),
      timeoutMs: 50,
    },
  };
}

describe('generateWithFailover', () => {
  it('ilk sağlayıcı başarılıysa onu kullanır ve kullanımı kaydeder', async () => {
    const a = provider('gateway', [{ n: 1 }]);
    const d = deps([a.spec]);
    await expect(generateWithFailover(d.value, request)).resolves.toEqual({ value: { n: 1 }, providerId: 'gateway', model: 'gateway-model' });
    expect(d.logs).toMatchObject([{ providerId: 'gateway', status: 'ok', inputTokens: 11, outputTokens: 22, httpStatus: null }]);
  });

  it('429 alınca tekrar denemeden sıradakine geçer', async () => {
    const a = provider('gateway', [apiError(429)]);
    const b = provider('gemini', [{ n: 2 }]);
    const d = deps([a.spec, b.spec]);
    expect((await generateWithFailover(d.value, request)).providerId).toBe('gemini');
    expect(a.calls()).toBe(1);
    expect(d.logs.map((log) => [log.providerId, log.status, log.httpStatus])).toEqual([
      ['gateway', 'rate_limited', 429],
      ['gemini', 'ok', null],
    ]);
  });

  it('401 ve 404 hatalarında da hemen sıradakine geçer', async () => {
    const a = provider('gateway', [apiError(401)]);
    const b = provider('gemini', [apiError(404)]);
    const c = provider('gemini-lite', [{ n: 3 }]);
    const d = deps([a.spec, b.spec, c.spec]);
    expect((await generateWithFailover(d.value, request)).providerId).toBe('gemini-lite');
    expect(d.logs.map((log) => log.status)).toEqual(['auth_error', 'client_error', 'ok']);
  });

  it('5xx sonrasında aynı sağlayıcıyı bir kez daha dener', async () => {
    const a = provider('gateway', [apiError(503), { n: 4 }]);
    const d = deps([a.spec]);
    expect((await generateWithFailover(d.value, request)).value).toEqual({ n: 4 });
    expect(d.logs.map((log) => log.status)).toEqual(['server_error', 'ok']);
  });

  it('kaliteyi iki kez geçemeyen sağlayıcıdan sonrakine geçer', async () => {
    const a = provider('gateway', [{ n: -1 }]);
    const b = provider('gemini', ['bozuk json', { n: 5 }]);
    const d = deps([a.spec, b.spec]);
    expect((await generateWithFailover(d.value, request)).value).toEqual({ n: 5 });
    expect(d.logs.map((log) => [log.providerId, log.status])).toEqual([
      ['gateway', 'invalid_output'],
      ['gateway', 'invalid_output'],
      ['gemini', 'invalid_output'],
      ['gemini', 'ok'],
    ]);
    expect(d.logs[0].error).toBe('n: pozitif olmalı');
  });

  it('zaman aşımını bir kez tekrar dener, sonra sıradakine geçer', async () => {
    const a = provider('gateway', [HANG]);
    const b = provider('gemini', [{ n: 6 }]);
    const d = deps([a.spec, b.spec]);
    expect((await generateWithFailover(d.value, request)).providerId).toBe('gemini');
    expect(d.logs.map((log) => log.status)).toEqual(['timeout', 'timeout', 'ok']);
  });

  it('günlük tavanı dolan ve son bir saatte 429 alan sağlayıcıyı çağırmadan atlar', async () => {
    const a = provider('gateway', [{ n: 1 }], 5);
    const b = provider('gemini', [{ n: 1 }]);
    const c = provider('gemini-lite', [{ n: 7 }]);
    const d = deps([a.spec, b.spec, c.spec], {
      gateway: { callsToday: 5, lastRateLimitedAt: null },
      gemini: { callsToday: 1, lastRateLimitedAt: new Date('2026-09-26T09:30:00Z') },
    });
    expect((await generateWithFailover(d.value, request)).providerId).toBe('gemini-lite');
    expect(a.calls() + b.calls()).toBe(0);
    expect(d.logs.map((log) => log.status)).toEqual(['skipped_cap', 'skipped_cooldown', 'ok']);
  });

  it('bir saatten eski 429 soğuması sağlayıcıyı engellemez', async () => {
    const a = provider('gemini', [{ n: 8 }]);
    const d = deps([a.spec], { gemini: { callsToday: 1, lastRateLimitedAt: new Date('2026-09-26T08:30:00Z') } });
    expect((await generateWithFailover(d.value, request)).providerId).toBe('gemini');
  });

  it('hepsi başarısızsa tüm denemelerle hata fırlatır', async () => {
    const a = provider('gateway', [apiError(500)]);
    const d = deps([a.spec]);
    const error = await generateWithFailover(d.value, request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AllProvidersFailedError);
    expect((error as AllProvidersFailedError).attempts.map((log) => log.status)).toEqual(['server_error', 'server_error']);
  });

  it('zaman bütçesi dolunca kalan sağlayıcıları denemeden hata fırlatır', async () => {
    const a = provider('gateway', [HANG]);
    const b = provider('gemini', [{ n: 9 }]);
    const d = deps([a.spec, b.spec]);
    const error = await generateWithFailover({ ...d.value, timeoutMs: 1_000, deadline: Date.now() + 80 }, request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AllProvidersFailedError);
    expect(b.calls()).toBe(0);
    expect(d.logs.map((log) => log.status)).toEqual(['timeout']);
  });

  it('zincir boşsa yapılandırma hatası fırlatır', async () => {
    await expect(generateWithFailover(deps([]).value, request)).rejects.toBeInstanceOf(NoProvidersConfiguredError);
  });
});
