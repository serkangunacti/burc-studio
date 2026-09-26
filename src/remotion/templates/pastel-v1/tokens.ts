import type { Audience } from '@/lib/content/types';
import type { Element } from '@/lib/zodiac/signs';

export const PALETTE = {
  cream: '#FBF7F2',
  plum: '#3D2C3E',
  plumSoft: '#6E5E70',
  gold: '#C9A96E',
  goldSoft: '#E8D8B8',
  white: '#FFFFFF',
  card: 'rgba(255, 255, 255, 0.78)',
} as const;

export const AUDIENCE_INK: Record<Audience, string> = { kadin: '#7A5AA6', erkek: '#3F6477' };

export type Backdrop = { from: string; to: string; angle: number };

// Her gönderi bu pastel zeminlerden biriyle açılır; düzen, yazı ve renk ailesi hep aynı kalır.
export const BACKDROPS: readonly Backdrop[] = [
  { from: '#F4C2C2', to: '#C8B6E2', angle: 165 },
  { from: '#BFD7ED', to: '#B7C9A8', angle: 200 },
  { from: '#FFD1B3', to: '#F4C2C2', angle: 145 },
  { from: '#D9C6F0', to: '#BFD7ED', angle: 185 },
  { from: '#BEE3D3', to: '#FFF1A8', angle: 155 },
  { from: '#EFE3CC', to: '#D9C6F0', angle: 210 },
  { from: '#F7C9BC', to: '#BEE3D3', angle: 130 },
];

export function backdropIndex(variant: number): number {
  return ((variant % BACKDROPS.length) + BACKDROPS.length) % BACKDROPS.length;
}

export const AUDIENCE_TITLES: Record<Audience, string> = { kadin: 'KADIN', erkek: 'ERKEK' };

export const ELEMENT_TINTS: Record<Element, string> = {
  ates: '#FFE6D9',
  toprak: '#EEF2E3',
  hava: '#E8F1FA',
  su: '#ECE7F8',
};

export const CARD_SHADOW = '0 18px 48px rgba(61, 44, 62, 0.08)';
