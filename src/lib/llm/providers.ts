import { createGateway } from '@ai-sdk/gateway';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { createMockModel } from './mock-model';
import type { ProviderId } from './provider-ids';

export type ProviderSpec = {
  id: ProviderId;
  label: string;
  model: string;
  dailyCap: number;
  factory: (modelId: string) => LanguageModel;
};
export type ProviderPreference = { id: ProviderId; enabled: boolean; dailyCap?: number; model?: string };
type Env = Record<string, string | undefined>;

function openAICompatible(name: string, baseURL: string, apiKey: string | undefined) {
  // JSON şema desteği bu uçlarda belgelenmemiş: JSON modu + prompt içindeki biçim tarifi kullanılır.
  const provider = createOpenAICompatible({ name, baseURL, apiKey, supportsStructuredOutputs: false });
  return (modelId: string) => provider(modelId);
}

export function availableProviders(env: Env): ProviderSpec[] {
  const specs: ProviderSpec[] = [];
  if (env.VERCEL === '1' || env.AI_GATEWAY_API_KEY) {
    const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY });
    specs.push({ id: 'gateway', label: 'Vercel AI Gateway', model: env.AI_GATEWAY_MODEL ?? 'google/gemini-2.5-flash', dailyCap: 300, factory: (id) => gateway(id) });
  }
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
    specs.push({ id: 'gemini', label: 'Gemini API', model: env.GEMINI_MODEL ?? 'gemini-3.5-flash', dailyCap: 18, factory: (id) => google(id) });
    specs.push({ id: 'gemini-lite', label: 'Gemini API (Lite)', model: env.GEMINI_LITE_MODEL ?? 'gemini-3.5-flash-lite', dailyCap: 450, factory: (id) => google(id) });
  }
  if (env.OLLAMA_API_KEY) {
    specs.push({ id: 'ollama-cloud', label: 'Ollama Cloud', model: env.OLLAMA_CLOUD_MODEL ?? 'gemma4:31b', dailyCap: 100, factory: openAICompatible('ollama-cloud', 'https://ollama.com/v1', env.OLLAMA_API_KEY) });
  }
  if (env.GROQ_API_KEY && env.GROQ_MODEL) {
    specs.push({ id: 'groq', label: 'Groq', model: env.GROQ_MODEL, dailyCap: 500, factory: openAICompatible('groq', 'https://api.groq.com/openai/v1', env.GROQ_API_KEY) });
  }
  if (env.MISTRAL_API_KEY && env.MISTRAL_MODEL) {
    specs.push({ id: 'mistral', label: 'Mistral', model: env.MISTRAL_MODEL, dailyCap: 200, factory: openAICompatible('mistral', 'https://api.mistral.ai/v1', env.MISTRAL_API_KEY) });
  }
  if (env.COHERE_API_KEY && env.COHERE_MODEL) {
    // Ücretsiz deneme anahtarı ayda 1.000 istekle sınırlı.
    specs.push({ id: 'cohere', label: 'Cohere', model: env.COHERE_MODEL, dailyCap: 30, factory: openAICompatible('cohere', 'https://api.cohere.ai/compatibility/v1', env.COHERE_API_KEY) });
  }
  if (env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL) {
    // Ücretsiz modellerin günlük 50 isteklik kotası hesap başınadır; iki model bunu paylaşır.
    const factory = openAICompatible('openrouter', 'https://openrouter.ai/api/v1', env.OPENROUTER_API_KEY);
    specs.push({ id: 'openrouter', label: 'OpenRouter', model: env.OPENROUTER_MODEL, dailyCap: 24, factory });
    if (env.OPENROUTER_MODEL_2) specs.push({ id: 'openrouter-2', label: 'OpenRouter (yedek)', model: env.OPENROUTER_MODEL_2, dailyCap: 24, factory });
  }
  if (env.ORCA_API_KEY && env.ORCA_MODEL) {
    // Ücretsiz modeller günde 50 istekle sınırlı.
    specs.push({ id: 'orca', label: 'OrcaRouter', model: env.ORCA_MODEL, dailyCap: 45, factory: openAICompatible('orca', 'https://api.orcarouter.ai/v1', env.ORCA_API_KEY) });
  }
  if (env.NVIDIA_API_KEY && env.NVIDIA_MODEL) {
    specs.push({ id: 'nvidia', label: 'NVIDIA NIM', model: env.NVIDIA_MODEL, dailyCap: 200, factory: openAICompatible('nvidia', 'https://integrate.api.nvidia.com/v1', env.NVIDIA_API_KEY) });
  }
  if (env.CEREBRAS_API_KEY && env.CEREBRAS_MODEL) {
    specs.push({ id: 'cerebras', label: 'Cerebras', model: env.CEREBRAS_MODEL, dailyCap: 500, factory: openAICompatible('cerebras', 'https://api.cerebras.ai/v1', env.CEREBRAS_API_KEY) });
  }
  if (env.OLLAMA_LOCAL_MODEL) {
    specs.push({ id: 'ollama-local', label: 'Yerel Ollama', model: env.OLLAMA_LOCAL_MODEL, dailyCap: 10_000, factory: openAICompatible('ollama-local', env.OLLAMA_LOCAL_URL ?? 'http://localhost:11434/v1', 'ollama') });
  }
  if (env.LLM_MOCK === '1') {
    specs.push({ id: 'mock', label: 'Sahte model', model: 'mock', dailyCap: 10_000, factory: () => createMockModel() });
  }
  return specs;
}

export function resolveProviderChain(
  preferences: readonly ProviderPreference[],
  available: readonly ProviderSpec[],
  override?: string,
): ProviderSpec[] {
  if (override) {
    const spec = available.find((candidate) => candidate.id === override);
    if (!spec) throw new Error(`LLM_PROVIDER_OVERRIDE=${override} için yapılandırılmış sağlayıcı yok`);
    return [spec];
  }
  const remaining = new Map(available.map((spec) => [spec.id, spec]));
  const chain: ProviderSpec[] = [];
  for (const preference of preferences) {
    const spec = remaining.get(preference.id);
    if (!spec) continue;
    remaining.delete(preference.id);
    if (preference.enabled) {
      chain.push({ ...spec, model: preference.model ?? spec.model, dailyCap: preference.dailyCap ?? spec.dailyCap });
    }
  }
  return [...chain, ...remaining.values()];
}
