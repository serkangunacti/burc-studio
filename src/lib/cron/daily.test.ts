import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { createMockModel } from '@/lib/llm/mock-model';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { handleDailyCron } from './daily';

let db: Db;
let loads = 0;
beforeEach(async () => {
  db = await createTestDb();
  loads = 0;
});

function deps(cronEnabled = true) {
  return {
    secret: 'cron-anahtari',
    today: '2026-09-26',
    loadDeps: async () => {
      loads++;
      return {
        db,
        chain: [{ id: 'mock' as const, label: 'mock', model: 'mock', dailyCap: 1000, factory: () => createMockModel() }],
        baseHashtags: [],
        settings: { ...DEFAULT_SETTINGS, cronEnabled },
      };
    },
  };
}

const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/daily', authorization ? { headers: { authorization } } : undefined);

describe('handleDailyCron', () => {
  it('anahtarsız istek veritabanına dokunmadan 401 alır', async () => {
    expect((await handleDailyCron(request(), deps())).status).toBe(401);
    expect(loads).toBe(0);
  });

  it('cron kapalıysa üretmez', async () => {
    expect(await (await handleDailyCron(request('Bearer cron-anahtari'), deps(false))).json()).toEqual({
      ok: true,
      skipped: 'Otomatik üretim kapalı.',
      generated: [],
    });
  });

  it('plandaki gönderileri üretir, ikinci çalıştırmada atlar', async () => {
    const first = await (await handleDailyCron(request('Bearer cron-anahtari'), deps())).json();
    expect(first.ok).toBe(true);
    expect(first.generated.map((entry: { result: { status: string } }) => entry.result.status)).toEqual(['created', 'created', 'created', 'created']);
    const second = await (await handleDailyCron(request('Bearer cron-anahtari'), deps())).json();
    expect(second.generated.map((entry: { result: { status: string } }) => entry.result.status)).toEqual(['skipped', 'skipped', 'skipped', 'skipped']);
  });

  it('pazartesi günlük ve haftalık paketleri birlikte üretir', async () => {
    const body = await (await handleDailyCron(request('Bearer cron-anahtari'), { ...deps(), today: '2026-09-28' })).json();
    expect(body.ok).toBe(true);
    expect(
      body.generated.map((entry: { item: { kind: string; audience: string }; result: { status: string } }) => `${entry.item.kind}:${entry.item.audience}:${entry.result.status}`),
    ).toEqual(['horoscope:kadin:created', 'horoscope:erkek:created', 'tarot:kadin:created', 'tarot:erkek:created', 'weekly:kadin:created', 'weekly:erkek:created']);
  });

  it('tarotlu planla pazartesi 6 gönderi üretir', async () => {
    const base = deps();
    const withTarot = {
      ...base,
      today: '2026-09-28',
      loadDeps: async () => {
        const loaded = await base.loadDeps();
        return {
          ...loaded,
          settings: {
            ...loaded.settings,
            dailyPlan: [
              { kind: 'horoscope' as const, audience: 'kadin' as const },
              { kind: 'horoscope' as const, audience: 'erkek' as const },
              { kind: 'tarot' as const, audience: 'kadin' as const },
              { kind: 'tarot' as const, audience: 'erkek' as const },
            ],
          },
        };
      },
    };
    const body = await (await handleDailyCron(request('Bearer cron-anahtari'), withTarot)).json();
    expect(body.ok).toBe(true);
    expect(body.generated.map((entry: { item: { kind: string; audience: string }; result: { status: string } }) => `${entry.item.kind}:${entry.item.audience}:${entry.result.status}`)).toEqual([
      'horoscope:kadin:created', 'horoscope:erkek:created', 'tarot:kadin:created', 'tarot:erkek:created', 'weekly:kadin:created', 'weekly:erkek:created',
    ]);
  });
});
