import type { DateKey } from '@/lib/date/istanbul';
import type { SignSlug } from '@/lib/zodiac/signs';

export const READING_KINDS = ['horoscope', 'tarot', 'special', 'weekly'] as const;
export type ReadingKind = (typeof READING_KINDS)[number];
export const READING_AUDIENCES = ['kadin', 'erkek', 'genel'] as const;
export type ReadingAudience = (typeof READING_AUDIENCES)[number];
export type Audience = 'kadin' | 'erkek';
export const AUDIENCES: readonly Audience[] = ['kadin', 'erkek'];
export const AUDIENCE_LABELS: Record<Audience, string> = { kadin: 'Kadın', erkek: 'Erkek' };
const KIND_TITLES: Record<ReadingKind, string> = { horoscope: 'burç yorumları', weekly: 'haftalık yorumlar', tarot: 'tarot yorumları', special: 'özel yorumlar' };

export function postTitle(kind: ReadingKind, audience: Audience): string {
  return `${AUDIENCE_LABELS[audience]} ${KIND_TITLES[kind]}`;
}
export const RUN_TRIGGERS = ['cron', 'button', 'regenerate', 'local'] as const;
export type RunTrigger = (typeof RUN_TRIGGERS)[number];
export type RecentHeadline = { date: DateKey; sign: SignSlug; headline: string; short: string };
