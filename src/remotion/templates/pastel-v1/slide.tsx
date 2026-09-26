import { AbsoluteFill } from 'remotion';
import type { Audience } from '@/lib/content/types';
import type { Element } from '@/lib/zodiac/signs';
import { FORMAT_SIZES, type SlideProps } from '@/remotion/slide-types';
import { CoverSlide } from './cover-slide';
import { CtaSlide } from './cta-slide';
import { BODY_FONT } from './fonts';
import { Sparkle } from './ornaments';
import { SignSlide } from './sign-slide';
import { AUDIENCE_ACCENTS, ELEMENT_TINTS, PALETTE } from './tokens';
import { Watermark } from './watermark';

const SPARKLES = [
  { x: 0.08, y: 0.06, size: 34, opacity: 0.7 },
  { x: 0.9, y: 0.1, size: 24, opacity: 0.6 },
  { x: 0.87, y: 0.52, size: 18, opacity: 0.5 },
  { x: 0.05, y: 0.74, size: 22, opacity: 0.5 },
  { x: 0.92, y: 0.9, size: 30, opacity: 0.6 },
];

function Backdrop({ audience, element }: { audience: Audience; element: Element | null }) {
  const accent = AUDIENCE_ACCENTS[audience];
  const tint = element ? ELEMENT_TINTS[element] : PALETTE.cream;
  return (
    <AbsoluteFill style={{ backgroundImage: `linear-gradient(165deg, ${accent.from} 0%, ${tint} 38%, ${PALETTE.cream} 62%, ${accent.to} 100%)` }}>
      {SPARKLES.map((sparkle) => (
        <Sparkle key={`${sparkle.x}-${sparkle.y}`} {...sparkle} color={PALETTE.gold} />
      ))}
    </AbsoluteFill>
  );
}

export function PastelSlide({ slide, brand, format }: SlideProps) {
  const { width, height } = FORMAT_SIZES[format];
  return (
    <AbsoluteFill lang="tr" style={{ width, height, overflow: 'hidden', backgroundColor: PALETTE.cream, color: PALETTE.plum, fontFamily: BODY_FONT }}>
      <Backdrop audience={slide.audience} element={slide.type === 'sign' ? slide.element : null} />
      {slide.type === 'cover' && <CoverSlide slide={slide} />}
      {slide.type === 'sign' && <SignSlide slide={slide} />}
      {slide.type === 'cta' && <CtaSlide slide={slide} brand={brand} />}
      {slide.type !== 'cta' && <Watermark brand={brand} />}
    </AbsoluteFill>
  );
}
