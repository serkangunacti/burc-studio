import type { ReadingAudience, ReadingKind } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';
import type { SlideData } from '@/remotion/slide-types';

const KIND_SLUGS: Record<ReadingKind, string> = { horoscope: 'burc', tarot: 'tarot', special: 'ozel', weekly: 'haftalik' };

export const CAPTION_FILE_NAME = 'caption.txt';

export function postBaseName(post: { date: DateKey; kind: ReadingKind; audience: ReadingAudience }): string {
  return `${post.date}_${post.audience}-${KIND_SLUGS[post.kind]}`;
}

function slideSuffix(slide: SlideData): string {
  if (slide.type === 'cover') return 'kapak';
  if (slide.type === 'cta') return 'kapanis';
  return slide.sign;
}

export function slideFileName(baseName: string, index: number, slide: SlideData): string {
  return `${baseName}_${String(index + 1).padStart(2, '0')}-${slideSuffix(slide)}.jpg`;
}

export function zipFileName(baseName: string): string {
  return `${baseName}.zip`;
}

export function reelsFileName(baseName: string): string {
  return `${baseName}_reels.mp4`;
}
