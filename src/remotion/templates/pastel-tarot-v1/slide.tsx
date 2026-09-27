import { AbsoluteFill } from 'remotion';
import { FORMAT_SIZES, type SlideProps } from '@/remotion/slide-types';
import { CtaSlide } from '../pastel-v1/cta-slide';
import { BODY_FONT } from '../pastel-v1/fonts';
import { BACKDROPS, PALETTE, backdropIndex, type Backdrop } from '../pastel-v1/tokens';
import { Watermark } from '../pastel-v1/watermark';
import { Background } from '../pastel-weekly-v1/slide';
import { TarotCover } from './tarot-cover';
import { TarotSlide } from './tarot-slide';

export function PastelTarotSlide({ slide, brand, format, variant }: SlideProps) {
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
      {slide.type === 'cover' && <TarotCover slide={slide} backdrop={backdrop} />}
      {slide.type === 'sign' && <TarotSlide slide={slide} backdrop={backdrop} />}
      {slide.type === 'cta' && <CtaSlide slide={slide} brand={brand} />}
      {slide.type !== 'cta' && <Watermark brand={brand} />}
    </AbsoluteFill>
  );
}
