import type { ReelsSign, SignSlideData, ReelsSceneTiming } from './slide-types';

export const REELS_SIZE = { width: 1080, height: 1920 } as const;
export const REELS_FPS = 30;
export const INTRO_FRAMES = 75;
export const SIGN_FRAMES = 150;
export const OUTRO_FRAMES = 90;
export const TRANSITION_FRAMES = 15;
export const MAX_REELS_SECONDS = 179; // Tek MP4, YouTube Shorts sınırının altında.
export const MAX_REELS_FRAMES = Math.floor(178.9 * REELS_FPS);

// Geçişler iki sahneyi üst üste bindirir; her geçiş toplam süreyi kısaltır.
export function reelsDurationInFrames(signCount: number, timing?:ReelsSceneTiming): number {
  const sceneCount = signCount + 2;
  const scenes=timing ? [timing.introFrames,...timing.signFrames,timing.outroFrames] : [INTRO_FRAMES,...Array<number>(signCount).fill(SIGN_FRAMES),OUTRO_FRAMES];
  if(scenes.length!==sceneCount || scenes.some(frames=>!Number.isInteger(frames)||frames<=2*TRANSITION_FRAMES))throw new Error('Reels sahne süreleri geçersiz');
  return scenes.reduce((sum,frames)=>sum+frames,0) - (sceneCount - 1) * TRANSITION_FRAMES;
}

export function toReelsSign(slide: SignSlideData, short: string, includeBody = false): ReelsSign {
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
    ...(includeBody && slide.body ? { body: slide.body } : {}),
    ...(slide.tarotCard ? { tarotCard: slide.tarotCard } : {}),
  };
}
