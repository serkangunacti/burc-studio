import { beforeEach, describe, expect, it } from 'vitest';
import { generationRuns } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import type { AttemptLog } from '@/lib/llm/router';
import { finishRun, getProviderUsage, getUsageSummary, logLlmCall, startRun } from './runs';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const, trigger: 'button' as const };
const T0 = new Date('2026-09-26T07:00:00Z');
const minutes = (value: number) => new Date(T0.getTime() + value * 60_000);

function log(status: AttemptLog['status'], providerId: AttemptLog['providerId'] = 'gemini'): AttemptLog {
  return { providerId, model: 'm', status, httpStatus: status === 'rate_limited' ? 429 : null, error: null, inputTokens: 1, outputTokens: 2, latencyMs: 10 };
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('üretim kilidi', () => {
  it('aynı anahtarda ikinci üretim başlatılamaz, bitince başlatılabilir', async () => {
    const first = await startRun(db, KEY, T0);
    expect(first).not.toBeNull();
    expect(await startRun(db, { ...KEY, trigger: 'cron' }, minutes(1))).toBeNull();
    expect(await startRun(db, { ...KEY, audience: 'erkek' }, minutes(1))).not.toBeNull();
    await finishRun(db, first!.id, { status: 'succeeded' }, minutes(2));
    expect(await startRun(db, KEY, minutes(3))).not.toBeNull();
  });

  it('10 dakikadan eski yarım kalmış üretim kilidi bırakır ve başarısız sayılır', async () => {
    const stale = await startRun(db, KEY, T0);
    expect(await startRun(db, KEY, minutes(11))).not.toBeNull();
    const rows = await db.select().from(generationRuns);
    expect(rows.find((row) => row.id === stale!.id)).toMatchObject({ status: 'failed', error: 'Zaman aşımı: çalışma yarıda kaldı.' });
  });
});

describe('sağlayıcı kullanımı', () => {
  it('bugünün gerçek çağrılarını sayar, atlananları ve dünü saymaz, son 429 zamanını döner', async () => {
    await logLlmCall(db, null, log('ok'), new Date('2026-09-25T20:00:00Z'));
    await logLlmCall(db, null, log('ok'), minutes(0));
    await logLlmCall(db, null, log('rate_limited'), minutes(5));
    await logLlmCall(db, null, log('skipped_cooldown'), minutes(6));
    await logLlmCall(db, null, log('ok', 'gateway'), minutes(7));
    expect(await getProviderUsage(db, 'gemini', minutes(10))).toEqual({ callsToday: 2, lastRateLimitedAt: minutes(5) });
  });

  it('son günlerin kullanımını gün ve sağlayıcı bazında özetler', async () => {
    await logLlmCall(db, null, log('ok'), minutes(0));
    await logLlmCall(db, null, log('server_error'), minutes(1));
    await logLlmCall(db, null, log('skipped_cap'), minutes(2));
    await logLlmCall(db, null, log('ok', 'gateway'), new Date('2026-09-25T10:00:00Z'));
    expect(await getUsageSummary(db, 7, minutes(10))).toEqual([
      { date: '2026-09-26', provider: 'gemini', ok: 1, failed: 1 },
      { date: '2026-09-25', provider: 'gateway', ok: 1, failed: 0 },
    ]);
  });
});
