import { MockLanguageModelV4 } from 'ai/test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { mockHoroscopeEntry, mockWeeklyBatch, mockWeeklyEntry } from '@/lib/llm/mock-content';
import { createMockModel } from '@/lib/llm/mock-model';
import type { ProviderSpec } from '@/lib/llm/providers';
import { getCurrentPost, getCurrentReadings } from './repository';
import { generateHoroscopeSet, regenerateSign } from './horoscope-service';

const MONDAY = '2026-09-28';
const mock: ProviderSpec = { id: 'mock', label: 'mock', model: 'mock', dailyCap: 1000, factory: () => createMockModel() };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
const deps = () => ({ db, chain: [mock], baseHashtags: ['#burç'], timeoutMs: 1000 });

describe('haftalık üretim', () => {
  it('pazartesi için 12 uzun yorumlu, her burca farklı kartlı haftalık gönderi üretir', async () => {
    const result = await generateHoroscopeSet(deps(), { date: MONDAY, audience: 'kadin', trigger: 'button', skipIfExists: false, kind: 'weekly' });
    expect(result.status).toBe('created');
    const readings = await getCurrentReadings(db, { date: MONDAY, kind: 'weekly', audience: 'kadin' });
    expect(readings).toHaveLength(12);
    expect(readings[0]).toMatchObject({ promptVersion: 'haftalik-v1' });
    expect(readings.every((row) => row.body.length >= 600)).toBe(true);
    expect(new Set(readings.map((row) => row.meta.tarotCardId)).size).toBe(12);
    expect((await getCurrentPost(db, { date: MONDAY, kind: 'weekly', audience: 'kadin' }))?.post.templateVersion).toBe('pastel-weekly@1');
    expect(await getCurrentPost(db, { date: MONDAY, kind: 'horoscope', audience: 'kadin' })).toBeNull();
  });

  it('pazartesi olmayan tarih için haftalık üretmez', async () => {
    await expect(generateHoroscopeSet(deps(), { date: '2026-09-29', audience: 'kadin', trigger: 'button', skipIfExists: false, kind: 'weekly' })).rejects.toThrow(
      'Haftalık yorum yalnızca pazartesi üretilir',
    );
  });

  it('tek burç yenilemede burcun haftalık kartı korunur', async () => {
    await generateHoroscopeSet(deps(), { date: MONDAY, audience: 'erkek', trigger: 'button', skipIfExists: false, kind: 'weekly' });
    const key = { date: MONDAY, kind: 'weekly' as const, audience: 'erkek' as const };
    const before = (await getCurrentReadings(db, key)).find((row) => row.sign === 'aslan')!;
    expect((await regenerateSign(deps(), { date: MONDAY, audience: 'erkek', sign: 'aslan', kind: 'weekly' })).status).toBe('created');
    const after = (await getCurrentReadings(db, key)).find((row) => row.sign === 'aslan')!;
    expect(after.version).toBe(2);
    expect(after.body.length).toBeGreaterThanOrEqual(600);
    expect(after.meta.tarotCardId).toBe(before.meta.tarotCardId);
  });

  it('günlük uzunlukta dönen burcu haftalık sınırlarla tek başına yeniden ister', async () => {
    const prompts: string[] = [];
    const model = new MockLanguageModelV4({
      doGenerate: async ({ prompt }) => {
        const text = JSON.stringify(prompt);
        prompts.push(text);
        const batch = mockWeeklyBatch();
        const payload = text.includes('Yalnızca şu burç için yaz')
          ? { burc: mockWeeklyEntry('boga') }
          : { ...batch, burclar: batch.burclar.map((entry, index) => (index === 1 ? mockHoroscopeEntry('boga') : entry)) };
        return {
          content: [{ type: 'text', text: JSON.stringify(payload) }],
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        };
      },
    });
    const scripted: ProviderSpec = { ...mock, factory: () => model };
    await generateHoroscopeSet({ ...deps(), chain: [scripted] }, { date: MONDAY, audience: 'kadin', trigger: 'button', skipIfExists: false, kind: 'weekly' });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('Yalnızca şu burç için yaz: Boğa (boga)');
    expect(prompts[1]).toMatch(/600-850 karakter olmalı \(şu an \d+\)/);
    const readings = await getCurrentReadings(db, { date: MONDAY, kind: 'weekly', audience: 'kadin' });
    expect(readings.every((row) => row.body.length >= 600)).toBe(true);
  });
});
