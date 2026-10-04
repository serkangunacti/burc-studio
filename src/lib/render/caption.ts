import { addDays, formatDateShortTr, type DateKey } from '@/lib/date/istanbul';
import { mergeHashtags, normalizeHashtag } from '@/lib/content/hashtags';
import type { Audience } from '@/lib/content/types';
import type { AutomationKind } from '@/lib/settings/schema';

export function formatCaption(caption: string, hashtags: readonly string[]): string {
  const text = caption.trim();
  return hashtags.length > 0 ? `${text}\n\n${hashtags.join(' ')}` : text;
}

export function formatPublicationCaption(input: { date: DateKey; kind: AutomationKind; audience: Audience; caption: string; hashtags: readonly string[]; platform: 'instagram' | 'tiktok'; partHeading?: string }): string {
  const dateText = `${formatDateShortTr(input.date)} ${input.date.slice(0, 4)}`;
  const end = addDays(input.date, 6);
  const period = input.kind !== 'weekly' ? dateText
    : input.date.slice(0, 4) === end.slice(0, 4)
      ? `${formatDateShortTr(input.date)} – ${formatDateShortTr(end)} ${end.slice(0, 4)}`
      : `${dateText} – ${formatDateShortTr(end)} ${end.slice(0, 4)}`;
  const labels = { horoscope: 'Günlük burç yorumu', tarot: 'Günlük tarot yorumu', weekly: 'Haftalık burç yorumu' };
  const base = { horoscope: ['#günlükburç', '#burçyorumu'], tarot: ['#tarot', '#günlüktarot'], weekly: ['#haftalıkburç', '#burçyorumu'] };
  const suggestions = input.hashtags.filter((tag) => input.kind !== 'tarot' || !['#astroloji', '#günlükburç', '#haftalıkburç', '#burçyorumu'].includes(normalizeHashtag(tag) ?? ''));
  const questions = { horoscope: 'Sana uyan yorum hangisi?', tarot: 'Bugün hangi kartın mesajı sana uyuyor?', weekly: 'Bu hafta senin önceliğin ne?' };
  const text = [
    `${period} · ${labels[input.kind]} · ${input.audience === 'kadin' ? 'Kadın' : 'Erkek'}`,
    input.partHeading,
    input.caption.trim(),
    input.platform === 'instagram' ? 'Günün notunu sonra okumak için kaydet.' : questions[input.kind],
  ].filter(Boolean).join('\n\n');
  return formatCaption(text, mergeHashtags(base[input.kind], suggestions));
}
