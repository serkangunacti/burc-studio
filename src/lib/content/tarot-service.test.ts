import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { createMockModel } from '@/lib/llm/mock-model';
import type { ProviderSpec } from '@/lib/llm/providers';
import { getCurrentPost, getCurrentReadings } from './repository';
import { generateHoroscopeSet, regenerateSign } from './horoscope-service';

const DATE = '2026-09-27';
const KEY = { date: DATE, kind: 'tarot' as const, audience: 'kadin' as const };
const mock: ProviderSpec = { id: 'mock', label: 'mock', model: 'mock', dailyCap: 1000, factory: () => createMockModel() };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
const deps = () => ({ db, chain: [mock], baseHashtags: ['#burç'], timeoutMs: 1000 });
const cardOf = async (sign: string) => (await getCurrentReadings(db, KEY)).find((row) => row.sign === sign)!.meta.tarotCardId;

describe('tarot üretimi', () => {
  it('12 farklı kartlı tarot gönderisini tarot şablonu ve istemiyle üretir', async () => {
    expect((await generateHoroscopeSet(deps(), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false, kind: 'tarot' })).status).toBe('created');
    const readings = await getCurrentReadings(db, KEY);
    expect(readings).toHaveLength(12);
    expect(new Set(readings.map((row) => row.meta.tarotCardId)).size).toBe(12);
    expect(readings[0]).toMatchObject({ promptVersion: 'tarot-v2' });
    expect((await getCurrentPost(db, KEY))?.post.templateVersion).toBe('pastel-tarot@2');
  });

  it('tek burç yeniden yazılınca kartı korunur; kart yeniden çekilince diğer 11 kartla çakışmayan yeni kart gelir', async () => {
    await generateHoroscopeSet(deps(), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false, kind: 'tarot' });
    const original = await cardOf('aslan');
    await regenerateSign(deps(), { date: DATE, audience: 'kadin', sign: 'aslan', kind: 'tarot' });
    expect(await cardOf('aslan')).toBe(original);
    const others = (await getCurrentReadings(db, KEY)).filter((row) => row.sign !== 'aslan').map((row) => row.meta.tarotCardId);
    expect((await regenerateSign(deps(), { date: DATE, audience: 'kadin', sign: 'aslan', kind: 'tarot', redrawCard: true })).status).toBe('created');
    const redrawn = await cardOf('aslan');
    expect(redrawn).not.toBe(original);
    expect(others).not.toContain(redrawn);
    expect((await getCurrentReadings(db, KEY)).find((row) => row.sign === 'aslan')!.version).toBe(3);
    expect((await getCurrentPost(db, KEY))?.post.version).toBe(3);
  });
});
