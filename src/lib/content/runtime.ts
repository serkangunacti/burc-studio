import type { Db } from '@/db/types';
import { availableProviders, resolveProviderChain } from '@/lib/llm/providers';
import { getSettings } from '@/lib/settings/repository';
import type { Settings } from '@/lib/settings/schema';
import type { GenerationDeps } from './horoscope-service';

export async function loadGenerationDeps(db: Db): Promise<GenerationDeps & { settings: Settings }> {
  const settings = await getSettings(db);
  const chain = resolveProviderChain(settings.providerChain, availableProviders(process.env), process.env.LLM_PROVIDER_OVERRIDE);
  return { db, chain, baseHashtags: settings.baseHashtags, spreadLoad: settings.spreadLoad, format: settings.defaultFormat, settings };
}
