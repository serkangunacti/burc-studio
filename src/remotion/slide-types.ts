import type { PostFormat } from '@/db/schema';
import type { Audience } from '@/lib/content/types';
import type { WatermarkPosition } from '@/lib/settings/schema';
import type { Element, SignSlug } from '@/lib/zodiac/signs';

export type { PostFormat };

export const FORMAT_SIZES: Record<PostFormat, { width: number; height: number }> = {
  '4x5': { width: 1080, height: 1350 },
  '3x4': { width: 1080, height: 1440 },
};

export const SLIDE_FPS = 30;

export type BrandProps = { handle: string | null; enabled: boolean; position: WatermarkPosition; opacity: number };

export type CoverSlideData = { type: 'cover'; audience: Audience; dateLabel: string; hook: string };

export type SignSlideData = {
  type: 'sign';
  audience: Audience;
  dateLabel: string;
  sign: SignSlug;
  signName: string;
  dateRange: string;
  element: Element;
  headline: string;
  body: string;
  scores: { love: number; money: number; health: number };
  luckyColor: { name: string; hex: string };
  luckyNumber: number;
};

export type CtaSlideData = { type: 'cta'; audience: Audience };

export type SlideData = CoverSlideData | SignSlideData | CtaSlideData;

// variant: gönderiye özgü zemin sırası (şablon 7'lik döngüde yorumlar); tarih, tür ve kitleden hesaplanır.
export type SlideProps = { slide: SlideData; brand: BrandProps; format: PostFormat; variant: number };
