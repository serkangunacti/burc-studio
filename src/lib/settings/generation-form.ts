import { z } from 'zod';
import { normalizeHashtag } from '@/lib/content/hashtags';
import { providerPreferenceSchema, type PlanItem, type SettingsPatch } from './schema';

export type GenerationFormErrors = Partial<Record<'dailyPlan' | 'baseHashtags' | 'providerChain', string>>;

const PLAN_VALUES: Record<string, PlanItem> = {
  'horoscope:kadin': { kind: 'horoscope', audience: 'kadin' },
  'horoscope:erkek': { kind: 'horoscope', audience: 'erkek' },
};

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function parseGenerationForm(
  formData: FormData,
): { ok: true; patch: SettingsPatch } | { ok: false; errors: GenerationFormErrors } {
  const errors: GenerationFormErrors = {};

  const dailyPlan = formData.getAll('dailyPlan').flatMap((value) => {
    const item = PLAN_VALUES[String(value)];
    return item ? [item] : [];
  });
  if (dailyPlan.length === 0) errors.dailyPlan = 'En az bir gönderi türü seçmelisin.';

  const tags = ['hashtag1', 'hashtag2']
    .map((name) => String(formData.get(name) ?? '').trim())
    .filter(Boolean)
    .map(normalizeHashtag);
  if (tags.some((tag) => tag === null)) errors.baseHashtags = 'Hashtag yalnızca harf, rakam ve alt çizgi içerebilir.';

  const chain = z.array(providerPreferenceSchema).safeParse(parseJson(String(formData.get('providerChain') ?? '[]')));
  if (!chain.success) errors.providerChain = 'Sağlayıcı sırası okunamadı.';

  if (Object.keys(errors).length > 0 || !chain.success) return { ok: false, errors };
  return {
    ok: true,
    patch: {
      cronEnabled: formData.get('cronEnabled') === 'true',
      spreadLoad: formData.get('spreadLoad') === 'true',
      defaultFormat: formData.get('defaultFormat') === '3x4' ? '3x4' : '4x5',
      dailyPlan,
      baseHashtags: tags.filter((tag): tag is string => tag !== null),
      providerChain: chain.data,
    },
  };
}
