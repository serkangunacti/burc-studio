import type { PostFormat } from '@/db/schema';
import type { Db } from '@/db/types';
import type { DateKey } from '@/lib/date/istanbul';
import type { ProviderId } from '@/lib/llm/provider-ids';
import type { ProviderSpec } from '@/lib/llm/providers';
import { generateWithFailover, type RouterDeps } from '@/lib/llm/router';
import { SIGN_SLUGS, getSign, type SignSlug } from '@/lib/zodiac/signs';
import { horoscopeBatchSchema, horoscopeSingleSchema } from './horoscope-schema';
import { specFor, type GeneratedKind, type SpecContext } from './generation-spec';
import {
  batchIssues,
  checkHoroscopeBatch,
  checkSingleSign,
  type EntryLimits,
  type HoroscopeEntry,
  type HoroscopePostFields,
  type QualityIssue,
} from './quality';
import { createPostVersion, getCurrentPost, getCurrentReadings, getRecentHeadlines, saveReadings, type NewReading } from './repository';
import { finishRun, getProviderUsage, logLlmCall, startRun } from './runs';
import { AUDIENCES, type Audience, type RunTrigger } from './types';

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
  format?: PostFormat;
};

export type SetResult = { status: 'created'; postId: string; providers: ProviderId[] } | { status: 'skipped' } | { status: 'busy' };

type Source = { providerId: ProviderId; model: string };

function clock(deps: GenerationDeps): () => Date {
  return deps.now ?? (() => new Date());
}

// Ücretsiz sağlayıcıların dakikalık sınırları ani toplu isteklerle dolar; tek burç yeniden istemleri sınırlı eşzamanlılıkla gider.
const RETRY_CONCURRENCY = 3;

async function mapLimited<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]);
      }
    }),
  );
  return results;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
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

function toNewReading(entry: HoroscopeEntry, source: Source, runId: string, promptVersion: string, tarotCardId?: string): NewReading {
  return {
    sign: entry.sign,
    headline: entry.headline,
    body: entry.body,
    short: entry.short,
    meta: { scores: entry.scores, luckyColor: entry.luckyColor, luckyNumber: entry.luckyNumber, ...(tarotCardId ? { tarotCardId } : {}) },
    provider: source.providerId,
    model: source.model,
    promptVersion,
    runId,
  };
}

async function generateSign(router: RouterDeps, context: SpecContext, sign: SignSlug, issues: QualityIssue[], limits: EntryLimits) {
  const result = await generateWithFailover(router, {
    schema: horoscopeSingleSchema,
    ...context.signPrompt(sign, issues),
    validate: (value) => checkSingleSign(value, sign, limits, context.forbidden).issues,
  });
  const { entry } = checkSingleSign(result.value, sign, limits, context.forbidden);
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
  input: { date: DateKey; audience: Audience; trigger: RunTrigger; skipIfExists: boolean; kind?: GeneratedKind },
): Promise<SetResult> {
  const spec = specFor(input.kind ?? 'horoscope');
  if (!spec.validDate(input.date)) throw new Error('Haftalık yorum yalnızca pazartesi üretilir');
  const deadline = Date.now() + (deps.budgetMs ?? DEFAULT_BUDGET_MS);
  const key = { date: input.date, kind: spec.kind, audience: input.audience };
  if (input.skipIfExists && (await getCurrentPost(deps.db, key))) return { status: 'skipped' };
  const run = await startRun(deps.db, { ...key, trigger: input.trigger }, clock(deps)());
  if (!run) return { status: 'busy' };

  return withRun(deps, run.id, async () => {
    const chain = deps.spreadLoad ? rotateChain(deps.chain, AUDIENCES.indexOf(input.audience)) : deps.chain;
    const router = routerFor(deps, run.id, deadline, chain);
    const context = spec.context({
      date: input.date,
      audience: input.audience,
      recent: await getRecentHeadlines(deps.db, key, input.date, spec.recentDays),
    });
    const entries = new Map<SignSlug, HoroscopeEntry>();
    const sources = new Map<SignSlug, Source>();
    const failedSigns: { sign: SignSlug; issues: QualityIssue[] }[] = [];
    let post: HoroscopePostFields | null = null;
    // Parçalar sırayla istenir: ücretsiz sağlayıcıların dakikalık token sınırı paralel isteklerle hemen dolar.
    const chunked = spec.chunkSize < SIGN_SLUGS.length;
    for (const [index, signs] of chunk(SIGN_SLUGS, spec.chunkSize).entries()) {
      const batch = await generateWithFailover(router, {
        schema: horoscopeBatchSchema,
        ...context.batchPrompt(signs),
        // Parçalı üretimde kurala uymayan burçlar parçayı düşürmez; tek burç istemiyle geri bildirimli olarak düzeltilir.
        validate: (value) =>
          batchIssues(checkHoroscopeBatch(value, deps.baseHashtags, spec.limits, context.forbidden, signs), index === 0, chunked ? signs.length : undefined),
      });
      const check = checkHoroscopeBatch(batch.value, deps.baseHashtags, spec.limits, context.forbidden, signs);
      if (index === 0) {
        post = check.post;
        if (!post) throw new Error('Kabul edilen yanıtta gönderi alanları eksik');
      }
      for (const [sign, entry] of check.entries) {
        entries.set(sign, entry);
        sources.set(sign, { providerId: batch.providerId, model: batch.model });
      }
      failedSigns.push(...check.failedSigns);
    }
    if (!post) throw new Error('Kabul edilen yanıtta gönderi alanları eksik');
    const retried = await mapLimited(failedSigns, RETRY_CONCURRENCY, (failed) => generateSign(router, context, failed.sign, failed.issues, spec.limits));
    for (const { entry, source } of retried) {
      entries.set(entry.sign, entry);
      sources.set(entry.sign, source);
    }

    const created = await deps.db.transaction(async (tx) => {
      const rows = await saveReadings(
        tx,
        key,
        SIGN_SLUGS.map((sign) =>
          toNewReading(entries.get(sign) as HoroscopeEntry, sources.get(sign) as Source, run.id, spec.promptVersion, context.tarotCardId(sign)),
        ),
      );
      return createPostVersion(tx, {
        ...key,
        templateVersion: spec.templateVersion,
        format: deps.format ?? '4x5',
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
  input: { date: DateKey; audience: Audience; sign: SignSlug; kind?: GeneratedKind; redrawCard?: boolean },
): Promise<SetResult | { status: 'missing' }> {
  const spec = specFor(input.kind ?? 'horoscope');
  const deadline = Date.now() + (deps.budgetMs ?? DEFAULT_BUDGET_MS);
  const key = { date: input.date, kind: spec.kind, audience: input.audience };
  const current = await getCurrentPost(deps.db, key);
  if (!current) return { status: 'missing' };
  const run = await startRun(deps.db, { ...key, sign: input.sign, trigger: 'regenerate' }, clock(deps)());
  if (!run) return { status: 'busy' };

  return withRun(deps, run.id, async () => {
    const cardBySign = new Map((await getCurrentReadings(deps.db, key)).flatMap((row) => (row.meta.tarotCardId ? [[row.sign, row.meta.tarotCardId] as const] : [])));
    // Kart yeniden çekilecekse hedef burcun kartı bırakılır; yenisi diğer 11 kartın ve eski kartın dışından çekilir.
    const oldCard = input.redrawCard ? cardBySign.get(input.sign) : undefined;
    const keptCards = new Map([...cardBySign].filter(([sign]) => !(input.redrawCard && sign === input.sign)));
    const context = spec.context({
      date: input.date,
      audience: input.audience,
      recent: await getRecentHeadlines(deps.db, key, input.date, spec.recentDays),
      keptCards,
      avoidCards: oldCard ? new Set([oldCard]) : undefined,
    });
    const signIndex = SIGN_SLUGS.indexOf(input.sign);
    const signSlides = current.slides.filter((slide) => slide.type === 'sign');
    const { entry, source } = await generateSign(
      routerFor(deps, run.id, deadline),
      context,
      input.sign,
      [{ field: 'yorum', message: 'Bu burç için daha önce yazılan metinden tamamen farklı bir açı seç.' }],
      spec.limits,
    );
    const created = await deps.db.transaction(async (tx) => {
      const [row] = await saveReadings(tx, key, [toNewReading(entry, source, run.id, spec.promptVersion, context.tarotCardId(input.sign))]);
      const signReadingIds = signSlides.map((slide, index) => (index === signIndex ? row.id : (slide.readingId as string)));
      return createPostVersion(tx, {
        ...key,
        templateVersion: current.post.templateVersion,
        format: current.post.format,
        cover: current.post.cover,
        caption: current.post.caption,
        hashtags: current.post.hashtags,
        signReadingIds,
        basePostId: current.post.id,
      });
    });
    return { status: 'created' as const, postId: created.id, providers: [source.providerId] };
  });
}
