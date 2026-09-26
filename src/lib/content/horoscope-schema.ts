import { z } from 'zod';

export const horoscopeEntrySchema = z.object({
  burc: z.string(),
  baslik: z.string(),
  yorum: z.string(),
  kisa: z.string(),
  puanlar: z.object({ ask: z.number(), para: z.number(), saglik: z.number() }),
  sansliRenk: z.string(),
  sansliSayi: z.number(),
});

export const horoscopeBatchSchema = z.object({
  kapakKanca: z.string(),
  caption: z.string(),
  hashtagler: z.array(z.string()),
  burclar: z.array(horoscopeEntrySchema),
});

export const horoscopeSingleSchema = z.object({ burc: horoscopeEntrySchema });

export type HoroscopeEntryRaw = z.infer<typeof horoscopeEntrySchema>;
export type HoroscopeBatchRaw = z.infer<typeof horoscopeBatchSchema>;
export type HoroscopeSingleRaw = z.infer<typeof horoscopeSingleSchema>;
