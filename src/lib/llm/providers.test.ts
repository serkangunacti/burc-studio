import { describe, expect, it } from 'vitest';
import { availableProviders, resolveProviderChain } from './providers';

const ENV = { VERCEL: '1', GOOGLE_GENERATIVE_AI_API_KEY: 'g', OLLAMA_API_KEY: 'o' };

describe('availableProviders', () => {
  it('anahtar yoksa boş döner', () => {
    expect(availableProviders({})).toEqual([]);
  });

  it('anahtarı olanları varsayılan sıra, model ve tavanlarla döner', () => {
    expect(availableProviders(ENV).map(({ id, model, dailyCap }) => ({ id, model, dailyCap }))).toEqual([
      { id: 'gateway', model: 'google/gemini-2.5-flash', dailyCap: 300 },
      { id: 'gemini', model: 'gemini-3.5-flash', dailyCap: 18 },
      { id: 'gemini-lite', model: 'gemini-3.5-flash-lite', dailyCap: 450 },
      { id: 'ollama-cloud', model: 'gemma4:31b', dailyCap: 100 },
    ]);
  });

  it('opsiyonel sağlayıcılar yalnızca model de verilince eklenir', () => {
    expect(availableProviders({ GROQ_API_KEY: 'x' })).toEqual([]);
    expect(availableProviders({ GROQ_API_KEY: 'x', GROQ_MODEL: 'openai/gpt-oss-120b' }).map((spec) => spec.id)).toEqual(['groq']);
    expect(availableProviders({ LLM_MOCK: '1', OLLAMA_LOCAL_MODEL: 'gemma4:26b' }).map((spec) => spec.id)).toEqual(['ollama-local', 'mock']);
  });

  it("OpenRouter iki ücretsiz modelle, Gemini'nin ardından ve günlük 50 isteklik ortak kotayı bölüşerek eklenir", () => {
    const env = { GOOGLE_GENERATIVE_AI_API_KEY: 'g', OPENROUTER_API_KEY: 'r', OPENROUTER_MODEL: 'a:free', OPENROUTER_MODEL_2: 'b:free' };
    expect(availableProviders(env).map(({ id, model, dailyCap }) => ({ id, model, dailyCap }))).toEqual([
      { id: 'gemini', model: 'gemini-3.5-flash', dailyCap: 18 },
      { id: 'gemini-lite', model: 'gemini-3.5-flash-lite', dailyCap: 450 },
      { id: 'openrouter', model: 'a:free', dailyCap: 24 },
      { id: 'openrouter-2', model: 'b:free', dailyCap: 24 },
    ]);
    expect(availableProviders({ OPENROUTER_API_KEY: 'r', OPENROUTER_MODEL: 'a:free' }).map((spec) => spec.id)).toEqual(['openrouter']);
  });

  it("Mistral ve Cohere Groq'un, OrcaRouter Cohere'in ardından gelir; NVIDIA en sondadır; hepsi yalnızca model verilince eklenir", () => {
    const env = {
      GROQ_API_KEY: 'g', GROQ_MODEL: 'qwen/qwen3.8-27b',
      MISTRAL_API_KEY: 'm', MISTRAL_MODEL: 'mistral-medium-latest',
      COHERE_API_KEY: 'c', COHERE_MODEL: 'command-a-03-2025',
      OPENROUTER_API_KEY: 'r', OPENROUTER_MODEL: 'a:free',
      ORCA_API_KEY: 'o', ORCA_MODEL: 'orcarouter/free',
      NVIDIA_API_KEY: 'n', NVIDIA_MODEL: 'deepseek-ai/deepseek-v4.1-flash',
    };
    expect(availableProviders(env).map(({ id, model, dailyCap }) => ({ id, model, dailyCap }))).toEqual([
      { id: 'groq', model: 'qwen/qwen3.8-27b', dailyCap: 500 },
      { id: 'mistral', model: 'mistral-medium-latest', dailyCap: 200 },
      { id: 'cohere', model: 'command-a-03-2025', dailyCap: 30 },
      { id: 'orca', model: 'orcarouter/free', dailyCap: 45 },
      { id: 'openrouter', model: 'a:free', dailyCap: 24 },
      { id: 'nvidia', model: 'deepseek-ai/deepseek-v4.1-flash', dailyCap: 200 },
    ]);
    expect(availableProviders({ MISTRAL_API_KEY: 'm', COHERE_API_KEY: 'c', NVIDIA_API_KEY: 'n', ORCA_API_KEY: 'o' })).toEqual([]);
  });

  it('fabrika istenen model kimliğiyle model üretir', () => {
    const [gemini] = availableProviders({ GOOGLE_GENERATIVE_AI_API_KEY: 'g' });
    expect((gemini.factory('gemini-3.8-flash') as { modelId: string }).modelId).toBe('gemini-3.8-flash');
  });
});

describe('resolveProviderChain', () => {
  const available = availableProviders(ENV);

  it('tercih sırasını uygular, kapalıları çıkarır, kalanları varsayılan sırayla ekler', () => {
    const chain = resolveProviderChain(
      [
        { id: 'gemini-lite', enabled: true, dailyCap: 100, model: 'gemini-3.1-flash-lite' },
        { id: 'gateway', enabled: false },
      ],
      available,
    );
    expect(chain.map(({ id, model, dailyCap }) => ({ id, model, dailyCap }))).toEqual([
      { id: 'gemini-lite', model: 'gemini-3.1-flash-lite', dailyCap: 100 },
      { id: 'gemini', model: 'gemini-3.5-flash', dailyCap: 18 },
      { id: 'ollama-cloud', model: 'gemma4:31b', dailyCap: 100 },
    ]);
  });

  it('override yalnızca o sağlayıcıyı döner, yapılandırılmamışsa fırlatır', () => {
    expect(resolveProviderChain([], availableProviders({ LLM_MOCK: '1' }), 'mock').map((spec) => spec.id)).toEqual(['mock']);
    expect(() => resolveProviderChain([], available, 'mock')).toThrow('LLM_PROVIDER_OVERRIDE=mock');
  });
});
