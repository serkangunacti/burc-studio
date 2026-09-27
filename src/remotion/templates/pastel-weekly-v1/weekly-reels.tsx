import type { ReelsProps } from '@/remotion/slide-types';
import { PastelReels } from '../pastel-v1-reels/reels';

export function PastelWeeklyReels(reels: ReelsProps) {
  return <PastelReels {...reels} title="Haftalık" />;
}
