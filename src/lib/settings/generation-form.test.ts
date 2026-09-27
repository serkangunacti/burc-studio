import { describe, expect, it } from 'vitest';
import { parseGenerationForm } from './generation-form';

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const valid: [string, string][] = [
  ['cronEnabled', 'false'],
  ['spreadLoad', 'true'],
  ['defaultFormat', '3x4'],
  ['dailyPlan', 'horoscope:kadin'],
  ['dailyPlan', 'tarot:erkek'],
  ['hashtag1', 'Günlük Burç'],
  ['hashtag2', ''],
  ['providerChain', JSON.stringify([{ id: 'gemini', enabled: true, dailyCap: 10 }])],
];

describe('parseGenerationForm', () => {
  it('geçerli formu yamaya çevirir', () => {
    expect(parseGenerationForm(form(valid))).toEqual({
      ok: true,
      patch: {
        cronEnabled: false,
        spreadLoad: true,
        defaultFormat: '3x4',
        dailyPlan: [
          { kind: 'horoscope', audience: 'kadin' },
          { kind: 'tarot', audience: 'erkek' },
        ],
        baseHashtags: ['#günlükburç'],
        providerChain: [{ id: 'gemini', enabled: true, dailyCap: 10 }],
      },
    });
  });

  it('boş plan, geçersiz hashtag ve bozuk sağlayıcı listesi hatası döner', () => {
    const result = parseGenerationForm(
      form([
        ['cronEnabled', 'true'],
        ['hashtag1', '###'],
        ['providerChain', '{bozuk'],
      ]),
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        dailyPlan: 'En az bir gönderi türü seçmelisin.',
        baseHashtags: 'Hashtag yalnızca harf, rakam ve alt çizgi içerebilir.',
        providerChain: 'Sağlayıcı sırası okunamadı.',
      },
    });
  });
});
