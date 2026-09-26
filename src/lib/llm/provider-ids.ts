export const PROVIDER_IDS = ['gateway', 'gemini', 'gemini-lite', 'ollama-cloud', 'groq', 'mistral', 'cohere', 'openrouter', 'openrouter-2', 'nvidia', 'cerebras', 'ollama-local', 'mock'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
