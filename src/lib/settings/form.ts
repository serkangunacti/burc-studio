import { parseInstagramHandleInput, WATERMARK_POSITIONS, type SettingsPatch, type WatermarkPosition } from './schema';

export type SettingsFormErrors = Partial<Record<'instagramHandle' | 'watermark', string>>;

export function parseSettingsForm(
  formData: FormData,
): { ok: true; patch: SettingsPatch } | { ok: false; errors: SettingsFormErrors } {
  const errors: SettingsFormErrors = {};

  const handle = parseInstagramHandleInput(String(formData.get('instagramHandle') ?? ''));
  if (!handle.ok) errors.instagramHandle = handle.error;

  const position = String(formData.get('watermarkPosition') ?? '');
  const opacityPercent = Number(formData.get('watermarkOpacity'));
  const validPosition = (WATERMARK_POSITIONS as readonly string[]).includes(position);
  const validOpacity = Number.isInteger(opacityPercent) && opacityPercent >= 20 && opacityPercent <= 100;
  if (!validPosition || !validOpacity) errors.watermark = 'Filigran ayarları geçersiz.';

  if (!handle.ok || errors.watermark) return { ok: false, errors };
  return {
    ok: true,
    patch: {
      instagramHandle: handle.value,
      watermark: {
        enabled: formData.get('watermarkEnabled') === 'true',
        position: position as WatermarkPosition,
        opacity: opacityPercent / 100,
      },
    },
  };
}
