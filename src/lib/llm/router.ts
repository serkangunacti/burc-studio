import { NoObjectGeneratedError, generateObject } from 'ai';
import type { z } from 'zod';
import type { QualityIssue } from '@/lib/content/quality';
import type { ProviderId } from './provider-ids';
import type { ProviderSpec } from './providers';

export type AttemptStatus =
  | 'ok'
  | 'rate_limited'
  | 'auth_error'
  | 'client_error'
  | 'server_error'
  | 'timeout'
  | 'invalid_output'
  | 'skipped_cap'
  | 'skipped_cooldown';

export type AttemptLog = {
  providerId: ProviderId;
  model: string;
  status: AttemptStatus;
  httpStatus: number | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
};

export type ProviderUsage = { callsToday: number; lastRateLimitedAt: Date | null };

export type RouterDeps = {
  chain: readonly ProviderSpec[];
  usage: (id: ProviderId) => Promise<ProviderUsage>;
  onAttempt: (log: AttemptLog) => Promise<void>;
  now?: () => Date;
  timeoutMs?: number;
  deadline?: number;
};

export type StructuredRequest<T> = {
  schema: z.ZodType<T>;
  instructions: string;
  prompt: string;
  validate: (value: T) => QualityIssue[];
};

export type RouterResult<T> = { value: T; providerId: ProviderId; model: string };

export const RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 120_000;
const ATTEMPTS_PER_PROVIDER = 2;

export class NoProvidersConfiguredError extends Error {
  constructor() {
    super('Hiçbir LLM sağlayıcısı yapılandırılmamış.');
    this.name = 'NoProvidersConfiguredError';
  }
}

export class AllProvidersFailedError extends Error {
  readonly attempts: AttemptLog[];

  constructor(attempts: AttemptLog[]) {
    super(`Tüm sağlayıcılar başarısız oldu (${attempts.length} deneme).`);
    this.name = 'AllProvidersFailedError';
    this.attempts = attempts;
  }
}

function classify(error: unknown): { status: AttemptStatus; httpStatus: number | null } {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return { status: 'timeout', httpStatus: null };
  if (NoObjectGeneratedError.isInstance(error)) return { status: 'invalid_output', httpStatus: null };
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  const httpStatus = typeof statusCode === 'number' ? statusCode : null;
  if (httpStatus === 429) return { status: 'rate_limited', httpStatus };
  if (httpStatus === 401 || httpStatus === 403) return { status: 'auth_error', httpStatus };
  if (httpStatus !== null && httpStatus >= 400 && httpStatus < 500) return { status: 'client_error', httpStatus };
  return { status: 'server_error', httpStatus };
}

const MOVE_ON_IMMEDIATELY: AttemptStatus[] = ['rate_limited', 'auth_error', 'client_error'];

function describeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

function describeIssues(issues: QualityIssue[]): string {
  return issues.slice(0, 5).map((issue) => `${issue.field}: ${issue.message}`).join('; ');
}

export async function generateWithFailover<T>(deps: RouterDeps, request: StructuredRequest<T>): Promise<RouterResult<T>> {
  if (deps.chain.length === 0) throw new NoProvidersConfiguredError();
  const now = deps.now ?? (() => new Date());
  const attempts: AttemptLog[] = [];
  const record = async (log: AttemptLog) => {
    attempts.push(log);
    await deps.onAttempt(log);
  };

  for (const spec of deps.chain) {
    const base = { providerId: spec.id, model: spec.model, httpStatus: null, inputTokens: null, outputTokens: null, latencyMs: 0 };
    const usage = await deps.usage(spec.id);
    if (usage.callsToday >= spec.dailyCap) {
      await record({ ...base, status: 'skipped_cap', error: `Günlük tavan dolu (${spec.dailyCap}).` });
      continue;
    }
    if (usage.lastRateLimitedAt && now().getTime() - usage.lastRateLimitedAt.getTime() < RATE_LIMIT_COOLDOWN_MS) {
      await record({ ...base, status: 'skipped_cooldown', error: 'Son bir saatte hız sınırına takıldı.' });
      continue;
    }

    for (let attempt = 1; attempt <= ATTEMPTS_PER_PROVIDER; attempt++) {
      const remaining = (deps.deadline ?? Infinity) - Date.now();
      if (remaining <= 0) throw new AllProvidersFailedError(attempts);
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new DOMException('Zaman aşımı', 'TimeoutError')),
        Math.min(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS, remaining),
      );
      try {
        const result = await generateObject({
          model: spec.factory(spec.model),
          schema: request.schema,
          instructions: request.instructions,
          prompt: request.prompt,
          maxRetries: 0,
          abortSignal: controller.signal,
        });
        const issues = request.validate(result.object);
        const measured = {
          ...base,
          latencyMs: Date.now() - started,
          inputTokens: result.usage.inputTokens ?? null,
          outputTokens: result.usage.outputTokens ?? null,
        };
        if (issues.length === 0) {
          await record({ ...measured, status: 'ok', error: null });
          return { value: result.object, providerId: spec.id, model: spec.model };
        }
        await record({ ...measured, status: 'invalid_output', error: describeIssues(issues) });
      } catch (error) {
        const { status, httpStatus } = classify(error);
        await record({ ...base, status, httpStatus, error: describeError(error), latencyMs: Date.now() - started });
        if (MOVE_ON_IMMEDIATELY.includes(status)) break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw new AllProvidersFailedError(attempts);
}
