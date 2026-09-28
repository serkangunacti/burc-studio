import { describe, expect, it } from 'vitest';
import { parseAutomationForm, slotFieldName } from './automation-form';
import { DEFAULT_SETTINGS } from './schema';

function formFrom(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  const { schedule } = DEFAULT_SETTINGS.automation;
  for (const [kind, audiences] of Object.entries(schedule)) {
    for (const [audience, slots] of Object.entries(audiences)) {
      for (const [format, clock] of Object.entries(slots)) form.set(slotFieldName(kind, audience, format), clock);
    }
  }
  form.set('enabled', 'true');
  form.set('partGapMinutes', '3');
  form.set('cutoffTime', '22:15');
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return form;
}

describe('otomasyon formu', () => {
  it('saatleri ve açık/kapalı durumunu yamaya çevirir, sohbet kaydına dokunmaz', () => {
    const current = { ...DEFAULT_SETTINGS.automation, telegramChatId: 7 };
    const result = parseAutomationForm(formFrom({ 'tarot.erkek.reels': '23:15', enabled: 'false', partGapMinutes: '5', tiktokEnabled: 'true' }), current);
    expect(result).toEqual({
      ok: true,
      patch: {
        automation: {
          enabled: false,
          partGapMinutes: 5,
          cutoffTime: '22:15',
          tiktok: { enabled: true },
          schedule: { ...current.schedule, tarot: { ...current.schedule.tarot, erkek: { carousel: '13:30', reels: '23:15' } } },
        },
      },
    });
  });

  it('geçersiz saati ya da parça aralığını reddeder', () => {
    expect(parseAutomationForm(formFrom({ 'horoscope.kadin.carousel': '8:30' }), DEFAULT_SETTINGS.automation).ok).toBe(false);
    expect(parseAutomationForm(formFrom({ partGapMinutes: '0' }), DEFAULT_SETTINGS.automation).ok).toBe(false);
  });
});
