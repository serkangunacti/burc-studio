import type { ReelsSign, SignSlideData } from './slide-types';

export const REELS_SIZE = { width: 1080, height: 1920 } as const;
export const REELS_FPS = 30;
export const INTRO_FRAMES = 75;
export const SIGN_FRAMES = 150;
export const OUTRO_FRAMES = 90;
export const TRANSITION_FRAMES = 15;

// Geçişler iki sahneyi üst üste bindirir; her geçiş toplam süreyi kısaltır.
export function reelsDurationInFrames(signCount: number): number {
  const sceneCount = signCount + 2;
  return INTRO_FRAMES + signCount * SIGN_FRAMES + OUTRO_FRAMES - (sceneCount - 1) * TRANSITION_FRAMES;
}

export function toReelsSign(slide: SignSlideData, short: string): ReelsSign {
  return {
    sign: slide.sign,
    signName: slide.signName,
    dateRange: slide.dateRange,
    element: slide.element,
    headline: slide.headline,
    short,
    scores: slide.scores,
    luckyColor: slide.luckyColor,
    luckyNumber: slide.luckyNumber,
  };
}
