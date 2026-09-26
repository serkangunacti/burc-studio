import type { ComponentType } from 'react';
import type { SlideProps } from '../slide-types';
import { PastelSlide, waitForPastelFonts } from './pastel-v1';

export type SlideTemplate = { Slide: ComponentType<SlideProps>; waitForFonts: () => Promise<unknown> };

// Bir sürüm bir gönderide kullanıldıktan sonra değişmez; yeni görünüm yeni anahtarla (pastel@2) eklenir.
const TEMPLATES: Record<string, SlideTemplate> = {
  'pastel@1': { Slide: PastelSlide, waitForFonts: waitForPastelFonts },
};

export function getTemplate(version: string): SlideTemplate {
  const template = TEMPLATES[version];
  if (!template) throw new Error(`Bilinmeyen şablon: ${version}`);
  return template;
}
