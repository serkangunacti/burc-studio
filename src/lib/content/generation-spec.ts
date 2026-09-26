import { getSkySnapshot } from '@/lib/astro/sky';
import { getWeekSky, isMonday } from '@/lib/astro/week';
import type { DateKey } from '@/lib/date/istanbul';
import { getTarotCard, type TarotCard } from '@/lib/tarot/deck';
import { drawCards } from '@/lib/tarot/draw';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';
import { HOROSCOPE_PROMPT_VERSION, buildHoroscopeBatchPrompt, buildHoroscopeSignPrompt } from './horoscope-prompt';
import { DAILY_LIMITS, WEEKLY_LIMITS, type EntryLimits, type QualityIssue } from './quality';
import type { Audience, RecentHeadline } from './types';
import { WEEKLY_PROMPT_VERSION, buildWeeklyBatchPrompt, buildWeeklySignPrompt } from './weekly-prompt';

export type GeneratedKind = 'horoscope' | 'weekly';
export const GENERATED_KINDS: readonly GeneratedKind[] = ['horoscope', 'weekly'];

type Prompt = { instructions: string; prompt: string };
export type SpecContext = {
  batchPrompt(): Prompt;
  signPrompt(sign: SignSlug, issues: QualityIssue[]): Prompt;
  tarotCardId(sign: SignSlug): string | undefined;
};
export type GenerationSpec = {
  kind: GeneratedKind;
  templateVersion: string;
  promptVersion: string;
  limits: EntryLimits;
  recentDays: number;
  validDate(date: DateKey): boolean;
  context(input: { date: DateKey; audience: Audience; recent: RecentHeadline[]; keptCards?: ReadonlyMap<SignSlug, string> }): SpecContext;
};

export const HOROSCOPE_SPEC: GenerationSpec = {
  kind: 'horoscope',
  templateVersion: 'pastel@1',
  promptVersion: HOROSCOPE_PROMPT_VERSION,
  limits: DAILY_LIMITS,
  recentDays: 2,
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
  validDate: isMonday,
  context({ date, audience, recent, keptCards }) {
    // Yeni üretimde 12 farklı kart çekilir; tek burç yenilemede mevcut kartlar korunur.
    const drawn = drawCards(SIGN_SLUGS.length);
    const cards = new Map<SignSlug, TarotCard>(
      SIGN_SLUGS.map((sign, index) => {
        const kept = keptCards?.get(sign);
        return [sign, kept ? getTarotCard(kept) : drawn[index]];
      }),
    );
    const input = { monday: date, audience, week: getWeekSky(date), cards, recent };
    return {
      batchPrompt: () => buildWeeklyBatchPrompt(input),
      signPrompt: (sign, issues) => buildWeeklySignPrompt({ ...input, sign, issues }),
      tarotCardId: (sign) => cards.get(sign)?.id,
    };
  },
};

export function specFor(kind: GeneratedKind): GenerationSpec {
  return kind === 'weekly' ? WEEKLY_SPEC : HOROSCOPE_SPEC;
}
