import { Fragment, type ComponentProps, type ComponentType } from 'react';
import { AbsoluteFill } from 'remotion';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { INTRO_FRAMES, OUTRO_FRAMES, REELS_SIZE, SIGN_FRAMES, TRANSITION_FRAMES } from '@/remotion/reels';
import type { ReelsProps } from '@/remotion/slide-types';
import { BODY_FONT } from '../pastel-v1/fonts';
import { BACKDROPS, PALETTE, backdropIndex } from '../pastel-v1/tokens';
import { IntroScene } from './intro-scene';
import { OutroScene } from './outro-scene';
import { SignScene } from './sign-scene';

const TIMING = linearTiming({ durationInFrames: TRANSITION_FRAMES });

// Haftalık ve tarot Reels aynı akışı kendi giriş başlıkları ve burç sahneleriyle kullanır.
export function PastelReels({
  title,
  heading,
  SignSceneComponent = SignScene,
  ...reels
}: ReelsProps & { title?: string; heading?: string; SignSceneComponent?: ComponentType<ComponentProps<typeof SignScene>> }) {
  const backdrop = BACKDROPS[backdropIndex(reels.variant)];
  return (
    <AbsoluteFill
      lang="tr"
      style={{
        width: REELS_SIZE.width,
        height: REELS_SIZE.height,
        overflow: 'hidden',
        backgroundColor: PALETTE.cream,
        color: PALETTE.plum,
        fontFamily: BODY_FONT,
        fontSize: 32,
        fontStyle: 'normal',
        fontWeight: 400,
        lineHeight: 1.3,
        letterSpacing: 'normal',
        textAlign: 'left',
      }}
    >
      <AbsoluteFill
        style={{ backgroundImage: `linear-gradient(${backdrop.angle}deg, ${backdrop.from} 0%, ${PALETTE.cream} 45%, ${backdrop.to} 100%)` }}
      />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={INTRO_FRAMES}>
          <IntroScene reels={reels} backdrop={backdrop} title={title} heading={heading} />
        </TransitionSeries.Sequence>
        {reels.signs.map((sign, index) => (
          <Fragment key={sign.sign}>
            <TransitionSeries.Transition presentation={fade()} timing={TIMING} />
            <TransitionSeries.Sequence durationInFrames={SIGN_FRAMES}>
              <SignSceneComponent sign={sign} index={index} total={reels.signs.length} audience={reels.audience} backdrop={backdrop} brand={reels.brand} />
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
        <TransitionSeries.Transition presentation={fade()} timing={TIMING} />
        <TransitionSeries.Sequence durationInFrames={OUTRO_FRAMES}>
          <OutroScene reels={reels} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
