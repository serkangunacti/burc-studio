import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { createMockModel } from '@/lib/llm/mock-model';
import { AllProvidersFailedError } from '@/lib/llm/router';
import { startRun } from './runs';
import { describeGenerationError, generateDailyPackage, packageItemsFor } from './daily-package';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('generateDailyPackage', () => {
  it('plandaki her gönderiyi bağımsız üretir; biri meşgulse diğeri yine üretilir', async () => {
    await startRun(db, { date: '2026-09-26', kind: 'horoscope', audience: 'erkek', trigger: 'button' });
    const results = await generateDailyPackage(
      { db, chain: [{ id: 'mock', label: 'mock', model: 'mock', dailyCap: 1000, factory: () => createMockModel() }], baseHashtags: [] },
      {
        date: '2026-09-26',
        items: [
          { kind: 'horoscope', audience: 'kadin' },
          { kind: 'horoscope', audience: 'erkek' },
        ],
        trigger: 'cron',
        skipIfExists: true,
      },
    );
    expect(results.map((entry) => ('result' in entry ? entry.result.status : 'error'))).toEqual(['created', 'busy']);
  });
});

describe('describeGenerationError', () => {
  it('sağlayıcı denemelerini okunur özetler', () => {
    const error = new AllProvidersFailedError([
      { providerId: 'gateway', model: 'm', status: 'rate_limited', httpStatus: 429, error: 'limit', inputTokens: null, outputTokens: null, latencyMs: 1 },
    ]);
    expect(describeGenerationError(error)).toBe('Tüm sağlayıcılar başarısız oldu (1 deneme). gateway: rate_limited');
  });
});

describe('packageItemsFor', () => {
  const plan = [
    { kind: 'horoscope' as const, audience: 'kadin' as const },
    { kind: 'horoscope' as const, audience: 'erkek' as const },
  ];
  it('pazartesi günlük plana her kitle için haftalık ekler, diğer günler eklemez', () => {
    expect(packageItemsFor('2026-09-28', plan)).toEqual([...plan, { kind: 'weekly', audience: 'kadin' }, { kind: 'weekly', audience: 'erkek' }]);
    expect(packageItemsFor('2026-09-29', plan)).toEqual(plan);
    expect(packageItemsFor('2026-09-28', [plan[1]])).toEqual([plan[1], { kind: 'weekly', audience: 'erkek' }]);
  });
});
