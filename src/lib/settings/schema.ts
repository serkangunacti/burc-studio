import { z } from 'zod';
import type { PostFormat } from '@/db/schema';
import { PROVIDER_IDS } from '@/lib/llm/provider-ids';
import { isDateKey } from '@/lib/date/istanbul';

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

const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:DD biçiminde olmalı.');
const slotSchema = z.object({ carousel: clockSchema, reels: clockSchema });
const audienceSlotsSchema = z.object({ kadin: slotSchema, erkek: slotSchema });

export const AUTOMATION_KINDS = ['horoscope', 'tarot', 'weekly'] as const;
export type AutomationKind = (typeof AUTOMATION_KINDS)[number];

export const automationSchema = z.object({
  enabled: z.boolean(),
  // Bu TSİ gününün 00:00 anından önce otomasyon çalışmaz; eski günler sonradan da başlamaz.
  startDate: z.string().refine(isDateKey, 'Geçerli bir başlangıç tarihi gerekli.').nullable(),
  telegramChatId: z.number().int().nullable(),
  // TSİ saatleri; haftalık satırı yalnız pazartesi kullanılır.
  schedule: z.object({ horoscope: audienceSlotsSchema, tarot: audienceSlotsSchema, weekly: audienceSlotsSchema }),
  partGapMinutes: z.number().int().min(1).max(30),
  // Bu saate (TSİ) kadar başlayamayan paylaşım o gün yapılmaz.
  cutoffTime: clockSchema,
  // TikTok'a (Buffer üzerinden) yalnız Reels videoları, Reels saatinde paylaşılır.
  tiktok: z.object({ enabled: z.boolean() }),
});
export type AutomationSettings = z.infer<typeof automationSchema>;

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
  automation: automationSchema,
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
  automation?: Partial<AutomationSettings>;
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
  automation: {
    enabled: true,
    startDate: null,
    telegramChatId: null,
    schedule: {
      horoscope: { kadin: { carousel: '09:00', reels: '09:00' }, erkek: { carousel: '09:25', reels: '09:25' } },
      tarot: { kadin: { carousel: '09:50', reels: '09:50' }, erkek: { carousel: '10:15', reels: '10:15' } },
      weekly: { kadin: { carousel: '09:12', reels: '09:12' }, erkek: { carousel: '09:35', reels: '09:35' } },
    },
    partGapMinutes: 3,
    cutoffTime: '22:15',
    tiktok: { enabled: true },
  },
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
    automation: { ...base.automation, ...patch.automation },
  });
}

export function parseStoredSettings(raw: unknown): Settings {
  const stored = (typeof raw === 'object' && raw !== null ? raw : {}) as SettingsPatch;
  return mergeSettings(DEFAULT_SETTINGS, stored);
}
