export const PROVIDER_IDS = ['gateway', 'gemini', 'gemini-lite', 'ollama-cloud', 'groq', 'openrouter', 'openrouter-2', 'cerebras', 'ollama-local', 'mock'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
