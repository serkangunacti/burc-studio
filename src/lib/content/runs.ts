import { and, count, desc, eq, gte, lt, notLike } from 'drizzle-orm';
import { generationRuns, llmCalls } from '@/db/schema';
import { isUniqueViolation } from '@/db/errors';
import type { Db } from '@/db/types';
import { addDays, istanbulDateKey, istanbulDayStart, type DateKey } from '@/lib/date/istanbul';
import type { ProviderId } from '@/lib/llm/provider-ids';
import type { AttemptLog, ProviderUsage } from '@/lib/llm/router';
import type { SignSlug } from '@/lib/zodiac/signs';
import type { ReadingKey } from './repository';
import type { RunTrigger } from './types';

export const STALE_RUN_MS = 10 * 60 * 1000;
export type UsageRow = { date: DateKey; provider: string; ok: number; failed: number };

export async function startRun(
  db: Db,
  key: ReadingKey & { sign?: SignSlug; trigger: RunTrigger },
  now: Date = new Date(),
): Promise<{ id: string } | null> {
  await db
    .update(generationRuns)
    .set({ status: 'failed', error: 'Zaman aşımı: çalışma yarıda kaldı.', finishedAt: now })
    .where(and(eq(generationRuns.status, 'running'), lt(generationRuns.startedAt, new Date(now.getTime() - STALE_RUN_MS))));
  try {
    const [row] = await db
      .insert(generationRuns)
      .values({ date: key.date, kind: key.kind, audience: key.audience, sign: key.sign ?? null, trigger: key.trigger, status: 'running', startedAt: now })
      .returning({ id: generationRuns.id });
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

export async function finishRun(
  db: Db,
  id: string,
  result: { status: 'succeeded' } | { status: 'failed'; error: string },
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(generationRuns)
    .set({ status: result.status, error: result.status === 'failed' ? result.error : null, finishedAt: now })
    .where(eq(generationRuns.id, id));
}

export async function logLlmCall(db: Db, runId: string | null, log: AttemptLog, now: Date = new Date()): Promise<void> {
  await db.insert(llmCalls).values({
    runId,
    provider: log.providerId,
    model: log.model,
    status: log.status,
    httpStatus: log.httpStatus,
    error: log.error,
    inputTokens: log.inputTokens,
    outputTokens: log.outputTokens,
    latencyMs: log.latencyMs,
    createdAt: now,
  });
}

export async function getProviderUsage(db: Db, providerId: ProviderId, now: Date = new Date()): Promise<ProviderUsage> {
  const since = istanbulDayStart(istanbulDateKey(now));
  const [{ calls }] = await db
    .select({ calls: count() })
    .from(llmCalls)
    .where(and(eq(llmCalls.provider, providerId), gte(llmCalls.createdAt, since), notLike(llmCalls.status, 'skipped%')));
  const [last] = await db
    .select({ at: llmCalls.createdAt })
    .from(llmCalls)
    .where(and(eq(llmCalls.provider, providerId), eq(llmCalls.status, 'rate_limited')))
    .orderBy(desc(llmCalls.createdAt))
    .limit(1);
  return { callsToday: calls, lastRateLimitedAt: last?.at ?? null };
}

export async function getUsageSummary(db: Db, days: number, now: Date = new Date()): Promise<UsageRow[]> {
  const since = istanbulDayStart(addDays(istanbulDateKey(now), -(days - 1)));
  const rows = await db
    .select({ provider: llmCalls.provider, status: llmCalls.status, createdAt: llmCalls.createdAt })
    .from(llmCalls)
    .where(gte(llmCalls.createdAt, since));
  const summary = new Map<string, UsageRow>();
  for (const row of rows) {
    if (row.status.startsWith('skipped')) continue;
    const date = istanbulDateKey(row.createdAt);
    const key = `${date}|${row.provider}`;
    const entry = summary.get(key) ?? { date, provider: row.provider, ok: 0, failed: 0 };
    if (row.status === 'ok') entry.ok++;
    else entry.failed++;
    summary.set(key, entry);
  }
  return [...summary.values()].sort((a, b) => b.date.localeCompare(a.date) || a.provider.localeCompare(b.provider));
}
