export const PROVIDER_IDS = ['gateway', 'gemini', 'gemini-lite', 'ollama-cloud', 'groq', 'openrouter', 'cerebras', 'ollama-local', 'mock'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
