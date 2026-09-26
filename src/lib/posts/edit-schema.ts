import { z } from 'zod';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';

export const EDIT_LIMITS = { coverHook: 60, caption: 700, headline: 40, body: 420, short: 140 } as const;

export const postEditSchema = z.object({
  format: z.enum(['4x5', '3x4']).optional(),
  coverHook: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).max(20).optional(),
  signs: z
    .array(z.object({ sign: z.enum(SIGN_SLUGS), headline: z.string(), body: z.string(), short: z.string() }))
    .max(12)
    .optional(),
});

export type PostEdit = z.infer<typeof postEditSchema>;
