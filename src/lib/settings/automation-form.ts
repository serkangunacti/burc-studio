import { AUTOMATION_KINDS, automationSchema, type AutomationSettings, type SettingsPatch } from './schema';

export const AUTOMATION_AUDIENCES = ['kadin', 'erkek'] as const;
export const AUTOMATION_FORMATS = ['carousel', 'reels'] as const;

export const slotFieldName = (kind: string, audience: string, format: string) => `${kind}.${audience}.${format}`;

export function parseAutomationForm(
  formData: FormData,
  current: AutomationSettings,
): { ok: true; patch: SettingsPatch } | { ok: false; error: string } {
  const schedule = structuredClone(current.schedule);
  for (const kind of AUTOMATION_KINDS) {
    for (const audience of AUTOMATION_AUDIENCES) {
      for (const format of AUTOMATION_FORMATS) {
        schedule[kind][audience][format] = String(formData.get(slotFieldName(kind, audience, format)) ?? '').trim();
      }
    }
  }
  const parsed = automationSchema.safeParse({
    ...current,
    enabled: formData.get('enabled') === 'true',
    schedule,
    partGapMinutes: Number(formData.get('partGapMinutes')),
  });
  if (!parsed.success) return { ok: false, error: 'Saatler SS:DD biçiminde, parça arası 1–30 dakika olmalı.' };
  const { enabled, schedule: nextSchedule, partGapMinutes } = parsed.data;
  return { ok: true, patch: { automation: { enabled, schedule: nextSchedule, partGapMinutes } } };
}
