import type { ComponentType } from 'react';
import type { ReelsProps, SlideProps } from '../slide-types';
import { PastelSlide, waitForPastelFonts } from './pastel-v1';
import { PastelReels } from './pastel-v1-reels';
import { PastelTarotReels, PastelTarotSlide } from './pastel-tarot-v1';
import { PastelWeeklyReels, PastelWeeklySlide } from './pastel-weekly-v1';
import {PastelCosmicSlide,PastelCosmicTarotSlide,PastelCosmicWeeklySlide,PastelCosmicReels,PastelCosmicTarotReels,PastelCosmicWeeklyReels} from './pastel-v2';

export type SlideTemplate = { Slide: ComponentType<SlideProps>; Reels: ComponentType<ReelsProps>; waitForFonts: () => Promise<unknown> };

// Bir sürüm bir gönderide kullanıldıktan sonra değişmez; yeni görünüm yeni anahtarla (pastel@2) eklenir.
const TEMPLATES: Record<string, SlideTemplate> = {
  'pastel@1': { Slide: PastelSlide, Reels: PastelReels, waitForFonts: waitForPastelFonts },
  'pastel-tarot@1': { Slide: PastelTarotSlide, Reels: PastelTarotReels, waitForFonts: waitForPastelFonts },
  'pastel-weekly@1': { Slide: PastelWeeklySlide, Reels: PastelWeeklyReels, waitForFonts: waitForPastelFonts },
  'pastel@2': {Slide:PastelCosmicSlide,Reels:PastelCosmicReels,waitForFonts:waitForPastelFonts},
  'pastel-tarot@2': {Slide:PastelCosmicTarotSlide,Reels:PastelCosmicTarotReels,waitForFonts:waitForPastelFonts},
  'pastel-weekly@2': {Slide:PastelCosmicWeeklySlide,Reels:PastelCosmicWeeklyReels,waitForFonts:waitForPastelFonts},
};

export function getTemplate(version: string): SlideTemplate {
  const template = TEMPLATES[version];
  if (!template) throw new Error(`Bilinmeyen şablon: ${version}`);
  return template;
}
