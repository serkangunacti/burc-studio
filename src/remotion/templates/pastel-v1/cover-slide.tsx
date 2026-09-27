import { AbsoluteFill } from 'remotion';
import { graphemeLength } from '@/lib/text/turkish';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import type { CoverSlideData } from '@/remotion/slide-types';
import { HEADING_FONT } from './fonts';
import { AUDIENCE_INK, AUDIENCE_TITLES, PALETTE, type Backdrop } from './tokens';
import { ZodiacGlyph } from './zodiac';

const RING_RADIUS = 270;
const GLYPH_SIZE = 60;
const RING_BOX = RING_RADIUS * 2 + GLYPH_SIZE * 2;

// Kanca en fazla 60 grafem; uzun kancalar çemberin içinde üç satırı aşmasın.
export function hookFontSize(hook: string): number {
  const length = graphemeLength(hook);
  if (length <= 30) return 52;
  if (length <= 42) return 46;
  return 40;
}

export function CoverSlide({ slide, backdrop }: { slide: CoverSlideData; backdrop: Backdrop }) {
  const ink = AUDIENCE_INK[slide.audience];
  return (
    <AbsoluteFill style={{ padding: '96px 88px 110px', alignItems: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: PALETTE.plumSoft }}>{slide.dateLabel}</div>
      {slide.partLabel && <div style={{ marginTop: 12, fontSize: 24, fontWeight: 700, letterSpacing: 4, color: ink }}>{slide.partLabel}</div>}
      <div style={{ marginTop: 28, fontFamily: HEADING_FONT, fontSize: 64, fontWeight: 500, color: ink }}>Günlük</div>
      <div style={{ fontFamily: HEADING_FONT, fontSize: 104, fontWeight: 600, lineHeight: 1.02 }}>Burç Yorumları</div>
      <div
        style={{
          marginTop: 28,
          padding: '12px 40px',
          borderRadius: 999,
          backgroundImage: `linear-gradient(90deg, ${backdrop.from}, ${backdrop.to})`,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 4,
        }}
      >
        {AUDIENCE_TITLES[slide.audience]}
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: 'auto',
          marginBottom: 'auto',
          width: RING_BOX,
          height: RING_BOX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {SIGN_SLUGS.map((sign, index) => {
          const angle = (index / SIGN_SLUGS.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <div
              key={sign}
              style={{
                position: 'absolute',
                // Tam piksele yuvarlanır: kayan nokta farkları sunucu/istemci ve cihazlar arasında çıktıyı değiştirmesin.
                left: Math.round(RING_BOX / 2 + Math.cos(angle) * RING_RADIUS - GLYPH_SIZE / 2),
                top: Math.round(RING_BOX / 2 + Math.sin(angle) * RING_RADIUS - GLYPH_SIZE / 2),
                width: GLYPH_SIZE,
                height: GLYPH_SIZE,
              }}
            >
              <ZodiacGlyph sign={sign} size={GLYPH_SIZE} color={ink} strokeWidth={5} />
            </div>
          );
        })}
        <div style={{ width: RING_RADIUS * 2 - 110, textAlign: 'center', fontFamily: HEADING_FONT, fontSize: hookFontSize(slide.hook), fontWeight: 500, lineHeight: 1.2 }}>
          {slide.hook}
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 600, color: PALETTE.plumSoft }}>Burcunu bulmak için kaydır →</div>
    </AbsoluteFill>
  );
}
