import type { Db } from '@/db/types';
import { getSkySnapshot } from '@/lib/astro/sky';
import type { DateKey } from '@/lib/date/istanbul';
import type { ProviderId } from '@/lib/llm/provider-ids';
import type { ProviderSpec } from '@/lib/llm/providers';
import { generateWithFailover, type RouterDeps } from '@/lib/llm/router';
import { SIGN_SLUGS, getSign, type SignSlug } from '@/lib/zodiac/signs';
import { horoscopeBatchSchema, horoscopeSingleSchema } from './horoscope-schema';
import { HOROSCOPE_PROMPT_VERSION, buildHoroscopeBatchPrompt, buildHoroscopeSignPrompt, type HoroscopePromptInput } from './horoscope-prompt';
import { batchIssues, checkHoroscopeBatch, checkSingleSign, type HoroscopeEntry, type QualityIssue } from './quality';
import { createPostVersion, getCurrentPost, getRecentHeadlines, saveReadings, type NewReading } from './repository';
import { finishRun, getProviderUsage, logLlmCall, startRun } from './runs';
import { AUDIENCES, type Audience, type RunTrigger } from './types';

export const TEMPLATE_VERSION = 'pastel@1';
// Rotalar maxDuration = 300 s ile çalışır; kayıt ve finishRun için pay bırakılır.
const DEFAULT_BUDGET_MS = 240_000;

export type GenerationDeps = {
  db: Db;
  chain: readonly ProviderSpec[];
  baseHashtags: readonly string[];
  spreadLoad?: boolean;
  now?: () => Date;
  timeoutMs?: number;
  budgetMs?: number;
};

export type SetResult = { status: 'created'; postId: string; providers: ProviderId[] } | { status: 'skipped' } | { status: 'busy' };

type Source = { providerId: ProviderId; model: string };

function clock(deps: GenerationDeps): () => Date {
  return deps.now ?? (() => new Date());
}

export function rotateChain<T>(chain: readonly T[], offset: number): T[] {
  if (chain.length === 0) return [];
  const start = offset % chain.length;
  return [...chain.slice(start), ...chain.slice(0, start)];
}

function routerFor(deps: GenerationDeps, runId: string, deadline: number, chain: readonly ProviderSpec[] = deps.chain): RouterDeps {
  const now = clock(deps);
  return {
    chain,
    deadline,
    usage: (id) => getProviderUsage(deps.db, id, now()),
    onAttempt: (log) => logLlmCall(deps.db, runId, log, now()),
    now,
    timeoutMs: deps.timeoutMs,
  };
}

function toNewReading(entry: HoroscopeEntry, source: Source, runId: string): NewReading {
  return {
    sign: entry.sign,
    headline: entry.headline,
    body: entry.body,
    short: entry.short,
    meta: { scores: entry.scores, luckyColor: entry.luckyColor, luckyNumber: entry.luckyNumber },
    provider: source.providerId,
    model: source.model,
    promptVersion: HOROSCOPE_PROMPT_VERSION,
    runId,
  };
}

async function generateSign(router: RouterDeps, promptInput: HoroscopePromptInput, sign: SignSlug, issues: QualityIssue[]) {
  const result = await generateWithFailover(router, {
    schema: horoscopeSingleSchema,
    ...buildHoroscopeSignPrompt({ ...promptInput, sign, issues }),
    validate: (value) => checkSingleSign(value, sign).issues,
  });
  const { entry } = checkSingleSign(result.value, sign);
  if (!entry) throw new Error(`${getSign(sign).name} için kabul edilen yanıt doğrulanamadı`);
  return { entry, source: { providerId: result.providerId, model: result.model } };
}

async function withRun<T>(deps: GenerationDeps, runId: string, work: () => Promise<T>): Promise<T> {
  const now = clock(deps);
  try {
    const value = await work();
    await finishRun(deps.db, runId, { status: 'succeeded' }, now());
    return value;
  } catch (error) {
    await finishRun(deps.db, runId, { status: 'failed', error: error instanceof Error ? error.message : String(error) }, now());
    throw error;
  }
}

export async function generateHoroscopeSet(
  deps: GenerationDeps,
  input: { date: DateKey; audience: Audience; trigger: RunTrigger; skipIfExists: boolean },
): Promise<SetResult> {
  const deadline = Date.now() + (deps.budgetMs ?? DEFAULT_BUDGET_MS);
  const key = { date: input.date, kind: 'horoscope' as const, audience: input.audience };
  if (input.skipIfExists && (await getCurrentPost(deps.db, key))) return { status: 'skipped' };
  const run = await startRun(deps.db, { ...key, trigger: input.trigger }, clock(deps)());
  if (!run) return { status: 'busy' };

  return withRun(deps, run.id, async () => {
    const chain = deps.spreadLoad ? rotateChain(deps.chain, AUDIENCES.indexOf(input.audience)) : deps.chain;
    const router = routerFor(deps, run.id, deadline, chain);
    const promptInput: HoroscopePromptInput = {
      dateKey: input.date,
      audience: input.audience,
      sky: getSkySnapshot(input.date),
      recent: await getRecentHeadlines(deps.db, key, input.date, 2),
    };
    const batch = await generateWithFailover(router, {
      schema: horoscopeBatchSchema,
      ...buildHoroscopeBatchPrompt(promptInput),
      validate: (value) => batchIssues(checkHoroscopeBatch(value, deps.baseHashtags)),
    });
    const check = checkHoroscopeBatch(batch.value, deps.baseHashtags);
    const post = check.post;
    if (!post) throw new Error('Kabul edilen yanıtta gönderi alanları eksik');

    const sources = new Map<SignSlug, Source>();
    for (const sign of check.entries.keys()) sources.set(sign, { providerId: batch.providerId, model: batch.model });
    const retried = await Promise.all(check.failedSigns.map((failed) => generateSign(router, promptInput, failed.sign, failed.issues)));
    for (const { entry, source } of retried) {
      check.entries.set(entry.sign, entry);
      sources.set(entry.sign, source);
    }

    const created = await deps.db.transaction(async (tx) => {
      const rows = await saveReadings(
        tx,
        key,
        SIGN_SLUGS.map((sign) => toNewReading(check.entries.get(sign) as HoroscopeEntry, sources.get(sign) as Source, run.id)),
      );
      return createPostVersion(tx, {
        ...key,
        templateVersion: TEMPLATE_VERSION,
        format: '4x5',
        cover: { hook: post.coverHook },
        caption: post.caption,
        hashtags: post.hashtags,
        signReadingIds: rows.map((row) => row.id),
      });
    });
    return {
      status: 'created' as const,
      postId: created.id,
      providers: [...new Set([...sources.values()].map((source) => source.providerId))],
    };
  });
}

export async function regenerateSign(
  deps: GenerationDeps,
  input: { date: DateKey; audience: Audience; sign: SignSlug },
): Promise<SetResult | { status: 'missing' }> {
  const deadline = Date.now() + (deps.budgetMs ?? DEFAULT_BUDGET_MS);
  const key = { date: input.date, kind: 'horoscope' as const, audience: input.audience };
  const current = await getCurrentPost(deps.db, key);
  if (!current) return { status: 'missing' };
  const run = await startRun(deps.db, { ...key, sign: input.sign, trigger: 'regenerate' }, clock(deps)());
  if (!run) return { status: 'busy' };

  return withRun(deps, run.id, async () => {
    const promptInput: HoroscopePromptInput = {
      dateKey: input.date,
      audience: input.audience,
      sky: getSkySnapshot(input.date),
      recent: await getRecentHeadlines(deps.db, key, input.date, 2),
    };
    const signIndex = SIGN_SLUGS.indexOf(input.sign);
    const signSlides = current.slides.filter((slide) => slide.type === 'sign');
    const { entry, source } = await generateSign(routerFor(deps, run.id, deadline), promptInput, input.sign, [
      { field: 'yorum', message: 'Bu burç için daha önce yazılan metinden tamamen farklı bir açı seç.' },
    ]);
    const created = await deps.db.transaction(async (tx) => {
      const [row] = await saveReadings(tx, key, [toNewReading(entry, source, run.id)]);
      const signReadingIds = signSlides.map((slide, index) => (index === signIndex ? row.id : (slide.readingId as string)));
      return createPostVersion(tx, {
        ...key,
        templateVersion: current.post.templateVersion,
        format: current.post.format,
        cover: current.post.cover,
        caption: current.post.caption,
        hashtags: current.post.hashtags,
        signReadingIds,
      });
    });
    return { status: 'created' as const, postId: created.id, providers: [source.providerId] };
  });
}
