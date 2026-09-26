import { describe, expect, it } from 'vitest';
import { graphemeLength } from '@/lib/text/turkish';
import { LONGEST_SHORT, sampleReels, sampleSign } from './fixtures';
import { REELS_FPS, reelsDurationInFrames, toReelsSign } from './reels';

describe('Reels zaman çizelgesi', () => {
  it('12 burçlu Reels 1770 kare, yani 59 saniye sürer', () => {
    expect(reelsDurationInFrames(12)).toBe(1770);
    expect(reelsDurationInFrames(12) / REELS_FPS).toBe(59);
    expect(reelsDurationInFrames(0)).toBe(150);
  });

  it('burç slaytından Reels sahnesi verisi üretir; uzun yorum taşınmaz', () => {
    const scene = toReelsSign(sampleSign('aslan'), 'Aslan: sahne senin ✨');
    expect(scene).toMatchObject({ sign: 'aslan', signName: 'Aslan', short: 'Aslan: sahne senin ✨', luckyNumber: 7 });
    expect(scene).not.toHaveProperty('body');
    expect(sampleReels('erkek')).toMatchObject({ audience: 'erkek', variant: 0 });
    expect(sampleReels().signs).toHaveLength(12);
    expect(graphemeLength(LONGEST_SHORT)).toBe(140);
  });
});
