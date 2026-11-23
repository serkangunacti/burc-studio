import type { DateKey } from '@/lib/date/istanbul';
import { AllProvidersFailedError } from '@/lib/llm/router';
import type { PlanItem } from '@/lib/settings/schema';
import type { GeneratedKind } from './generation-spec';
import { generateHoroscopeSet, type GenerationDeps, type SetResult } from './horoscope-service';
import type { Audience, RunTrigger } from './types';

export type PackageItem = { kind: GeneratedKind; audience: Audience };
export type PackageItemResult = { item: PackageItem; result: SetResult } | { item: PackageItem; error: string };

// Haftalık (weekly) üretim ve Pazartesi özel yayınları kaldırıldı; tüm günler yalnızca plandaki günlük kalemler üretilir.
export function packageItemsFor(_date: DateKey, plan: readonly PlanItem[]): PackageItem[] {
  return plan.map((item): PackageItem => ({ kind: item.kind, audience: item.audience }));
}

export function describeGenerationError(error: unknown): string {
  if (error instanceof AllProvidersFailedError) {
    return `${error.message} ${error.attempts.map((attempt) => `${attempt.providerId}: ${attempt.status}`).join(', ')}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export async function generateDailyPackage(
  deps: GenerationDeps,
  input: { date: DateKey; items: readonly PackageItem[]; trigger: RunTrigger; skipIfExists: boolean },
): Promise<PackageItemResult[]> {
  const settled = await Promise.allSettled(
    input.items.map((item) =>
      generateHoroscopeSet(deps, {
        date: input.date,
        audience: item.audience,
        trigger: input.trigger,
        skipIfExists: input.skipIfExists,
        kind: item.kind,
      }),
    ),
  );
  return settled.map((outcome, index) =>
    outcome.status === 'fulfilled'
      ? { item: input.items[index], result: outcome.value }
      : { item: input.items[index], error: describeGenerationError(outcome.reason) },
  );
}
