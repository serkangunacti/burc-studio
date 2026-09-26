import { Audio } from '@remotion/media';
import type { ComponentType } from 'react';
import type { ReelsProps } from './slide-types';

export type ReelsWithMusicProps = ReelsProps & { musicSrc: string | null };

const wrapped = new WeakMap<ComponentType<ReelsProps>, ComponentType<ReelsWithMusicProps>>();

// Dondurulmuş Reels şablonlarına dokunmadan müziği ayrı bir katman olarak ekler.
export function withMusic(Reels: ComponentType<ReelsProps>): ComponentType<ReelsWithMusicProps> {
  const existing = wrapped.get(Reels);
  if (existing) return existing;
  function ReelsWithMusic({ musicSrc, ...reels }: ReelsWithMusicProps) {
    return (
      <>
        <Reels {...reels} />
        {musicSrc && <Audio src={musicSrc} />}
      </>
    );
  }
  wrapped.set(Reels, ReelsWithMusic);
  return ReelsWithMusic;
}
