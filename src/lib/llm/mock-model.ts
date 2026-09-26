import { MockLanguageModelV4 } from 'ai/test';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';
import { mockHoroscopeBatch, mockHoroscopeEntry, mockWeeklyBatch, mockWeeklyEntry } from './mock-content';

const SINGLE_SIGN = /Yalnızca şu burç için yaz: [^()"]*\(([a-z]+)\)/;

export function createMockModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'mock',
    doGenerate: async ({ prompt }) => {
      const text = JSON.stringify(prompt);
      const weekly = text.includes('HAFTALIK YORUM');
      const slug = text.match(SINGLE_SIGN)?.[1];
      const payload =
        slug && (SIGN_SLUGS as readonly string[]).includes(slug)
          ? { burc: (weekly ? mockWeeklyEntry : mockHoroscopeEntry)(slug as SignSlug) }
          : weekly
            ? mockWeeklyBatch()
            : mockHoroscopeBatch();
      return {
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 0, text: 0, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}
