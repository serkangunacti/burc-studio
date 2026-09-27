import { z } from 'zod';
import type { PostFormat } from '@/db/schema';
import { PROVIDER_IDS } from '@/lib/llm/provider-ids';

export const WATERMARK_POSITIONS = ['bottom-center', 'bottom-right'] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];

const HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/;
export const HANDLE_ERROR = 'Kullanıcı adı yalnızca harf, rakam, nokta ve alt çizgi içerebilir (en fazla 30 karakter).';

export const planItemSchema = z.object({ kind: z.enum(['horoscope', 'tarot']), audience: z.enum(['kadin', 'erkek']) });
export type PlanItem = z.infer<typeof planItemSchema>;

export const providerPreferenceSchema = z.object({
  id: z.enum(PROVIDER_IDS),
  enabled: z.boolean(),
  dailyCap: z.number().int().positive().optional(),
  model: z.string().min(1).optional(),
});

export const settingsSchema = z.object({
  instagramHandle: z.string().regex(HANDLE_PATTERN, HANDLE_ERROR).nullable(),
  watermark: z.object({
    enabled: z.boolean(),
    position: z.enum(WATERMARK_POSITIONS),
    opacity: z.number().min(0.2).max(1),
  }),
  cronEnabled: z.boolean(),
  dailyPlan: z.array(planItemSchema).min(1),
  baseHashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u)).max(2),
  providerChain: z.array(providerPreferenceSchema),
  spreadLoad: z.boolean(),
  defaultFormat: z.enum(['4x5', '3x4']),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsPatch = {
  instagramHandle?: string | null;
  watermark?: Partial<Settings['watermark']>;
  cronEnabled?: boolean;
  dailyPlan?: PlanItem[];
  baseHashtags?: string[];
  providerChain?: Settings['providerChain'];
  spreadLoad?: boolean;
  defaultFormat?: PostFormat;
};

export const DEFAULT_SETTINGS: Settings = {
  instagramHandle: null,
  watermark: { enabled: true, position: 'bottom-center', opacity: 0.55 },
  cronEnabled: true,
  dailyPlan: [
    { kind: 'horoscope', audience: 'kadin' },
    { kind: 'horoscope', audience: 'erkek' },
    { kind: 'tarot', audience: 'kadin' },
    { kind: 'tarot', audience: 'erkek' },
  ],
  baseHashtags: ['#burç', '#astroloji'],
  providerChain: [],
  spreadLoad: false,
  defaultFormat: '4x5',
};

export function normalizeInstagramHandle(input: string): string {
  let value = input.trim();
  const fromUrl = value.match(/instagram\.com\/([^/?#\s]+)/i);
  if (fromUrl) value = fromUrl[1];
  return value.replace(/^@+/, '').toLowerCase();
}

export function parseInstagramHandleInput(
  input: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = normalizeInstagramHandle(input);
  if (value === '') return { ok: true, value: null };
  return HANDLE_PATTERN.test(value) ? { ok: true, value } : { ok: false, error: HANDLE_ERROR };
}

export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  return settingsSchema.parse({
    ...base,
    ...patch,
    watermark: { ...base.watermark, ...patch.watermark },
  });
}

export function parseStoredSettings(raw: unknown): Settings {
  const stored = (typeof raw === 'object' && raw !== null ? raw : {}) as SettingsPatch;
  return mergeSettings(DEFAULT_SETTINGS, stored);
}
