import { AbsoluteFill } from 'remotion';
import type { Element } from '@/lib/zodiac/signs';
import { FORMAT_SIZES, type SlideProps } from '@/remotion/slide-types';
import { CtaSlide } from '../pastel-v1/cta-slide';
import { BODY_FONT } from '../pastel-v1/fonts';
import { Sparkle } from '../pastel-v1/ornaments';
import { BACKDROPS, ELEMENT_TINTS, PALETTE, backdropIndex, type Backdrop } from '../pastel-v1/tokens';
import { Watermark } from '../pastel-v1/watermark';
import { WeeklyCover } from './weekly-cover';
import { WeeklySign } from './weekly-sign';

// pastel@1 ile aynı zemin ve ışıltılar; o klasör dondurulduğu için burada ayrı tutulur.
const SPARKLE_LAYOUTS = [
  [
    { x: 0.035, y: 0.022, size: 30, opacity: 0.7 },
    { x: 0.93, y: 0.024, size: 22, opacity: 0.6 },
    { x: 0.945, y: 0.88, size: 26, opacity: 0.6 },
    { x: 0.03, y: 0.955, size: 24, opacity: 0.55 },
  ],
  [
    { x: 0.93, y: 0.022, size: 30, opacity: 0.7 },
    { x: 0.035, y: 0.024, size: 22, opacity: 0.6 },
    { x: 0.03, y: 0.88, size: 26, opacity: 0.6 },
    { x: 0.955, y: 0.955, size: 24, opacity: 0.55 },
  ],
  [
    { x: 0.48, y: 0.018, size: 24, opacity: 0.65 },
    { x: 0.035, y: 0.5, size: 20, opacity: 0.55 },
    { x: 0.955, y: 0.3, size: 22, opacity: 0.6 },
    { x: 0.955, y: 0.955, size: 26, opacity: 0.6 },
  ],
];

function Background({ index, element }: { index: number; element: Element | null }) {
  const backdrop = BACKDROPS[index];
  const tint = element ? ELEMENT_TINTS[element] : PALETTE.cream;
  const sparkles = SPARKLE_LAYOUTS[index % SPARKLE_LAYOUTS.length];
  return (
    <AbsoluteFill
      style={{ backgroundImage: `linear-gradient(${backdrop.angle}deg, ${backdrop.from} 0%, ${tint} 38%, ${PALETTE.cream} 62%, ${backdrop.to} 100%)` }}
    >
      {sparkles.map((sparkle) => (
        <Sparkle key={`${sparkle.x}-${sparkle.y}`} {...sparkle} color={PALETTE.gold} />
      ))}
    </AbsoluteFill>
  );
}

export function PastelWeeklySlide({ slide, brand, format, variant }: SlideProps) {
  const { width, height } = FORMAT_SIZES[format];
  const index = backdropIndex(variant);
  const backdrop: Backdrop = BACKDROPS[index];
  return (
    <AbsoluteFill
      lang="tr"
      style={{
        width,
        height,
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
      <Background index={index} element={slide.type === 'sign' ? slide.element : null} />
      {slide.type === 'cover' && <WeeklyCover slide={slide} backdrop={backdrop} />}
      {slide.type === 'sign' && <WeeklySign slide={slide} backdrop={backdrop} />}
      {slide.type === 'cta' && <CtaSlide slide={slide} brand={brand} />}
      {slide.type !== 'cta' && <Watermark brand={brand} />}
    </AbsoluteFill>
  );
}
