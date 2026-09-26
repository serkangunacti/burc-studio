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
