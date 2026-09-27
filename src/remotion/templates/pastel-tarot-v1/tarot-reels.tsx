import type { ReelsProps } from '@/remotion/slide-types';
import { PastelReels } from '../pastel-v1-reels/reels';
import { TarotScene } from './tarot-scene';

export function PastelTarotReels(reels: ReelsProps) {
  return <PastelReels {...reels} heading="Tarot Yorumları" SignSceneComponent={TarotScene} />;
}
