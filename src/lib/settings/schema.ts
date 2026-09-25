import { z } from 'zod';

export const WATERMARK_POSITIONS = ['bottom-center', 'bottom-right'] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];

const HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/;
export const HANDLE_ERROR = 'Kullanıcı adı yalnızca harf, rakam, nokta ve alt çizgi içerebilir (en fazla 30 karakter).';

export const settingsSchema = z.object({
  instagramHandle: z.string().regex(HANDLE_PATTERN, HANDLE_ERROR).nullable(),
  watermark: z.object({
    enabled: z.boolean(),
    position: z.enum(WATERMARK_POSITIONS),
    opacity: z.number().min(0.2).max(1),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsPatch = {
  instagramHandle?: string | null;
  watermark?: Partial<Settings['watermark']>;
};

export const DEFAULT_SETTINGS: Settings = {
  instagramHandle: null,
  watermark: { enabled: true, position: 'bottom-center', opacity: 0.55 },
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
