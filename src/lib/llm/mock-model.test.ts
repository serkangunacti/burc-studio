import { generateObject } from 'ai';
import { describe, expect, it } from 'vitest';
import { horoscopeBatchSchema, horoscopeSingleSchema } from '@/lib/content/horoscope-schema';
import { WEEKLY_LIMITS, checkHoroscopeBatch, checkSingleSign } from '@/lib/content/quality';
import { createMockModel } from './mock-model';

describe('createMockModel', () => {
  it('paket istemine kalite kapısından geçen 12 burç döner', async () => {
    const { object } = await generateObject({ model: createMockModel(), schema: horoscopeBatchSchema, prompt: 'Her burç için yaz', maxRetries: 0 });
    const check = checkHoroscopeBatch(object, ['#burç']);
    expect(check.entries.size).toBe(12);
    expect(check.postIssues).toEqual([]);
  });

  it('tek burç istemine o burcu döner', async () => {
    const { object } = await generateObject({
      model: createMockModel(),
      schema: horoscopeSingleSchema,
      prompt: 'Yalnızca şu burç için yaz: Aslan (aslan), 23 Temmuz – 22 Ağustos',
      maxRetries: 0,
    });
    expect(checkSingleSign(object, 'aslan').entry?.sign).toBe('aslan');
  });

  it('haftalık istemde uzun haftalık yorumlar döner', async () => {
    const { object } = await generateObject({ model: createMockModel(), schema: horoscopeBatchSchema, prompt: 'HAFTALIK YORUM — her burç için yaz', maxRetries: 0 });
    expect(checkHoroscopeBatch(object, ['#burç'], WEEKLY_LIMITS).entries.size).toBe(12);
    const single = await generateObject({
      model: createMockModel(),
      schema: horoscopeSingleSchema,
      prompt: 'HAFTALIK YORUM\nYalnızca şu burç için yaz: Aslan (aslan)',
      maxRetries: 0,
    });
    expect(checkSingleSign(single.object, 'aslan', WEEKLY_LIMITS).entry?.sign).toBe('aslan');
  });
});
