import type { DateKey } from '@/lib/date/istanbul';
import { AllProvidersFailedError } from '@/lib/llm/router';
import type { PlanItem } from '@/lib/settings/schema';
import { generateHoroscopeSet, type GenerationDeps, type SetResult } from './horoscope-service';
import type { RunTrigger } from './types';

export type PackageItemResult = { item: PlanItem; result: SetResult } | { item: PlanItem; error: string };

export function describeGenerationError(error: unknown): string {
  if (error instanceof AllProvidersFailedError) {
    return `${error.message} ${error.attempts.map((attempt) => `${attempt.providerId}: ${attempt.status}`).join(', ')}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export async function generateDailyPackage(
  deps: GenerationDeps,
  input: { date: DateKey; items: readonly PlanItem[]; trigger: RunTrigger; skipIfExists: boolean },
): Promise<PackageItemResult[]> {
  const settled = await Promise.allSettled(
    input.items.map((item) =>
      generateHoroscopeSet(deps, { date: input.date, audience: item.audience, trigger: input.trigger, skipIfExists: input.skipIfExists }),
    ),
  );
  return settled.map((outcome, index) =>
    outcome.status === 'fulfilled'
      ? { item: input.items[index], result: outcome.value }
      : { item: input.items[index], error: describeGenerationError(outcome.reason) },
  );
}
