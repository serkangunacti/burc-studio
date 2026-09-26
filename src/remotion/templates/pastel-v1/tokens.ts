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

export const AUDIENCE_ACCENTS: Record<Audience, { from: string; to: string; ink: string }> = {
  kadin: { from: '#F4C2C2', to: '#C8B6E2', ink: '#7A5AA6' },
  erkek: { from: '#BFD7ED', to: '#B7C9A8', ink: '#3F6477' },
};

export const AUDIENCE_TITLES: Record<Audience, string> = { kadin: 'KADIN', erkek: 'ERKEK' };

export const ELEMENT_TINTS: Record<Element, string> = {
  ates: '#FFE6D9',
  toprak: '#EEF2E3',
  hava: '#E8F1FA',
  su: '#ECE7F8',
};

export const CARD_SHADOW = '0 18px 48px rgba(61, 44, 62, 0.08)';
