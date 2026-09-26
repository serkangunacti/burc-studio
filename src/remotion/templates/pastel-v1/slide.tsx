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

// Köşelerde; başlık satırı, kartlar ve filigran alanıyla çakışmaz.
const SPARKLES = [
  { x: 0.035, y: 0.022, size: 30, opacity: 0.7 },
  { x: 0.93, y: 0.024, size: 22, opacity: 0.6 },
  { x: 0.945, y: 0.88, size: 26, opacity: 0.6 },
  { x: 0.03, y: 0.955, size: 24, opacity: 0.55 },
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
    // Önizlemede slayt bir düğmenin içinde, render'da sayfanın gövdesinde durur; miras alınan yazı ayarları burada sabitlenir.
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
      <Backdrop audience={slide.audience} element={slide.type === 'sign' ? slide.element : null} />
      {slide.type === 'cover' && <CoverSlide slide={slide} />}
      {slide.type === 'sign' && <SignSlide slide={slide} />}
      {slide.type === 'cta' && <CtaSlide slide={slide} brand={brand} />}
      {slide.type !== 'cta' && <Watermark brand={brand} />}
    </AbsoluteFill>
  );
}
