import type { PublicationFormat } from '@/db/schema';
import type { Audience, ReadingAudience, ReadingKind } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';
import { formatPublicationCaption } from '@/lib/render/caption';
import { AUTOMATION_KINDS, type AutomationKind, type AutomationSettings } from '@/lib/settings/schema';
import { getSign, SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';

// Instagram carousel'i en fazla 10 görsel alır: 12 burç 4'erli üç parçaya bölünür (kapak + 4 burç + kapanış).
export const CAROUSEL_PARTS = [1, 2, 3] as const;
export type CarouselPart = (typeof CAROUSEL_PARTS)[number];
const SIGNS_PER_PART = SIGN_SLUGS.length / CAROUSEL_PARTS.length;

export function partSigns(part: CarouselPart): SignSlug[] {
  return SIGN_SLUGS.slice((part - 1) * SIGNS_PER_PART, part * SIGNS_PER_PART);
}

export function partLabel(part: CarouselPart): string {
  const names = partSigns(part).map((sign) => getSign(sign).name.toLocaleUpperCase('tr-TR'));
  return `${part}/${CAROUSEL_PARTS.length} · ${names.join(' · ')}`;
}

function partHeading(part: CarouselPart): string {
  return `${partSigns(part)
    .map((sign) => getSign(sign).name)
    .join(' · ')} (${part}/${CAROUSEL_PARTS.length})`;
}

// TSİ 2016'dan beri sabit UTC+3.
export function istanbulInstant(date: DateKey, clock: string): Date {
  return new Date(`${date}T${clock}:00+03:00`);
}

export type PlannablePost = { id: string; kind: ReadingKind; audience: ReadingAudience; caption: string; hashtags: string[] };
export type PlannedPublication = {
  postId: string;
  kind: AutomationKind;
  audience: Audience;
  format: PublicationFormat;
  part: number;
  scheduledAt: Date;
  caption: string;
};

function isAutomated(post: PlannablePost): post is PlannablePost & { kind: AutomationKind; audience: Audience } {
  return (AUTOMATION_KINDS as readonly string[]).includes(post.kind) && post.audience !== 'genel';
}

export function planPublications(date: DateKey, posts: readonly PlannablePost[], automation: AutomationSettings): PlannedPublication[] {
  return posts.filter(isAutomated).flatMap((post): PlannedPublication[] => {
    const slot = automation.schedule[post.kind][post.audience];
    const captionFor = (platform: 'instagram' | 'tiktok') => formatPublicationCaption({ ...post, date, platform });
    const base = { postId: post.id, kind: post.kind, audience: post.audience };
    const video = { ...base, part: 0, scheduledAt: istanbulInstant(date, slot.reels) };
    return [
      { ...video, format: 'reels' as const, caption: captionFor('instagram') },
      ...(automation.tiktok.enabled ? [{ ...video, format: 'tiktok' as const, caption: captionFor('tiktok') }] : []),
    ];
  });
}
