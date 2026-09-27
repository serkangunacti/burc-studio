import { getSkySnapshot } from '@/lib/astro/sky';
import { getWeekSky, isMonday } from '@/lib/astro/week';
import type { DateKey } from '@/lib/date/istanbul';
import { getTarotCard, type TarotCard } from '@/lib/tarot/deck';
import { drawCards } from '@/lib/tarot/draw';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';
import { HOROSCOPE_PROMPT_VERSION, buildHoroscopeBatchPrompt, buildHoroscopeSignPrompt } from './horoscope-prompt';
import { TAROT_PROMPT_VERSION, buildTarotBatchPrompt, buildTarotSignPrompt } from './tarot-prompt';
import { DAILY_LIMITS, WEEKLY_LIMITS, type EntryLimits, type ForbiddenPhrases, type QualityIssue } from './quality';
import type { Audience, RecentHeadline } from './types';
import { WEEKLY_PROMPT_VERSION, buildWeeklyBatchPrompt, buildWeeklySignPrompt } from './weekly-prompt';

export type GeneratedKind = 'horoscope' | 'tarot' | 'weekly';
export const GENERATED_KINDS: readonly GeneratedKind[] = ['horoscope', 'tarot', 'weekly'];

type Prompt = { instructions: string; prompt: string };
export type SpecContext = {
  batchPrompt(signs: readonly SignSlug[]): Prompt;
  signPrompt(sign: SignSlug, issues: QualityIssue[]): Prompt;
  tarotCardId(sign: SignSlug): string | undefined;
  forbidden?: ForbiddenPhrases;
};
export type GenerationSpec = {
  kind: GeneratedKind;
  templateVersion: string;
  promptVersion: string;
  limits: EntryLimits;
  recentDays: number;
  // Bir istekte yazılan burç sayısı; ücretsiz sağlayıcılar uzun haftalık yanıtı tek seferde bitiremiyor.
  chunkSize: number;
  validDate(date: DateKey): boolean;
  context(input: { date: DateKey; audience: Audience; recent: RecentHeadline[]; keptCards?: ReadonlyMap<SignSlug, string> }): SpecContext;
};

// Tek sözcüklük kart adlarının çoğu (Ay, Güneş, Yıldız, Güç, Adalet…) gündelik Türkçe ve gökyüzü metninde de geçer;
// yalnızca çok sözcüklü ve kendine özgü adlar aranır.
const DISTINCTIVE_SINGLE_NAMES = new Set(['Büyücü', 'Başrahibe', 'İmparatoriçe', 'İmparator', 'Başrahip']);

function cardPhrases(card: TarotCard): string[] {
  return ['tarot', ...(card.name.includes(' ') || DISTINCTIVE_SINGLE_NAMES.has(card.name) ? [card.name] : [])];
}

// Tutulan kartlar korunur; kalan burçlara tutulanlardan farklı, birbirinden de farklı yeni kartlar çekilir.
function assignCards(keptCards: ReadonlyMap<SignSlug, string> | undefined): Map<SignSlug, TarotCard> {
  const kept = new Set(keptCards?.values());
  const fresh = drawCards(SIGN_SLUGS.length - kept.size, undefined, kept);
  let next = 0;
  return new Map(
    SIGN_SLUGS.map((sign) => {
      const id = keptCards?.get(sign);
      return [sign, id ? getTarotCard(id) : fresh[next++]];
    }),
  );
}

export const HOROSCOPE_SPEC: GenerationSpec = {
  kind: 'horoscope',
  templateVersion: 'pastel@1',
  promptVersion: HOROSCOPE_PROMPT_VERSION,
  limits: DAILY_LIMITS,
  recentDays: 2,
  chunkSize: SIGN_SLUGS.length,
  validDate: () => true,
  context({ date, audience, recent }) {
    const input = { dateKey: date, audience, sky: getSkySnapshot(date), recent };
    return {
      batchPrompt: () => buildHoroscopeBatchPrompt(input),
      signPrompt: (sign, issues) => buildHoroscopeSignPrompt({ ...input, sign, issues }),
      tarotCardId: () => undefined,
    };
  },
};

export const WEEKLY_SPEC: GenerationSpec = {
  kind: 'weekly',
  templateVersion: 'pastel-weekly@1',
  promptVersion: WEEKLY_PROMPT_VERSION,
  limits: WEEKLY_LIMITS,
  recentDays: 7,
  chunkSize: 4,
  validDate: isMonday,
  context({ date, audience, recent, keptCards }) {
    const cards = assignCards(keptCards);
    const input = { monday: date, audience, week: getWeekSky(date), cards, recent };
    return {
      batchPrompt: (signs) => buildWeeklyBatchPrompt(input, signs),
      signPrompt: (sign, issues) => buildWeeklySignPrompt({ ...input, sign, issues }),
      tarotCardId: (sign) => cards.get(sign)?.id,
      forbidden: (sign) => cardPhrases(cards.get(sign)!),
    };
  },
};

export const TAROT_SPEC: GenerationSpec = {
  kind: 'tarot',
  templateVersion: 'pastel-tarot@1',
  promptVersion: TAROT_PROMPT_VERSION,
  limits: DAILY_LIMITS,
  recentDays: 2,
  chunkSize: SIGN_SLUGS.length,
  validDate: () => true,
  context({ date, audience, recent, keptCards }) {
    const cards = assignCards(keptCards);
    const input = { dateKey: date, audience, sky: getSkySnapshot(date), cards, recent };
    return {
      batchPrompt: () => buildTarotBatchPrompt(input),
      signPrompt: (sign, issues) => buildTarotSignPrompt({ ...input, sign, issues }),
      tarotCardId: (sign) => cards.get(sign)?.id,
    };
  },
};

const SPECS: Record<GeneratedKind, GenerationSpec> = { horoscope: HOROSCOPE_SPEC, tarot: TAROT_SPEC, weekly: WEEKLY_SPEC };

export function specFor(kind: GeneratedKind): GenerationSpec {
  return SPECS[kind];
}
